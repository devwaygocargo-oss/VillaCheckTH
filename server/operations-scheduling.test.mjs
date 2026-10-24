import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {promisify} from 'node:util'
import {execFile} from 'node:child_process'
import {mkdtempSync,writeFileSync,utimesSync,readdirSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {openTestDatabase} from './test-database.mjs'
const run=promisify(execFile)
test('Health monitoring reports failures without leaking provider credentials',async t=>{
 let failed=false;const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.statusCode=!failed&&req.url.includes('packages')?401:200;res.end(JSON.stringify(failed?{}:req.url.includes('health')?{ok:true}:req.url.includes('cms')?{content:{}}:{error:'Sign in'}))});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)))
 const env={...process.env,PUBLIC_URL:`http://127.0.0.1:${server.address().port}`,ALERT_WEBHOOK_URL:''}
 assert.equal(JSON.parse((await run(process.execPath,['scripts/operations-check.mjs'],{env})).stdout).ok,true)
 failed=true
 await assert.rejects(run(process.execPath,['scripts/operations-check.mjs'],{env}),e=>e.code===1&&JSON.parse(e.stdout).failed.length===3)
})
test('Scheduled encrypted backup retains prior archive on failure and prunes old archives only after success',{skip:!process.env.TEST_DATABASE_URL},async t=>{
 const db=await openTestDatabase();t.after(()=>db.close());const dir=mkdtempSync('/private/tmp/villacheck-scheduled-backup-'),old=join(dir,'villacheck-2020-01-01T00-00-00-000Z.vcb');writeFileSync(old,'old protected archive');utimesSync(old,1,1)
 const schema=new URL(db.testConnectionString).searchParams.get('options').split('search_path=')[1]
 const env={...process.env,BACKUP_DATABASE_URL:db.testConnectionString,BACKUP_SCHEMA:schema,BACKUP_DIR:dir,BACKUP_RETENTION_DAYS:'30',BACKUP_SECRET:'Dummy backup password with at least 32 characters'}
 await assert.rejects(run(process.execPath,['scripts/scheduled-backup.mjs'],{env:{...env,BACKUP_SECRET:'short'}}));assert.ok(existsSync(old))
 const r=await run(process.execPath,['scripts/scheduled-backup.mjs'],{env});assert.equal(JSON.parse(r.stdout).ok,true);assert.equal(existsSync(old),false);assert.equal(readdirSync(dir).filter(x=>x.endsWith('.vcb')).length,1)
})

test('Alert delivery requires a successful webhook response and never reports HTTP rejection as accepted',async()=>{
 const {checkOperations}=await import('../scripts/operations-check.mjs')
 for(const [status,expected]of [[202,'accepted'],[401,'failed'],[500,'failed']]){
  const result=await checkOperations({origin:'https://dummy.test',alertUrl:'https://alert.test/private-secret',fetchImpl:async(url,opts)=>opts?.method==='POST'?{ok:status===202,status}:{ok:false,json:async()=>({})}})
  assert.equal(result.ok,false);assert.equal(result.alert,expected);assert.ok(!JSON.stringify(result).includes('private-secret'))
 }
 await assert.rejects(checkOperations({origin:'http://127.0.0.1.attacker.test'}),/HTTPS/)
})
