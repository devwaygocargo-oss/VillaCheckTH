// Actual application PostgreSQL schema, disposable loopback database only.
import fs from 'node:fs'
import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import childProcess from 'node:child_process'
import {syncBuiltinESMExports} from 'node:module'
import pg from 'pg'
import {openTestDatabase} from '../server/test-database.mjs'
import {createUser} from '../server/database.mjs'

assert(process.env.TEST_DATABASE_URL,'Disposable PostgreSQL is required')
assert(['127.0.0.1','localhost','[::1]'].includes(new URL(process.env.TEST_DATABASE_URL).hostname))
const attempts={fetch:0,process:0,externalDatabase:0},original={fetch:globalThis.fetch,execFileSync:childProcess.execFileSync,connect:pg.Client.prototype.connect}
globalThis.fetch=()=>{attempts.fetch++;throw Error('No external HTTP is allowed in hold-repair tests')}
childProcess.execFileSync=()=>{attempts.process++;throw Error('No operator/keychain/provider process is allowed in hold-repair tests')}
pg.Client.prototype.connect=function(...args){if(!['127.0.0.1','localhost','::1','[::1]'].includes(this.connectionParameters.host)){attempts.externalDatabase++;throw Error('Only disposable loopback PostgreSQL is allowed')}return original.connect.apply(this,args)}
syncBuiltinESMExports()
after(()=>{globalThis.fetch=original.fetch;childProcess.execFileSync=original.execFileSync;pg.Client.prototype.connect=original.connect;syncBuiltinESMExports();assert.deepEqual(attempts,{fetch:0,process:0,externalDatabase:0})})
const {removeMfaOnlyHold,oldMfaHoldReason,retirementReference}=await import('./remove-current-mfa-only-hold.mjs')
const scope=JSON.parse(fs.readFileSync('docs/qa/evidence/production-test-accounts-20261028/scope.json')),actor=scope.actors.find(row=>row.role==='admin')
const statusKey='account_status:'+actor.id,markerKey='production_internal_test_actor:'+actor.id
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')

async function fixture(t){
 const db=await openTestDatabase();t.after(()=>db.close())
 for(const row of scope.actors)await createUser(db,row.email,'LOCAL_DISPOSABLE_NOT_A_LIVE_CREDENTIAL',row.name,row.role,{id:row.id})
 const operatorId=randomUUID();await createUser(db,'operator-'+operatorId+'@local.invalid','LOCAL_DISPOSABLE_OPERATOR_CREDENTIAL','LOCAL Operator','admin',{id:operatorId})
 await db.prepare('INSERT INTO sessions(token_hash,user_id,csrf,expires) VALUES (?,?,?,?)').run('LOCAL_RETAINED_SESSION',actor.id,'LOCAL_RETAINED_CSRF',9999999999999)
 const set=(key,value)=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value))
 await set(statusKey,{status:'suspended',reason:oldMfaHoldReason,createdAt:'2026-10-28T00:00:00.000Z',preserveExtra:'KEEP_STATUS_METADATA'})
 await set(markerKey,{reference:scope.reference,synthetic:true,internalAuthorized:true,mfaEnrollmentRequired:true,preserveExtra:'KEEP_MARKER_METADATA'})
 await set('privileged_mfa:'+actor.id,{enabled:true,secret:'LOCAL_ENCRYPTED_FACTOR_SENTINEL',recoveryHashes:['LOCAL_FACTOR_SENTINEL']})
 await set('mfa_pending:'+actor.id,{secret:'LOCAL_PENDING_FACTOR_SENTINEL'})
 await set('account_status:unrelated-user',{status:'suspended',reason:'Security incident investigation'})
 const rows=async table=>(await db.prepare('SELECT row_to_json(t)::text AS row FROM '+table+' t').all()).map(row=>row.row).sort()
 const snapshot=async()=>Object.fromEntries(await Promise.all(['users','sessions','villas','documents','leads','subscriptions','invoices','mails','audits','system_settings'].map(async table=>[table,digest(await rows(table))])))
 const get=async key=>JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key)).value)
 const columns=(await db.prepare("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='audits' ORDER BY ordinal_position").all()).map(row=>row.column_name)
 assert.deepEqual(columns,['id','actor_id','action','target_id','created'],'Use the actual application audit contract')
 return{db,operatorId,set,get,snapshot,rows}
}

test('PostgreSQL dry-run uses real application DDL and changes no persistent row',async t=>{
 const f=await fixture(t),before=await f.snapshot(),result=await removeMfaOnlyHold(f.db,scope)
 assert.equal(result.state,'ELIGIBLE_MFA_ONLY_HOLD');assert.equal(result.changedSettings,0);assert.deepEqual(await f.snapshot(),before)
})

test('PostgreSQL repair changes exactly two settings and one existing-contract audit, then reruns idempotently',async t=>{
 const f=await fixture(t),before=await f.snapshot(),settings=await f.db.prepare('SELECT key,value FROM system_settings ORDER BY key').all(),result=await removeMfaOnlyHold(f.db,scope,{execute:true,operatorId:f.operatorId})
 assert.equal(result.state,'REPAIRED_MFA_ONLY_HOLD');assert.equal(result.changedSettings,2);assert.equal(result.auditsAdded,1)
 const after=await f.snapshot();for(const table of Object.keys(before).filter(table=>!['audits','system_settings'].includes(table)))assert(after[table]===before[table],table+' must remain unchanged')
 const current=await f.db.prepare('SELECT key,value FROM system_settings ORDER BY key').all(),changed=current.filter(row=>settings.find(previous=>previous.key===row.key)?.value!==row.value).map(row=>row.key).sort()
 assert.deepEqual(changed,[statusKey,markerKey].sort())
 const status=await f.get(statusKey),marker=await f.get(markerKey);assert.equal(status.status,'active');assert.equal(status.mfaRetirement.reference,retirementReference);assert.equal(status.mfaRetirement.previousReason,oldMfaHoldReason);assert.equal(status.preserveExtra,'KEEP_STATUS_METADATA');assert.equal(marker.mfaEnrollmentRequired,false);assert.equal(marker.preserveExtra,'KEEP_MARKER_METADATA')
 const audits=await f.db.prepare('SELECT actor_id,action,target_id FROM audits').all();assert.equal(audits.length,1);assert.deepEqual(audits[0],{actor_id:f.operatorId,action:'operator.mfa_only_hold_removed',target_id:actor.id})
 const second=await removeMfaOnlyHold(f.db,scope,{execute:true,operatorId:f.operatorId});assert.equal(second.state,'ALREADY_REPAIRED');assert.equal(second.changedSettings,0);assert.equal(second.auditsAdded,0);assert.deepEqual(await f.snapshot(),after)
})

test('PostgreSQL refuses a generic security suspension without any row changes',async t=>{
 const f=await fixture(t);await f.set(statusKey,{status:'suspended',reason:'Security incident investigation'})
 const before=await f.snapshot();await assert.rejects(removeMfaOnlyHold(f.db,scope,{execute:true,operatorId:f.operatorId}),/Refusing to clear a generic/);assert.deepEqual(await f.snapshot(),before)
})

test('PostgreSQL rolls back the first setting when the second compare-and-set fails',async t=>{
 const f=await fixture(t),before=await f.snapshot(),wrapped={...f.db,prepare(sql){const operation=f.db.prepare(sql);if(sql.startsWith('UPDATE system_settings SET value='))return{...operation,run:async(...args)=>args[1]===markerKey?{changes:0}:operation.run(...args)};return operation}}
 await assert.rejects(removeMfaOnlyHold(wrapped,scope,{execute:true,operatorId:f.operatorId}),/Identity marker changed concurrently/);assert.deepEqual(await f.snapshot(),before)
})

test('PostgreSQL audit-constraint failure rolls back both setting updates',async t=>{
 const f=await fixture(t);await f.db.exec("ALTER TABLE audits ADD CONSTRAINT local_reject_hold_audit CHECK (action<>'operator.mfa_only_hold_removed')")
 const before=await f.snapshot();await assert.rejects(removeMfaOnlyHold(f.db,scope,{execute:true,operatorId:f.operatorId}),error=>error.code==='23514');assert.deepEqual(await f.snapshot(),before)
})

test('PostgreSQL rejects a suspended or self-bound operator without changing the owned account',async t=>{
 const f=await fixture(t);let before=await f.snapshot();await assert.rejects(removeMfaOnlyHold(f.db,scope,{execute:true,operatorId:actor.id}),/separately verified/);assert.deepEqual(await f.snapshot(),before)
 await f.set('account_status:'+f.operatorId,{status:'suspended',reason:'LOCAL_OTHER_SECURITY_HOLD'});before=await f.snapshot();await assert.rejects(removeMfaOnlyHold(f.db,scope,{execute:true,operatorId:f.operatorId}),/must be active/);assert.deepEqual(await f.snapshot(),before)
})
