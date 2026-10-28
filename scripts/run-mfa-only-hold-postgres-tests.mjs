// No live target, .env, keychain, provider, or CLI operation is used by this runner.
import fs from 'node:fs'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {randomBytes,createHash} from 'node:crypto'
import EmbeddedPostgres from 'embedded-postgres'
const out='docs/releases/evidence/remove-mfa-current-20261029';fs.mkdirSync(out,{recursive:true})
const source='scripts/remove-current-mfa-only-hold.mjs',sha=bytes=>createHash('sha256').update(bytes).digest('hex'),sourceSha=sha(fs.readFileSync(source)),temporary=fs.mkdtempSync('/tmp/vc-mfa-hold-pg-'),reserve=createServer()
await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
const password=randomBytes(24).toString('hex'),cluster=new EmbeddedPostgres({databaseDir:temporary+'/data',user:'postgres',password,port,persistent:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}})
let code=1
try{
 await cluster.initialise();await cluster.start()
 const env={...process.env,TEST_DATABASE_URL:'postgresql://postgres:'+password+'@127.0.0.1:'+port+'/postgres',APP_ENV:'test',NODE_ENV:'test'}
 const log=out+'/production-mfa-only-hold-postgres-tests.log'
 for(const key of Object.keys(env))if(/^(?:SMTP_|THAIBULKSMS_|GOOGLE_CLIENT_|LINE_CHANNEL_|FACEBOOK_APP_|DATABASE_URL|DIRECT_URL|VillaCheck_|VILLACHECK_|AUTH_TEST_|COMPOSE_TEST_)/.test(key))delete env[key]
 const fd=fs.openSync(log,'w'),child=spawn(process.execPath,['--test','--test-concurrency=1','scripts/mfa-only-hold-repair-postgres.test.mjs'],{env,stdio:['ignore',fd,fd]})
 code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject)});fs.closeSync(fd)
 const text=fs.readFileSync(log,'utf8'),count=label=>Number(text.match(new RegExp('ℹ '+label+' (\\d+)'))?.[1]),unchanged=sha(fs.readFileSync(source))===sourceSha
 const result={at:new Date().toISOString(),passed:code===0&&unchanged,exitCode:code,tests:count('tests'),pass:count('pass'),fail:count('fail'),helperSourceSha256:sourceSha,helperSourceUnchanged:unchanged,applicationSchema:'server/postgres-schema.sql + server/business-schema.sql via actual openPostgres',auditService:'server/database.mjs audit()',auditTargetColumn:'target_id',disposablePostgreSQL:true,externalHttpOrProviderOrKeychainCalls:0,liveDatabaseConnections:0,productionWrites:0,log}
 fs.writeFileSync(out+'/production-mfa-only-hold-postgres-tests.json',JSON.stringify(result,null,2)+'\n');console.log({passed:result.passed,tests:result.tests,pass:result.pass,fail:result.fail,exitCode:code});if(!unchanged)code=1
}finally{await cluster.stop().catch(()=>{});fs.rmSync(temporary,{recursive:true,force:true})}
process.exitCode=code
