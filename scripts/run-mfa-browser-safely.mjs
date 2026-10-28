// Defense in depth: child/library stdout and stderr are drained, never forwarded
// or written to disk. Only fixed metadata from the redacted receipt is emitted.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export async function runWithSuppressedOutput(script,args,{timeout=600000}={}){
 const child=spawn(process.execPath,[script,...args],{cwd:process.cwd(),env:process.env,stdio:['ignore','pipe','pipe']});let stdoutBytes=0,stderrBytes=0,timedOut=false;
 child.stdout.on('data',chunk=>{stdoutBytes+=chunk.length});child.stderr.on('data',chunk=>{stderrBytes+=chunk.length});
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM')},timeout);
 try{return await new Promise(resolve=>{child.on('error',()=>resolve({exitCode:1,spawnFailed:true,stdoutBytes,stderrBytes,timedOut}));child.on('exit',code=>resolve({exitCode:code??1,spawnFailed:false,stdoutBytes,stderrBytes,timedOut}))})}finally{clearTimeout(timer)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.on('uncaughtException',()=>{process.stderr.write('{"status":"SAFE_RUNNER_FAILURE"}\n');process.exit(1)});
 process.on('unhandledRejection',()=>{process.stderr.write('{"status":"SAFE_RUNNER_FAILURE"}\n');process.exit(1)});
 const args=process.argv.slice(2),environment=args[0],output=args[2]&&!args[2].startsWith('--')?args[2]:'docs/reports/mfa-removal-evidence';
 if(!['staging','production'].includes(environment)){process.stderr.write('{"status":"INVALID_TARGET"}\n');process.exit(1)}
 const result=await runWithSuppressedOutput(path.resolve('scripts/verify-mfa-current-browser.mjs'),args);
 const reportFile=path.join(output,environment+'-browser.json');let receipt;try{receipt=JSON.parse(fs.readFileSync(reportFile))}catch{}
 const summary={environment,exitCode:result.exitCode,passed:result.exitCode===0&&receipt?.passed===true,cases:Array.isArray(receipt?.rows)?receipt.rows.length:0,childOutputSuppressed:true,rawOutputStored:false,timedOut:result.timedOut,report:reportFile};
 fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,environment+'-safe-runner.json'),JSON.stringify(summary,null,2)+'\n');process.stdout.write(JSON.stringify(summary)+'\n');process.exit(result.exitCode);
}
