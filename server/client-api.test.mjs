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
