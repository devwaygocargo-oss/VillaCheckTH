// Local-only operator repair regression tests. No credentials or live targets.
import fs from "node:fs";
import test, {after} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import childProcess from "node:child_process";
import {syncBuiltinESMExports} from "node:module";
import pg from "pg";

const externalCalls={fetch:0,process:0,database:0};
const originals={fetch:globalThis.fetch,execFileSync:childProcess.execFileSync,connect:pg.Client.prototype.connect};
globalThis.fetch=()=>{externalCalls.fetch++;throw Error("Live fetch forbidden in local repair tests")};
childProcess.execFileSync=()=>{externalCalls.process++;throw Error("Keychain/provider process forbidden in local repair tests")};
pg.Client.prototype.connect=function(){externalCalls.database++;throw Error("Live PostgreSQL forbidden in local repair tests")};
syncBuiltinESMExports();
after(()=>{globalThis.fetch=originals.fetch;childProcess.execFileSync=originals.execFileSync;pg.Client.prototype.connect=originals.connect;syncBuiltinESMExports();assert.deepEqual(externalCalls,{fetch:0,process:0,database:0})});

const {removeMfaOnlyHold,oldMfaHoldReason,retirementReference}=await import("./remove-current-mfa-only-hold.mjs");
const scope=JSON.parse(fs.readFileSync("docs/qa/evidence/production-test-accounts-20261028/scope.json"));
const actor=scope.actors.find(row=>row.role==="admin");
const operatorId="local-separate-operator";
const statusKey="account_status:"+actor.id,markerKey="production_internal_test_actor:"+actor.id;
// Reuse the application's actual DDL rather than modelling its audit contract.
const applicationDatabaseSource=fs.readFileSync(new URL("../server/database.mjs",import.meta.url),"utf8");
const auditDdl=applicationDatabaseSource.match(/CREATE TABLE IF NOT EXISTS audits\s*\([\s\S]*?\);/)?.[0];
assert(auditDdl,"The application's actual audits DDL is required");
assert.match(auditDdl,/actor_id TEXT NOT NULL REFERENCES users\(id\)/);

function fixture({intercept}={}){
 const sql=new DatabaseSync(":memory:");
 sql.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL,role TEXT NOT NULL,password_hash TEXT NOT NULL);
 CREATE TABLE system_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE business_sentinel(id TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 sql.exec(auditDdl);
 const insertUser=sql.prepare("INSERT INTO users VALUES (?,?,?,?)");
 for(const row of scope.actors)insertUser.run(row.id,row.email,row.role,"LOCAL_NON_CREDENTIAL_SENTINEL");
 insertUser.run(operatorId,"local-operator@fixture.invalid","admin","LOCAL_OPERATOR_SENTINEL");
 sql.prepare("INSERT INTO sessions VALUES (?,?,?)").run("LOCAL_EXISTING_SESSION_SENTINEL",actor.id,9999999999999);
 sql.prepare("INSERT INTO business_sentinel VALUES (?,?)").run("existing-business","KEEP_EXISTING_BUSINESS_BYTES");
 const set=(key,value)=>sql.prepare("INSERT INTO system_settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,JSON.stringify(value));
 set(statusKey,{status:"suspended",reason:oldMfaHoldReason,createdAt:"2026-10-28T00:00:00.000Z",preserveExtra:"KEEP_STATUS_METADATA"});
 set(markerKey,{reference:scope.reference,synthetic:true,internalAuthorized:true,mfaEnrollmentRequired:true,preserveExtra:"KEEP_MARKER_METADATA"});
 set("privileged_mfa:"+actor.id,{enabled:true,secret:"LOCAL_FACTOR_SENTINEL",recoveryHashes:["LOCAL_RECOVERY_SENTINEL"]});
 set("mfa_pending:"+actor.id,{secret:"LOCAL_PENDING_FACTOR_SENTINEL"});
 set("mfa_stepup:LOCAL_EXISTING_SESSION_SENTINEL",{userId:actor.id,until:9999999999999});
 set("account_status:unrelated-user",{status:"suspended",reason:"Security incident investigation"});
 // pg binds an undefined argument as SQL NULL; reflect that in the SQLite adapter.
 const parameters=args=>args.map(value=>value===undefined?null:value);
 const prepare=query=>({get:async(...args)=>sql.prepare(query).get(...parameters(args)),all:async(...args)=>sql.prepare(query).all(...parameters(args)),run:async(...args)=>{if(intercept){const result=intercept({query,args,sql});if(result!==undefined)return result}return sql.prepare(query).run(...parameters(args))}});
 const db={prepare,transaction:async work=>{sql.exec("BEGIN");try{const result=await work();sql.exec("COMMIT");return result}catch(error){sql.exec("ROLLBACK");throw error}}};
 const all=table=>sql.prepare("SELECT * FROM "+table+" ORDER BY 1").all().map(row=>({...row}));
 const snapshot=()=>Object.fromEntries(["users","system_settings","audits","sessions","business_sentinel"].map(table=>[table,all(table)]));
 const get=key=>JSON.parse(sql.prepare("SELECT value FROM system_settings WHERE key=?").get(key).value);
 return{db,sql,set,get,all,snapshot,close:()=>sql.close()};
}

test("import and eligible dry-run perform no external calls and no persistent writes",async()=>{
 assert.deepEqual(externalCalls,{fetch:0,process:0,database:0});
 const f=fixture();try{const before=f.snapshot();const result=await removeMfaOnlyHold(f.db,scope);assert.deepEqual(result,{state:"ELIGIBLE_MFA_ONLY_HOLD",actorId:actor.id,changedSettings:0,auditsAdded:0});assert.deepEqual(f.snapshot(),before)}finally{f.close()}
});

test("exact owned MFA-only repair changes two settings, audits the separate operator and is idempotent",async()=>{
 const f=fixture();try{
  const before=f.snapshot();const result=await removeMfaOnlyHold(f.db,scope,{execute:true,operatorId});
  assert.equal(result.state,"REPAIRED_MFA_ONLY_HOLD");assert.equal(result.changedSettings,2);assert.equal(result.auditsAdded,1);
  const status=f.get(statusKey),marker=f.get(markerKey);assert.equal(status.status,"active");assert.equal(status.mfaRetirement.reference,retirementReference);assert.equal(status.mfaRetirement.previousReason,oldMfaHoldReason);assert.equal(status.preserveExtra,"KEEP_STATUS_METADATA");assert.equal(marker.mfaEnrollmentRequired,false);assert.equal(marker.preserveExtra,"KEEP_MARKER_METADATA");assert.equal(marker.mfaRetirement.previousEnrollmentRequired,true);
  const changed=f.all("system_settings").filter(row=>before.system_settings.find(old=>old.key===row.key)?.value!==row.value);assert.deepEqual(changed.map(row=>row.key).sort(),[statusKey,markerKey].sort());
  const [audit]=f.all("audits");assert.equal(audit.actor_id,operatorId);assert.equal(audit.target_id,actor.id);assert.equal(audit.action,"operator.mfa_only_hold_removed");assert.equal(f.all("audits").length,1);
  const repaired=f.snapshot();const replay=await removeMfaOnlyHold(f.db,scope,{execute:true,operatorId});assert.equal(replay.state,"ALREADY_REPAIRED");assert.equal(replay.changedSettings,0);assert.equal(replay.auditsAdded,0);assert.deepEqual(f.snapshot(),repaired);
 }finally{f.close()}
});

test("generic or already-active security statuses cannot be cleared",async t=>{
 for(const value of [{status:"suspended",reason:"Security incident investigation"},{status:"active",reason:oldMfaHoldReason},{status:"suspended",reason:oldMfaHoldReason+" (unconfirmed)"}])await t.test(value.status+" / exact reason guard",async()=>{const f=fixture();try{f.set(statusKey,value);const before=f.snapshot();await assert.rejects(removeMfaOnlyHold(f.db,scope,{execute:true,operatorId}),/Refusing to clear/);assert.deepEqual(f.snapshot(),before)}finally{f.close()}});
});

test("identity or owned-marker mismatch rejects without writes",async t=>{
 const scenarios=[f=>f.sql.prepare("UPDATE users SET email=? WHERE id=?").run("different-owner@fixture.invalid",actor.id),f=>f.sql.prepare("UPDATE users SET role=? WHERE id=?").run("user",actor.id),f=>f.set(markerKey,{...f.get(markerKey),reference:"OTHER_REFERENCE"}),f=>f.set(markerKey,{...f.get(markerKey),synthetic:false}),f=>f.set(markerKey,{...f.get(markerKey),internalAuthorized:false})];
 for(const [index,alter]of scenarios.entries())await t.test("ownership guard "+(index+1),async()=>{const f=fixture();try{alter(f);const before=f.snapshot();await assert.rejects(removeMfaOnlyHold(f.db,scope,{execute:true,operatorId}),/identity mismatch|marker mismatch/);assert.deepEqual(f.snapshot(),before)}finally{f.close()}});
});

test("execute requires a distinct existing Admin operator",async t=>{
 for(const invalidId of [undefined,actor.id,scope.actors.find(row=>row.role==="user").id,"missing-operator"])await t.test(invalidId?"invalid operator":"missing operator",async()=>{const f=fixture();try{const before=f.snapshot();await assert.rejects(removeMfaOnlyHold(f.db,scope,{execute:true,operatorId:invalidId}),/separately verified existing application operator/);assert.deepEqual(f.snapshot(),before)}finally{f.close()}});
});

test("existing operator status is fail-closed unless explicitly active",async t=>{
 for(const scenario of [
  {name:"suspended operator",value:JSON.stringify({status:"suspended",reason:"Security investigation"})},
  {name:"unknown operator status",value:JSON.stringify({status:"unrecognized"})},
  {name:"missing operator status property",value:JSON.stringify({reason:"Unconfirmed"})},
  {name:"null operator status",value:"null"},
  {name:"corrupt operator status",value:"{not-json"},
 ])await t.test(scenario.name,async()=>{const f=fixture();try{
  f.sql.prepare("INSERT INTO system_settings VALUES (?,?)").run("account_status:"+operatorId,scenario.value);
  const before=f.snapshot();await assert.rejects(removeMfaOnlyHold(f.db,scope,{execute:true,operatorId}),/operator (?:must be active|status is invalid)/);assert.deepEqual(f.snapshot(),before);
 }finally{f.close()}});
 await t.test("explicitly active operator",async()=>{const f=fixture();try{f.set("account_status:"+operatorId,{status:"active"});const before=f.get("account_status:"+operatorId);const result=await removeMfaOnlyHold(f.db,scope,{execute:true,operatorId});assert.equal(result.state,"REPAIRED_MFA_ONLY_HOLD");assert.deepEqual(f.get("account_status:"+operatorId),before)}finally{f.close()}});
});

test("wrong environment, database or authorization reference cannot repair any row",async t=>{
 for(const altered of [{...scope,environment:"staging"},{...scope,target:{...scope.target,database:"another_database"}},{...scope,reference:"OTHER_REFERENCE"}])await t.test("exact target guard",async()=>{const f=fixture();try{const before=f.snapshot();await assert.rejects(removeMfaOnlyHold(f.db,altered,{execute:true,operatorId}));assert.deepEqual(f.snapshot(),before)}finally{f.close()}});
});

test("repair preserves user credentials/roles, factor data, existing sessions and business sentinels",async()=>{
 const f=fixture();try{const before=f.snapshot();await removeMfaOnlyHold(f.db,scope,{execute:true,operatorId});const after=f.snapshot();for(const table of ["users","sessions","business_sentinel"])assert.deepEqual(after[table],before[table]);const unchanged=rows=>rows.filter(row=>![statusKey,markerKey].includes(row.key));assert.deepEqual(unchanged(after.system_settings),unchanged(before.system_settings))}finally{f.close()}
});

test("a failed second compare-and-set rolls back the first update and leaves no audit",async()=>{
 let firstUpdateApplied=false;
 const f=fixture({intercept:({query,args,sql})=>{if(query.startsWith("UPDATE system_settings")){if(args[1]===statusKey){const result=sql.prepare(query).run(...args);firstUpdateApplied=true;return result}if(args[1]===markerKey)return{changes:0}}}});
 try{const before=f.snapshot();await assert.rejects(removeMfaOnlyHold(f.db,scope,{execute:true,operatorId}),/Identity marker changed concurrently/);assert.equal(firstUpdateApplied,true);assert.deepEqual(f.snapshot(),before)}finally{f.close()}
});

test("real audit constraint failures roll back both settings",async t=>{
 for(const invalidActor of [null,"missing-foreign-key-actor"])await t.test(invalidActor===null?"NOT NULL actor":"foreign-key actor",async()=>{
  const f=fixture({intercept:({query,args,sql})=>{if(query.startsWith("INSERT INTO audits"))return sql.prepare(query).run(args[0],invalidActor,...args.slice(2))}});
  try{const before=f.snapshot();await assert.rejects(removeMfaOnlyHold(f.db,scope,{execute:true,operatorId}),invalidActor===null?/NOT NULL constraint failed: audits.actor_id/:/FOREIGN KEY constraint failed/);assert.deepEqual(f.snapshot(),before)}finally{f.close()}
 });
});
