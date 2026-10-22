import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
test('Public reads share only in-flight requests; errors, private reads and mutations are not cached',async()=>{
 const source=readFileSync(new URL('../src/api.ts',import.meta.url),'utf8'),js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {api}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));const previous=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>new Promise(resolve=>calls.push({url,options,resolve}));
 const respond=(index,status=200)=>calls[index].resolve(new Response(JSON.stringify(status===200?{items:[index]}:{error:'retry'}),{status,headers:{'Content-Type':'application/json'}}));
 try{const first=api('/public/villas'),second=api('/public/villas');assert.equal(calls.length,1);respond(0);assert.deepEqual(await first,await second);const next=api('/public/villas');assert.equal(calls.length,2);respond(1,503);await assert.rejects(next,e=>e.status===503);const retry=api('/public/villas');assert.equal(calls.length,3);respond(2);await retry;
 const a=api('/state'),b=api('/state'),c=api('/public/contact',{message:'a'}),d=api('/public/contact',{message:'b'});assert.equal(calls.length,7);for(let i=3;i<7;i++)respond(i);await Promise.all([a,b,c,d]);
 const detail=api('/public/advertisements?placement=detail'),home=api('/public/advertisements?placement=home');assert.equal(calls.length,9);respond(7);respond(8);await Promise.all([detail,home]);
 }finally{globalThis.fetch=previous;}
});

test('Concurrent account checks share only a pending request and cannot apply an old session after authentication changes',async()=>{
 const source=readFileSync(new URL('../src/api.ts',import.meta.url),'utf8'),js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {api,currentAccount}=await import('data:text/javascript;base64,'+Buffer.from(js+'\n// account concurrency test').toString('base64'));
 const previousFetch=globalThis.fetch,previousWindow=globalThis.window,calls=[];
 globalThis.window={location:{pathname:'/'},dispatchEvent(){}};
 globalThis.fetch=async(url,options)=>new Promise(resolve=>calls.push({url,options,resolve}));
 const user=id=>({id,name:id,email:id+'@example.test',role:'merchant'});
 const respond=(i,value,status=200)=>calls[i].resolve(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}));
 try{
  const a=currentAccount(),b=currentAccount();assert.equal(calls.length,1);respond(0,{user:user('first'),csrf:'token-first'});assert.deepEqual(await a,await b);
  const fresh=currentAccount();assert.equal(calls.length,2);respond(1,{user:user('first'),csrf:'fresh-token'});await fresh;
  const old=currentAccount(),oldRejection=assert.rejects(old,e=>e.status===409);assert.equal(calls.length,3);
  const logout=api('/auth/logout',{});assert.equal(calls[3].options.headers['X-CSRF-Token'],'fresh-token');respond(3,{ok:true});await logout;
  const next=currentAccount();assert.equal(calls.length,5);respond(4,{user:user('next'),csrf:'token-next'});assert.equal((await next).id,'next');
  respond(2,{user:user('first'),csrf:'stale-token'});await oldRejection;
  const mutation=api('/merchant/profile',{});assert.equal(calls[5].options.headers['X-CSRF-Token'],'token-next');respond(5,{ok:true});await mutation;
  const failed=currentAccount();respond(6,{error:'session expired'},401);await assert.rejects(failed,e=>e.status===401);
  const retry=currentAccount();assert.equal(calls.length,8);respond(7,{user:user('next'),csrf:'token-next'});await retry;
  window.location.pathname='/admin';const admin=currentAccount();assert.equal(calls[8].url,'/api/auth/admin-me');respond(8,{user:{...user('admin'),role:'admin'},csrf:'admin-token'});await admin;
 }finally{globalThis.fetch=previousFetch;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});
