import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {runWithSuppressedOutput} from './run-mfa-browser-safely.mjs';
test('library exceptions containing fake secret headers cannot escape the output boundary',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'vc-safe-transport-')),file=path.join(folder,'failing-child.mjs');const fake='LOCAL_FAKE_SENSITIVE_HEADER_DO_NOT_FORWARD';
 fs.writeFileSync(file,'process.stdout.write("untrusted stdout '+fake+'\\n");process.stderr.write("x-vercel-protection-bypass: '+fake+'\\n");throw Error("route.fetch failed with '+fake+'")');
 try{const result=await runWithSuppressedOutput(file,[],{timeout:5000});assert.equal(result.exitCode,1);assert(result.stdoutBytes>0&&result.stderrBytes>0);assert(!JSON.stringify(result).includes(fake));assert(!('stdout'in result)&&!('stderr'in result));assert.equal(result.timedOut,false)}finally{fs.rmSync(folder,{recursive:true,force:true})}
});
