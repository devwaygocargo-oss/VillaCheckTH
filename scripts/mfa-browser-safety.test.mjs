// Pure local mocks. No browser, network, Keychain or real credentials are used.
import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import path from 'node:path'

const moduleUrl=pathToFileURL(path.resolve('scripts/mfa-browser-safety.mjs')).href
const sentinel='VC_FAKE_HEADER_VALUE_MUST_NEVER_REACH_STDERR'
const worker=mode=>`
import {guardedRoute,routeLifecycle,closeContextSafely,installSanitizedProcessHandlers} from ${JSON.stringify(moduleUrl)};
const secret=${JSON.stringify(sentinel)},mode=${JSON.stringify(mode)};
const sensitive=Object.assign(Error('route.fetch: Target page, context or browser has been closed\\nCall log:\\n  x-vercel-protection-bypass: '+secret+'\\nFAKE_SENSITIVE_MESSAGE'),{name:'TargetClosedError'});
installSanitizedProcessHandlers({phase:()=> 'local-regression',onFatal:async()=>{}});
if(mode==='unhandled'){Promise.reject(sensitive);}
else if(mode==='uncaught'){setTimeout(()=>{throw sensitive},0);}
else if(mode==='guarded-fetch'){
 const state=routeLifecycle(),route={fetch:async()=>{throw sensitive},fulfill:async()=>{},abort:async()=>{}};
 await guardedRoute(state,async r=>{const response=await r.fetch({headers:{'x-vercel-protection-bypass':secret}});await r.fulfill({response});})(route);
 process.stdout.write(JSON.stringify({unexpected:state.unexpectedTransportErrors,ignored:state.ignoredClosingTargetErrors})+'\\n');
}
else if(mode==='closing-fetch'){
 const state=routeLifecycle();let rejectFetch;
 const route={fetch:()=>new Promise((_,reject)=>{rejectFetch=reject}),fulfill:async()=>{},abort:async()=>{}};
 const pending=guardedRoute(state,async r=>{const response=await r.fetch({headers:{'x-vercel-protection-bypass':secret}});await r.fulfill({response});})(route);
 const calls=[],context={unrouteAll:async()=>{calls.push('context.unrouteAll')},close:async()=>{calls.push('context.close');rejectFetch(sensitive);await pending}};
 const result=await closeContextSafely(context,state,{unrouteTimeoutMs:100,closeTimeoutMs:100});
 process.stdout.write(JSON.stringify({result,calls})+'\\n');
}
else if(mode==='closing-other-error'){
 const state=routeLifecycle();state.closing=true;
 const route={abort:async()=>{throw Error('FAKE_SENSITIVE_MESSAGE '+secret)}};
 await guardedRoute(state,async()=>{})(route);
 process.stdout.write(JSON.stringify({unexpected:state.unexpectedTransportErrors,ignored:state.ignoredClosingTargetErrors})+'\\n');
}
else if(mode==='bounded-teardown'){
 const state=routeLifecycle(),context={unrouteAll:()=>new Promise(()=>{}),close:()=>new Promise(()=>{})};
 const result=await closeContextSafely(context,state,{unrouteTimeoutMs:5,closeTimeoutMs:5});
 process.stdout.write(JSON.stringify(result)+'\\n');
}
`
function run(mode){
 const result=spawnSync(process.execPath,['--input-type=module'],{input:worker(mode),encoding:'utf8',timeout:5000,stdio:['pipe','pipe','pipe']})
 assert.equal(result.error,undefined,'Local mock worker failed')
 for(const forbidden of [sentinel,'x-vercel-protection-bypass','Call log:','FAKE_SENSITIVE_MESSAGE']){
  assert(!result.stderr.includes(forbidden),'Sensitive exception text escaped to stderr')
  assert(!result.stdout.includes(forbidden),'Sensitive exception text escaped to stdout')
 }
 return result
}

test('route.fetch rejection containing a fake diagnostic header is awaited and counted without printing it',()=>{
 const result=run('guarded-fetch');assert.equal(result.status,0);assert.equal(result.stderr,'')
 assert.deepEqual(JSON.parse(result.stdout),{unexpected:1,ignored:0})
})
test('context routes are removed before close and closing TargetClosed errors are contained',()=>{
 const result=run('closing-fetch');assert.equal(result.status,0);assert.equal(result.stderr,'')
 const value=JSON.parse(result.stdout);assert.deepEqual(value.calls,['context.unrouteAll','context.close']);assert.equal(value.result.context,'CLOSED');assert.equal(value.result.unexpectedTransportErrors,0);assert(value.result.ignoredClosingTargetErrors>=1)
})
test('other transport failures remain failures even during teardown',()=>{
 const result=run('closing-other-error');assert.equal(result.status,0);assert.equal(result.stderr,'')
 const value=JSON.parse(result.stdout);assert(value.unexpected>0);assert.equal(value.ignored,0)
})
for(const mode of ['unhandled','uncaught'])test('last-resort '+mode+' handler emits only safe type and fixed phase',()=>{
 const result=run(mode);assert.equal(result.status,1);assert.equal(result.stdout,'')
 assert.deepEqual(JSON.parse(result.stderr),{errorType:'TargetClosedError',phase:'local-regression'})
})
test('both context cleanup operations have finite timeouts',()=>{
 const result=run('bounded-teardown');assert.equal(result.status,0);assert.equal(result.stderr,'')
 const value=JSON.parse(result.stdout);assert.equal(value.context,'CLOSE_TIMEOUT_OR_FAILED');assert(value.unexpectedTransportErrors>=2)
})
