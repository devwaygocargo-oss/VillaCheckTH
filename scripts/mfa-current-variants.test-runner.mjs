// The deployed Stage/Production source variants stay separate. Local PostgreSQL only.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {randomBytes,createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'

const out='docs/releases/evidence/remove-mfa-current-20261029';fs.mkdirSync(out,{recursive:true})
const variants=[{environment:'staging',manifest:'docs/reports/16-requirements-evidence/staging-manifest.json'},{environment:'production',manifest:'reports/property-gallery/production-manifest.json'}]
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),helperOriginal=fs.readFileSync('server/test-database.mjs','utf8'),test='scripts/no-mfa-independent-security-20261029.test.mjs',testSha=sha(fs.readFileSync(test)),temporary=fs.mkdtempSync('/tmp/vc-mfa-variants-pg-'),rows=[]
fs.symlinkSync(path.resolve('node_modules'),temporary+'/node_modules')
fs.writeFileSync(temporary+'/loopback-only.mjs',"const native=globalThis.fetch;globalThis.fetch=(input,options={})=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('Frozen variant regressions permit loopback HTTP only');return native(input,{...options,signal:options.signal||AbortSignal.timeout(10000)})};\n")
const reserve=createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
const password=randomBytes(24).toString('hex'),cluster=new EmbeddedPostgres({databaseDir:temporary+'/data',user:'postgres',password,port,persistent:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}})
let code=0
try{
 await cluster.initialise();await cluster.start()
 for(const variant of variants){
  const manifestPath=path.resolve(variant.manifest),m=JSON.parse(fs.readFileSync(manifestPath)),verify=()=>{for(const file of m.files)assert.equal(sha(fs.readFileSync(m.artifact+'/'+file.file)),file.sha256,'Frozen variant changed: '+file.file)};verify()
  const helper=temporary+'/'+variant.environment+'-test-database.mjs',bound=helperOriginal.replace('from "./database.mjs"','from '+JSON.stringify(pathToFileURL(m.artifact+'/server/database.mjs').href)).replace('from "./postgres.mjs"','from '+JSON.stringify(pathToFileURL(m.artifact+'/server/postgres.mjs').href))
  assert(!bound.includes('from "./database.mjs"')&&!bound.includes('from "./postgres.mjs"'));fs.writeFileSync(helper,bound)
  const env={...process.env,TEST_DATABASE_URL:'postgresql://postgres:'+password+'@127.0.0.1:'+port+'/postgres',APP_ENV:'test',NODE_ENV:'test'}
  for(const key of Object.keys(env))if(/^(?:SMTP_|THAIBULKSMS_|GOOGLE_CLIENT_|LINE_CHANNEL_|FACEBOOK_APP_|DATABASE_URL|DIRECT_URL|VillaCheck_|VILLACHECK_|AUTH_TEST_|COMPOSE_TEST_|PHASE1_|CURRENT_PHASE_|CUSTOMER_AUTH_|CUSTOMER_OAUTH_|VERCEL|AWS_LAMBDA_|PROVIDER_CONFIGURATION_STAGED)/.test(key))delete env[key]
  env.AUTH_TEST_CANDIDATE_MANIFEST=manifestPath;env.COMPOSE_TEST_DATABASE_HELPER=pathToFileURL(helper).href
  const log=out+'/'+variant.environment+'-frozen-independent-security.log',fd=fs.openSync(log,'w'),child=spawn(process.execPath,['--import',temporary+'/loopback-only.mjs','--test','--test-concurrency=1',test],{env,stdio:['ignore',fd,fd]})
  const exitCode=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject)});fs.closeSync(fd);verify();assert.equal(sha(fs.readFileSync(test)),testSha,'Independent test source changed')
  const text=fs.readFileSync(log,'utf8'),count=label=>Number(text.match(new RegExp('ℹ '+label+' (\\d+)'))?.[1]),row={environment:variant.environment,manifest:variant.manifest,sourceDigest:m.sourceDigest,commit:m.commit||null,artifact:m.artifact,sourceFilesVerified:m.files.length,actualCandidateImports:true,dirtyRootRuntimeImported:false,test,testSha256:testSha,helperOriginalSha256:sha(helperOriginal),helperBoundSha256:sha(bound),helperDatabaseAndPostgresImportsFromArtifact:true,tests:count('tests'),pass:count('pass'),fail:count('fail'),skip:count('skipped'),exitCode,passed:exitCode===0&&count('tests')===7&&count('pass')===7,disposableLoopbackPostgreSQL:true,externalHttpBlocked:true,providerCredentialsCleared:true,envFileRead:false,liveDatabaseConnections:0,liveProviderRequests:0,log}
  rows.push(row);fs.writeFileSync(out+'/'+variant.environment+'-frozen-independent-security.json',JSON.stringify({at:new Date().toISOString(),...row},null,2)+'\n');console.log({environment:variant.environment,tests:row.tests,pass:row.pass,fail:row.fail,passed:row.passed});if(!row.passed)code=1
 }
}finally{await cluster.stop().catch(()=>{});fs.rmSync(temporary,{recursive:true,force:true});fs.writeFileSync(out+'/frozen-variants-independent-security.json',JSON.stringify({at:new Date().toISOString(),passed:code===0&&rows.length===2&&rows.every(row=>row.passed),rows,temporaryClusterRemoved:!fs.existsSync(temporary),productionConnections:0,providerRequests:0,sourceChanges:0},null,2)+'\n')}
process.exitCode=code
