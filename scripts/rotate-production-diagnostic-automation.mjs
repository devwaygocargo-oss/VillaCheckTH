// Incident-specific operator tool. It must not run without fresh explicit user
// approval. No bypass values, provider bodies or Keychain records are logged.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {createHash} from "node:crypto";
import {spawn} from "node:child_process";

export const rotationScope=Object.freeze({
 reference:"VC_DIAGNOSTIC_AUTOMATION_EXPOSURE_20261029",
 operation:"REVOKE_AND_REGENERATE_EXACT_DIAGNOSTIC_AUTOMATION_BYPASS",
 environment:"production",
 projectId:"prj_AojlAe1eFqvqEnKd3FPENLbr3DtO",
 teamId:"team_H5TvWOtVZTbtuTSapZyj6uGz",
 keychainService:"com.villacheck.production.green-sun-56847773",
 keychainAccount:"diagnostic-automation",
 revokeCount:1,generateCount:1,
 otherBypassKeys:"PRESERVE",projectProtection:"PRESERVE",providerCredentials:"PRESERVE",
});
const hash=value=>createHash("sha256").update(value).digest("hex");
export const rotationProposalSha256=hash(JSON.stringify(rotationScope));
const scriptDir=path.dirname(fileURLToPath(import.meta.url));
const evidenceDir=path.resolve(scriptDir,"../docs/releases/evidence/remove-mfa-current-20261029");
export const rotationApprovalPath=path.join(evidenceDir,"diagnostic-automation-rotation-approval.json");
const resultPath=path.join(evidenceDir,"diagnostic-automation-rotation-result.json");
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
class RotationError extends Error {constructor(code){super(code);this.code=code;this.name="RotationError"}}
function requireCondition(condition,code){if(!condition)throw new RotationError(code)}
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function validateRotationApproval(approval,now=Date.now()){
 requireCondition(object(approval),"EXPLICIT_USER_APPROVAL_REQUIRED");
 requireCondition(approval.reference===rotationScope.reference&&approval.proposalSha256===rotationProposalSha256,"APPROVAL_SCOPE_MISMATCH");
 requireCondition(approval.status==="EXPLICIT_USER_APPROVED"&&approval.source==="USER_MESSAGE"&&/^[a-f0-9]{64}$/.test(approval.userMessageSha256||""),"EXPLICIT_USER_APPROVAL_REQUIRED");
 const at=Date.parse(approval.approvedAt);
 requireCondition(Number.isFinite(at)&&at<=now&&now-at<=24*60*60*1000,"APPROVAL_EXPIRED_OR_INVALID");
 return true;
}
function decodeRecord(raw){
 requireCondition(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=65536,"KEYCHAIN_RECORD_FORMAT_REJECTED");
 let data,encoding="json",text=raw.toString("utf8");
 try{data=JSON.parse(text)}catch{
  requireCondition(/^[A-Za-z0-9+/=\r\n]+$/.test(text),"KEYCHAIN_RECORD_FORMAT_REJECTED");
  try{data=JSON.parse(Buffer.from(text,"base64").toString("utf8"));encoding="base64-json"}catch{throw new RotationError("KEYCHAIN_RECORD_FORMAT_REJECTED")}
 }
 requireCondition(object(data)&&own(data,"secret")&&typeof data.secret==="string"&&/^[A-Za-z0-9_-]{16,256}$/.test(data.secret),"KEYCHAIN_RECORD_FORMAT_REJECTED");
 return {data,encoding};
}
function replaceRecord(decoded,newSecret){const json=JSON.stringify({...decoded.data,secret:newSecret});return Buffer.from(decoded.encoding==="json"?json:Buffer.from(json).toString("base64"))}
function projectConfiguration(project){const copy={...project};delete copy.protectionBypass;delete copy.updatedAt;return copy}
function validateProject(project){
 requireCondition(object(project)&&project.id===rotationScope.projectId&&project.accountId===rotationScope.teamId,"PROJECT_TARGET_MISMATCH");
 requireCondition(object(project.protectionBypass),"PROJECT_BYPASS_MAP_UNAVAILABLE");
}
function validateRotationMap(before,after,oldSecret){
 requireCondition(object(after)&&own(before,oldSecret)&&!own(after,oldSecret),"EXACT_OLD_BYPASS_NOT_REVOKED");
 const added=Object.keys(after).filter(key=>!own(before,key));
 requireCondition(added.length===1&&/^[A-Za-z0-9_-]{16,256}$/.test(added[0]),"EXACTLY_ONE_NEW_BYPASS_REQUIRED");
 const removed=Object.keys(before).filter(key=>!own(after,key));
 requireCondition(removed.length===1&&removed[0]===oldSecret,"OTHER_BYPASS_REMOVAL_DETECTED");
 for(const key of Object.keys(before))if(key!==oldSecret)requireCondition(own(after,key)&&equal(after[key],before[key]),"OTHER_BYPASS_CHANGE_DETECTED");
 return added[0];
}

// Adapters are injected so all safety behavior can be checked with mocks only.
export async function rotateDiagnosticAutomation({approval,adapters,now=Date.now()}){
 let phase="APPROVAL",mutationAttempted=false,rotationVerified=false,keychainUpdated=false;
 let oldFingerprint,newFingerprint;
 try{
  validateRotationApproval(approval,now);
  requireCondition(adapters&&["readRecord","getProject","rotate","writeRecord"].every(key=>typeof adapters[key]==="function"),"ROTATION_ADAPTERS_REQUIRED");
  phase="KEYCHAIN_READ";const raw=await adapters.readRecord(),decoded=decodeRecord(raw),oldSecret=decoded.data.secret;oldFingerprint=hash(oldSecret);
  phase="PROJECT_READ";const before=await adapters.getProject();validateProject(before);
  requireCondition(own(before.protectionBypass,oldSecret),"DIAGNOSTIC_KEY_NOT_PRESENT_NO_AUTOMATIC_RETRY");
  phase="PROVIDER_ROTATION";mutationAttempted=true;
  const response=await adapters.rotate({revoke:{secret:oldSecret,regenerate:true}});
  requireCondition(object(response),"PROVIDER_RESPONSE_FORMAT_REJECTED");
  const newSecret=validateRotationMap(before.protectionBypass,response.protectionBypass,oldSecret);newFingerprint=hash(newSecret);rotationVerified=true;
  phase="PROJECT_VERIFY";const after=await adapters.getProject();validateProject(after);
  requireCondition(equal(after.protectionBypass,response.protectionBypass),"PROVIDER_ROTATION_READBACK_MISMATCH");
  requireCondition(equal(projectConfiguration(before),projectConfiguration(after)),"PROJECT_CONFIGURATION_DRIFT_DETECTED");
  phase="KEYCHAIN_UPDATE";await adapters.writeRecord({expected:raw,replacement:replaceRecord(decoded,newSecret)});keychainUpdated=true;
  return {ok:true,status:"EXACT_DIAGNOSTIC_BYPASS_ROTATED",reference:rotationScope.reference,projectId:rotationScope.projectId,teamId:rotationScope.teamId,proposalSha256:rotationProposalSha256,providerMutationAttempted:true,providerRotationVerified:true,keychainUpdated:true,otherKeysAndProjectConfigurationPreserved:true,oldSecretSha256:oldFingerprint,newSecretSha256:newFingerprint,secretValuesPrinted:false};
 }catch(error){
  return {ok:false,status:mutationAttempted?"STOP_RECONCILIATION_REQUIRED":"BLOCKED_BEFORE_PROVIDER_MUTATION",code:error instanceof RotationError?error.code:"ROTATION_STEP_FAILED",phase,reference:rotationScope.reference,projectId:rotationScope.projectId,providerMutationAttempted:mutationAttempted,providerRotationVerified:rotationVerified,keychainUpdated,requiresReconciliation:mutationAttempted&&!keychainUpdated,...(oldFingerprint?{oldSecretSha256:oldFingerprint}:{}),...(newFingerprint?{newSecretSha256:newFingerprint}:{}),secretValuesPrinted:false};
 }
}

export function apiInvocation(method,body){
 requireCondition(["GET","PATCH"].includes(method),"CLI_METHOD_REJECTED");
 const endpoint=method==="GET"?"/v9/projects/"+rotationScope.projectId:"/v1/projects/"+rotationScope.projectId+"/protection-bypass";
 const args=["/tmp/villacheck-staging-cli/node_modules/vercel/dist/index.js","api",endpoint+"?teamId="+rotationScope.teamId,"--method",method,"--scope",rotationScope.teamId,"--non-interactive","--no-color"];
 if(method==="PATCH")args.push("--input","-");
 return {command:process.execPath,args,input:method==="PATCH"?JSON.stringify(body):""};
}
export function keychainInvocation(operation,payload={}){
 requireCondition(["read","update"].includes(operation),"KEYCHAIN_OPERATION_REJECTED");
 return {command:"/usr/bin/swift",args:[path.join(scriptDir,"diagnostic-automation-keychain.swift")],input:JSON.stringify({...payload,operation,service:rotationScope.keychainService,account:rotationScope.keychainAccount})};
}
async function runCaptured({command,args,input}){
 return new Promise((resolve,reject)=>{
  // Retain ordinary user/path settings, not arbitrary debug, trace, token or API
  // override variables. Vercel uses its existing native CLI authentication file.
  const env=Object.fromEntries(["PATH","HOME","USER","LOGNAME","SHELL","TMPDIR","LANG","LC_ALL","XDG_CONFIG_HOME","XDG_DATA_HOME","XDG_CACHE_HOME"].filter(key=>typeof process.env[key]==="string").map(key=>[key,process.env[key]]));
  Object.assign(env,{VERCEL_TELEMETRY_DISABLED:"1",DO_NOT_TRACK:"1",VERCEL_SKIP_UPDATE_CHECK:"1",NO_COLOR:"1",NODE_OPTIONS:""});
  const child=spawn(command,args,{env,stdio:["pipe","pipe","pipe"]});let stdout=[],size=0,finished=false;
  const timer=setTimeout(()=>{child.kill("SIGTERM");reject(new RotationError("PRIVATE_PROCESS_TIMED_OUT"))},45000);
  child.stdout.on("data",chunk=>{size+=chunk.length;if(size>4*1024*1024){child.kill("SIGTERM");return}stdout.push(chunk)});
  // Drain stderr without retaining or printing potentially secret error details.
  child.stderr.on("data",()=>{});child.stdin.on("error",()=>{});
  child.on("error",()=>{clearTimeout(timer);if(!finished){finished=true;reject(new RotationError("PRIVATE_PROCESS_FAILED"))}});
  child.on("close",code=>{clearTimeout(timer);if(finished)return;finished=true;if(code!==0||size>4*1024*1024)return reject(new RotationError("PRIVATE_PROCESS_FAILED"));try{resolve(JSON.parse(Buffer.concat(stdout).toString("utf8")))}catch{reject(new RotationError("PRIVATE_PROCESS_RESPONSE_REJECTED"))}});
  child.stdin.end(input);
 });
}
export function nativeAdapters(run=runCaptured){
 return{
  readRecord:async()=>{const response=await run(keychainInvocation("read"));requireCondition(response?.ok===true&&typeof response.dataBase64==="string","KEYCHAIN_READ_FAILED");return Buffer.from(response.dataBase64,"base64")},
  getProject:()=>run(apiInvocation("GET")),
  rotate:body=>run(apiInvocation("PATCH",body)),
  writeRecord:async({expected,replacement})=>{const response=await run(keychainInvocation("update",{expectedValueBase64:expected.toString("base64"),replacementValueBase64:replacement.toString("base64")}));requireCondition(response?.ok===true&&response.updated===true&&response.readbackVerified===true,"KEYCHAIN_UPDATE_READBACK_FAILED")},
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 // No receipt is synthesized here. Root may record it only after an actual
 // explicit user reply approving this exact incident/proposal.
 let result;
 try{
  requireCondition(process.argv.includes("--execute")&&fs.existsSync(rotationApprovalPath),"EXPLICIT_USER_APPROVAL_REQUIRED");
  const approval=JSON.parse(fs.readFileSync(rotationApprovalPath,"utf8"));validateRotationApproval(approval);
  result=await rotateDiagnosticAutomation({approval,adapters:nativeAdapters()});
  fs.mkdirSync(evidenceDir,{recursive:true});fs.writeFileSync(resultPath,JSON.stringify({at:new Date().toISOString(),...result},null,2)+"\n",{mode:0o600});
 }catch(error){result={ok:false,status:"BLOCKED_BEFORE_CREDENTIAL_ACCESS",code:error instanceof RotationError?error.code:"APPROVAL_RECEIPT_INVALID",reference:rotationScope.reference,secretValuesPrinted:false}}
 process.stdout.write(JSON.stringify(result)+"\n");process.exitCode=result.ok?0:1;
}
