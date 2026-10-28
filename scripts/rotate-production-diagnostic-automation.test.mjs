// Offline mocks only. All secret strings here are synthetic test sentinels.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {rotateDiagnosticAutomation,rotationScope,rotationProposalSha256,validateRotationApproval,apiInvocation,keychainInvocation,nativeAdapters} from "./rotate-production-diagnostic-automation.mjs";

const oldSecret="SYNTHETIC_OLD_BYPASS_SENTINEL_ONLY",newSecret="SYNTHETIC_NEW_BYPASS_SENTINEL_ONLY";
const otherSecret="SYNTHETIC_OTHER_BYPASS_SENTINEL_ONLY";
const now=Date.parse("2026-10-29T04:00:00.000Z");
// This in-memory synthetic approval is used exclusively with injected mocks.
// No approval receipt is written and no native adapter/process is executed.
const approval=()=>({reference:rotationScope.reference,proposalSha256:rotationProposalSha256,status:"EXPLICIT_USER_APPROVED",source:"USER_MESSAGE",userMessageSha256:"a".repeat(64),approvedAt:new Date(now-1000).toISOString()});
function fixture({encoding="json",alterResponse,alterAfter,writeFailure=false,readFailure=false}={}){
 const record={reference:"EXISTING_SYNTHETIC_RECORD",secret:oldSecret,preserveMetadata:{label:"diagnostic-automation",createdAt:"KEEP_EXISTING_TIME"}};
 const raw=Buffer.from(encoding==="json"?JSON.stringify(record):Buffer.from(JSON.stringify(record)).toString("base64"));
 const originalProject={id:rotationScope.projectId,accountId:rotationScope.teamId,name:"villacheck-production",updatedAt:1,ssoProtection:{deploymentType:"all"},otherProtection:{enabled:true},environmentMetadata:[{key:"EXISTING_CONFIG",updatedAt:1}],protectionBypass:{[oldSecret]:{createdAt:1,scope:"automation"},[otherSecret]:{createdAt:2,scope:"automation"}}};
 const rotatedProject=structuredClone(originalProject);rotatedProject.updatedAt=2;delete rotatedProject.protectionBypass[oldSecret];rotatedProject.protectionBypass[newSecret]={createdAt:3,scope:"automation"};
 const calls=[],writes=[];let getCount=0;
 const adapters={
  readRecord:async()=>{calls.push("readRecord");if(readFailure)throw Error(oldSecret+newSecret);return Buffer.from(raw)},
  getProject:async()=>{calls.push("getProject");return structuredClone(getCount++===0?originalProject:alterAfter?alterAfter(structuredClone(rotatedProject)):rotatedProject)},
  rotate:async body=>{calls.push("rotate");assert.deepEqual(body,{revoke:{secret:oldSecret,regenerate:true}});const response={protectionBypass:structuredClone(rotatedProject.protectionBypass)};return alterResponse?alterResponse(response):response},
  writeRecord:async value=>{calls.push("writeRecord");if(writeFailure)throw Error(oldSecret+newSecret);writes.push(value)},
 };
 return{adapters,calls,writes,raw,record,originalProject,rotatedProject};
}
function assertNoSecrets(value){const output=typeof value==="string"?value:JSON.stringify(value);for(const secret of [oldSecret,newSecret,otherSecret])assert(!output.includes(secret),"Synthetic credential leaked into a public result or argument")}

test("missing, synthetic-context, wrong-scope and stale approvals fail before any adapter call",async t=>{
 for(const value of [undefined,{}, {...approval(),status:"NOT_APPROVED"},{...approval(),source:"ASSISTANT_INFERENCE"},{...approval(),proposalSha256:"b".repeat(64)},{...approval(),reference:"OTHER_INCIDENT"},{...approval(),approvedAt:new Date(now-86400001).toISOString()},{...approval(),approvedAt:new Date(now+1).toISOString()}])await t.test("approval rejected",async()=>{const f=fixture();const result=await rotateDiagnosticAutomation({approval:value,adapters:f.adapters,now});assert.equal(result.ok,false);assert.equal(result.providerMutationAttempted,false);assert.deepEqual(f.calls,[]);assertNoSecrets(result)});
});

test("only exact diagnostic key is revoked, one key generated and other project configuration preserved",async t=>{
 for(const encoding of ["json","base64-json"])await t.test(encoding,async()=>{const f=fixture({encoding});const result=await rotateDiagnosticAutomation({approval:approval(),adapters:f.adapters,now});assert.equal(result.ok,true);assert.equal(result.otherKeysAndProjectConfigurationPreserved,true);assert.deepEqual(f.calls,["readRecord","getProject","rotate","getProject","writeRecord"]);assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0].expected,f.raw);let stored=f.writes[0].replacement.toString();if(encoding==="base64-json")stored=Buffer.from(stored,"base64").toString();const next=JSON.parse(stored);assert.equal(next.secret,newSecret);assert.deepEqual(next.preserveMetadata,f.record.preserveMetadata);assert.equal(next.reference,f.record.reference);assertNoSecrets(result)});
});

test("provider shape/key inconsistencies fail closed before Keychain update",async t=>{
 const alters=[
  r=>({...r,protectionBypass:{...r.protectionBypass,[oldSecret]:{createdAt:1}}}),
  r=>({...r,protectionBypass:{...r.protectionBypass,SYNTHETIC_EXTRA_NEW_BYPASS_SENTINEL:{createdAt:4}}}),
  r=>{delete r.protectionBypass[otherSecret];return r},
  r=>{r.protectionBypass[otherSecret].scope="changed";return r},
  ()=>({}),
 ];
 for(const alterResponse of alters)await t.test("unexpected provider mutation",async()=>{const f=fixture({alterResponse});const result=await rotateDiagnosticAutomation({approval:approval(),adapters:f.adapters,now});assert.equal(result.ok,false);assert.equal(result.requiresReconciliation,true);assert.equal(f.writes.length,0);assertNoSecrets(result)});
});

test("project drift and rotation readback mismatch prevent local credential overwrite",async t=>{
 for(const alterAfter of [p=>{p.ssoProtection.deploymentType="none";return p},p=>{p.protectionBypass[otherSecret].scope="changed";return p},p=>{p.id="another-project";return p}])await t.test("readback rejected",async()=>{const f=fixture({alterAfter});const result=await rotateDiagnosticAutomation({approval:approval(),adapters:f.adapters,now});assert.equal(result.ok,false);assert.equal(f.writes.length,0);assertNoSecrets(result)});
});

test("Keychain failures expose only fixed codes, not provider/record exception text",async t=>{
 for(const options of [{readFailure:true},{writeFailure:true}])await t.test("private exception sanitized",async()=>{const f=fixture(options);const result=await rotateDiagnosticAutomation({approval:approval(),adapters:f.adapters,now});assert.equal(result.ok,false);assert.equal(result.code,"ROTATION_STEP_FAILED");assertNoSecrets(result);assert.equal(result.requiresReconciliation,options.writeFailure===true)});
});

test("CLI and native transport keep all credential values in JSON stdin only",async()=>{
 const body={revoke:{secret:oldSecret,regenerate:true}},api=apiInvocation("PATCH",body);
 assertNoSecrets(api.args);assert.deepEqual(JSON.parse(api.input),body);assert(api.args.includes("--input"));assert.equal(api.args[api.args.indexOf("--input")+1],"-");assert(!api.args.some(arg=>arg.includes("--token")||arg.includes("--debug")||arg.includes("--header")));
 const native=keychainInvocation("update",{expectedValueBase64:Buffer.from(oldSecret).toString("base64"),replacementValueBase64:Buffer.from(newSecret).toString("base64")});assertNoSecrets(native.args);assert(!JSON.stringify(native.args).includes(Buffer.from(oldSecret).toString("base64")));assert.equal(JSON.parse(native.input).service,rotationScope.keychainService);
});

test("native adapters use captured pipes, preserve exact record bytes for comparison and emit no logs/files",async()=>{
 const f=fixture(),invocations=[];let gets=0;
 const run=async invocation=>{invocations.push(invocation);assertNoSecrets(invocation.args);if(invocation.command==="/usr/bin/swift"){const request=JSON.parse(invocation.input);if(request.operation==="read")return{ok:true,dataBase64:f.raw.toString("base64")};assert.equal(request.expectedValueBase64,f.raw.toString("base64"));const next=JSON.parse(Buffer.from(request.replacementValueBase64,"base64").toString());assert.equal(next.secret,newSecret);return{ok:true,updated:true,readbackVerified:true}}if(invocation.args.includes("PATCH"))return{protectionBypass:f.rotatedProject.protectionBypass};return gets++===0?f.originalProject:f.rotatedProject};
 const output=[],fileWrites=[],originalOut=process.stdout.write,originalErr=process.stderr.write,originalWrite=fs.writeFileSync;
 process.stdout.write=process.stderr.write=function(chunk,encoding,callback){output.push(String(chunk));if(typeof encoding==="function")encoding();else if(typeof callback==="function")callback();return true};
 fs.writeFileSync=(...args)=>{fileWrites.push(args);throw Error("Files are forbidden inside the rotation engine")};
 let result;try{result=await rotateDiagnosticAutomation({approval:approval(),adapters:nativeAdapters(run),now})}finally{process.stdout.write=originalOut;process.stderr.write=originalErr;fs.writeFileSync=originalWrite}
 assert.equal(result.ok,true);assert.equal(invocations.length,5);assertNoSecrets(result);for(const invocation of invocations)assertNoSecrets(invocation.args);assert.deepEqual(output,[]);assert.deepEqual(fileWrites,[]);
});

test("approval validation itself does not accept a future, unrelated or inferred decision",()=>{
 assert.equal(validateRotationApproval(approval(),now),true);assert.throws(()=>validateRotationApproval({...approval(),source:"SYSTEM_DEFAULT"},now),/EXPLICIT_USER_APPROVAL_REQUIRED/);
});
