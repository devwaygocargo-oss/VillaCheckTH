import fs from 'node:fs';
import assert from 'node:assert/strict';
import {mfaDatabase,mfaOut} from './mfa-current-context.mjs';
const mode=process.argv[2]||'before';assert(['before','after'].includes(mode));fs.mkdirSync(mfaOut,{recursive:true});
const scope=JSON.parse(fs.readFileSync('docs/qa/evidence/production-test-accounts-20261028/scope.json'));
const holdReason='Pending owner MFA enrollment on verified security release; do not activate with password alone';
const results=[];
for(const environment of ['staging','production']){
 const db=await mfaDatabase(environment);
 try{
  await db.exec('BEGIN READ ONLY');
  const identity=await db.prepare("SELECT current_database() database,current_schema() schema,current_user role,current_setting('transaction_read_only') read_only").get();assert.equal(identity.database,environment==='staging'?'neondb':'villacheck_production');assert.equal(identity.read_only,'on');
  const roles=await db.prepare('SELECT role,count(*)::int AS count FROM users GROUP BY role ORDER BY role').all();
  const statusRows=await db.prepare("SELECT s.key,s.value,u.id,u.role,u.email FROM system_settings s JOIN users u ON s.key='account_status:'||u.id").all();
  const statusSummary=statusRows.map(row=>{const state=JSON.parse(row.value),actor=scope.actors.find(a=>a.id===row.id&&a.role===row.role&&a.email===row.email);return {id:row.id,role:row.role,status:state.status,exactMfaOnlyHold:state.status==='suspended'&&state.reason===holdReason,authorizedInternalActor:environment==='production'&&Boolean(actor)}});
  const factors=await db.prepare("SELECT count(*)::int AS count,md5(coalesce(string_agg(key||value,'' ORDER BY key),'')) AS digest FROM system_settings WHERE key LIKE 'privileged_mfa:%' OR key LIKE 'mfa_%'").get();
  const tables={};for(const table of ['users','villas','documents','leads','subscriptions','invoices','mails']){const expr=table==='users'?"(to_jsonb(t)-'last_login')::text":'to_jsonb(t)::text';tables[table]=await db.prepare('SELECT count(*)::int AS count,md5(coalesce(string_agg('+expr+",'' ORDER BY "+expr+"),'')) AS digest FROM "+table+' t').get()}
  const sessions=await db.prepare('SELECT md5(to_jsonb(t)::text) AS digest FROM sessions t ORDER BY digest').all();
  const actorMetadata=[];if(environment==='production')for(const actor of scope.actors){const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('production_internal_test_actor:'+actor.id);const value=row?JSON.parse(row.value):null;actorMetadata.push({id:actor.id,ownedMarkerMatches:Boolean(value?.reference===scope.reference&&value?.internalAuthorized===true&&value?.synthetic===true),mfaEnrollmentRequired:value?.mfaEnrollmentRequired===true})}
  await db.exec('ROLLBACK');
  const configResponse=await fetch('https://'+(environment==='staging'?'design-villacheck.vercel.app':'www.villacheckth.com')+'/api/config',{redirect:'manual',signal:AbortSignal.timeout(30000)});let publicConfig=null;if(configResponse.status===200)publicConfig=await configResponse.json();
  const result={at:new Date().toISOString(),environment,identity,roles,statusSummary,factors,tables,sessions,actorMetadata,anonymousConfigStatus:configResponse.status,publicConfig,readOnly:true,businessWrites:0};
  if(mode==='after'){const before=JSON.parse(fs.readFileSync(mfaOut+'/'+environment+'-before.json'));assert.deepEqual(tables,before.tables);assert.deepEqual(factors,before.factors);for(const session of before.sessions)assert(sessions.some(s=>s.digest===session.digest),'Existing session was modified or removed');result.existingUsersBusinessFactorsAndSessionsPreserved=true;}
  fs.writeFileSync(mfaOut+'/'+environment+'-'+mode+'.json',JSON.stringify(result,null,2)+'\n');results.push({environment,roles,mfaOnlyHolds:statusSummary.filter(s=>s.exactMfaOnlyHold).length,otherSuspensions:statusSummary.filter(s=>s.status==='suspended'&&!s.exactMfaOnlyHold).length,factorRows:factors.count,users:tables.users.count,villas:tables.villas.count,documents:tables.documents.count,anonymousConfigStatus:configResponse.status});
 }finally{await db.close()}
}
console.log({readOnly:true,mode,results});
