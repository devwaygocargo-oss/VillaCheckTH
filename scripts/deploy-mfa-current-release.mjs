// Deploy the exact frozen, environment-specific source from the common envelope.
// Raw CLI stdout/stderr stay in memory and are never logged or persisted.
import fs from 'node:fs';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import {mfaOut} from './mfa-current-context.mjs';import {mfaProviderGet,mfaCli,mfaTeam} from './mfa-current-provider.mjs';import {sharedApplicationCliPlan} from './shared-application-cli-guard.mjs';
import {validateRotationApproval} from './rotate-production-diagnostic-automation.mjs';
const [environment,mode]=process.argv.slice(2),read=n=>JSON.parse(fs.readFileSync(mfaOut+'/'+n+'.json')),save=(n,data)=>fs.writeFileSync(mfaOut+'/'+n+'.json',JSON.stringify(data,null,2)+'\n');let phase='validation';
async function cli(args,artifact){let stdout='',stderr='';const child=spawn(process.execPath,[mfaCli,...args,'--no-color','--non-interactive'],{cwd:artifact,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',CUSTOMER_OAUTH_EXISTING_ENABLED:'true',APP_URL:'https://'+read(environment+'-manifest').alias},stdio:['ignore','pipe','pipe']});child.stdout.on('data',v=>{stdout+=v;if(stdout.length+stderr.length>8*1024*1024)child.kill('SIGTERM')});child.stderr.on('data',v=>{stderr+=v;if(stdout.length+stderr.length>8*1024*1024)child.kill('SIGTERM')});const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject)});assert.equal(code,0,'CLI operation failed; raw output suppressed');return stdout+'\n'+stderr}
try{
 assert(['staging','production'].includes(environment)&&['deploy','promote'].includes(mode));const r=read('release'),m=read(environment+'-manifest');assert(r.pushed&&m.commit===r.commit);assert(read(environment+'-local-quality').passed);assert(read(environment+'-frozen-independent-security').passed);assert(read(environment+'-frozen-oauth-existing').passed);
 const previous=m.baselineDeployment,current=mfaProviderGet('/v4/aliases/'+m.alias);assert.equal(current.deployment.id,previous,'Canonical deployment changed unexpectedly');
 if(environment==='production'){
  // No permission is inferred from elapsed time or the original MFA request.
  validateRotationApproval(read('diagnostic-automation-rotation-approval'));
  const rotation=read('diagnostic-automation-rotation-result');assert(rotation.ok===true&&rotation.status==='EXACT_DIAGNOSTIC_BYPASS_ROTATED'&&rotation.providerRotationVerified===true&&rotation.keychainUpdated===true&&rotation.otherKeysAndProjectConfigurationPreserved===true&&rotation.projectId===m.projectId,'Explicitly authorized credential repair is required first');
  const stageGate=read('staging-canonical/staging-browser');assert(stageGate.passed&&stageGate.sourceCommit===r.commit&&stageGate.deploymentId===read('staging-deployment').id,'Exact Staging browser gate is required');
 }
 const preflight=JSON.parse(fs.readFileSync(mfaOut+'/predeploy-auth-final/staging-browser.json'));assert(preflight.passed&&preflight.rows.length===12&&preflight.deploymentId===read('baseline-bindings').staging.id);
 if(mode==='deploy'){
  phase='deploy';assert(!fs.existsSync(mfaOut+'/'+environment+'-deployment.json'),'Preserve any existing deployment attempt');const plan=sharedApplicationCliPlan({environment,manifest:m,expectedSourceDigest:m.sourceDigest,cliEntry:mfaCli});
  const output=await cli([...plan.args.slice(1),'--env','CUSTOMER_OAUTH_EXISTING_ENABLED','--env','APP_URL','--meta','releaseCommit='+r.commit,'--meta','applicationSourcePrefix='+(m.sourcePrefix||'.')],m.artifact),name=environment==='staging'?'design-villacheck':'villacheck-production',url=output.match(new RegExp('https://'+name+'-[a-z0-9]+-villa-check\\.vercel\\.app','g'))?.at(-1);assert(url);
  phase='source-inventory';const d=mfaProviderGet('/v13/deployments/'+new URL(url).hostname);assert.equal(d.readyState,'READY');assert.equal(d.projectId,m.projectId);assert.equal(d.meta.releaseCommit,r.commit);
  const tree=mfaProviderGet('/v6/deployments/'+d.id+'/files'),files=new Map();const walk=(nodes,prefix='')=>{for(const n of nodes)n.children?walk(n.children,prefix+n.name+'/'):files.set(prefix+n.name,n.uid)};walk(tree[0].children);assert.equal(files.size,m.files.length);for(const f of m.files)assert.equal(files.get(f.file),createHash('sha1').update(fs.readFileSync(m.artifact+'/'+f.file)).digest('hex'),f.file);
  save(environment+'-deployment',{at:new Date().toISOString(),id:d.id,url,projectId:d.projectId,readyState:d.readyState,sourceVerified:true,commit:r.commit,sourcePrefix:m.sourcePrefix,sourceDigest:m.sourceDigest,baselineCommit:m.baselineCommit,previousDeployment:previous,runtimeChangesFromPrevious:0,applicationCodeParity:false});console.log({environment,id:d.id,url,readyState:d.readyState,commit:r.commit,uploadedSourceVerified:true});
 }else{
  phase='promotion';const d=read(environment+'-deployment');assert(d.sourceVerified&&d.commit===r.commit);assert.equal(d.projectId,m.projectId);await cli(['promote',d.url,'--scope',mfaTeam,'--yes'],m.artifact);assert.equal(mfaProviderGet('/v4/aliases/'+m.alias).deployment.id,d.id);
  if(environment==='staging'){phase='canonical-config';const response=await fetch('https://'+m.alias+'/api/config',{redirect:'manual',signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);assert.deepEqual(await response.json(),read('staging-before').publicConfig)}
  save(environment+'-promoted',{at:new Date().toISOString(),id:d.id,commit:r.commit,alias:m.alias,passed:true});console.log({environment,id:d.id,promoted:true,commit:r.commit});
 }
}catch{
 fs.mkdirSync(mfaOut,{recursive:true});save((['staging','production'].includes(environment)?environment:'invalid')+'-deployment-blocker',{at:new Date().toISOString(),phase,status:'FAILED_OR_BLOCKED',rawErrorSuppressed:true,productionCredentialApprovalNeverInferred:true});console.error({environment:['staging','production'].includes(environment)?environment:'invalid',phase,status:'FAILED_OR_BLOCKED',rawErrorSuppressed:true});process.exitCode=1;
}
