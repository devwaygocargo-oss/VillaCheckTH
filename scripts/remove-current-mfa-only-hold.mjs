// Narrow operator repair for the already-provisioned, owned internal Admin.
// Generic suspensions, users, credentials, roles, factors and sessions are untouched.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {audit} from '../server/database.mjs';
import {mfaDatabase,mfaOut} from './mfa-current-context.mjs';
import {keychain} from './production-internal-context.mjs';
export const oldMfaHoldReason='Pending owner MFA enrollment on verified security release; do not activate with password alone';
export const retirementReference='REMOVE_MFA_CURRENT_PHASE_20261029';
export async function removeMfaOnlyHold(db,scope,{execute=false,operatorId}={}){
 assert.equal(scope.environment,'production');assert.equal(scope.target.database,'villacheck_production');assert.equal(scope.reference,'owner-production-internal-accounts-20261028-8a6c00cf');
 const actor=scope.actors.find(row=>row.id==='c68dfe2e-465e-4a7f-af9e-f49f966cddbb'&&row.role==='admin');assert(actor);
 return db.transaction(async()=>{
  const user=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(actor.id);assert(user&&user.email===actor.email&&user.role===actor.role,'Existing owned Admin identity mismatch');
  const statusKey='account_status:'+actor.id,markerKey='production_internal_test_actor:'+actor.id;
  const statusRow=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(statusKey),markerRow=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(markerKey);assert(statusRow&&markerRow);
  const status=JSON.parse(statusRow.value),marker=JSON.parse(markerRow.value);assert(marker.reference===scope.reference&&marker.synthetic===true&&marker.internalAuthorized===true,'Owned internal identity marker mismatch');
  if(status.status==='active'&&status.mfaRetirement?.reference===retirementReference){assert.equal(marker.mfaEnrollmentRequired,false);return {state:'ALREADY_REPAIRED',actorId:actor.id,changedSettings:0,auditsAdded:0}}
  assert(status.status==='suspended'&&status.reason===oldMfaHoldReason,'Refusing to clear a generic or security-related suspension');
  if(!execute)return {state:'ELIGIBLE_MFA_ONLY_HOLD',actorId:actor.id,changedSettings:0,auditsAdded:0};
  const operator=await db.prepare('SELECT id,role FROM users WHERE id=?').get(operatorId);assert(operator?.role==='admin'&&operator.id!==actor.id,'A separately verified existing application operator is required');
  const operatorStatusRow=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+operator.id);
  if(operatorStatusRow){let operatorStatus;try{operatorStatus=JSON.parse(operatorStatusRow.value)}catch{assert.fail('Existing application operator status is invalid')};assert(operatorStatus&&operatorStatus.status==='active','Existing application operator must be active')}
  const at=new Date().toISOString(),nextStatus={...status,status:'active',reason:'MFA-only enrollment hold removed for the current development phase',updatedAt:at,mfaRetirement:{reference:retirementReference,at,previousStatus:status.status,previousReason:status.reason}},nextMarker={...marker,mfaEnrollmentRequired:false,mfaRetirement:{reference:retirementReference,at,previousEnrollmentRequired:marker.mfaEnrollmentRequired===true}};
  const statusChange=await db.prepare('UPDATE system_settings SET value=? WHERE key=? AND value=?').run(JSON.stringify(nextStatus),statusKey,statusRow.value);assert.equal(statusChange.changes,1,'Account status changed concurrently');
  const markerChange=await db.prepare('UPDATE system_settings SET value=? WHERE key=? AND value=?').run(JSON.stringify(nextMarker),markerKey,markerRow.value);assert.equal(markerChange.changes,1,'Identity marker changed concurrently');
  await audit(db,{id:operator.id},'operator.mfa_only_hold_removed',actor.id);
  return {state:'REPAIRED_MFA_ONLY_HOLD',actorId:actor.id,changedSettings:2,auditsAdded:1,usersPasswordsRolesFactorsSessionsOrBusinessRowsChanged:0};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const execute=process.argv.includes('--execute'),scope=JSON.parse(fs.readFileSync('docs/qa/evidence/production-test-accounts-20261028/scope.json')),db=await mfaDatabase('production');
 try{let operatorId;if(execute){
  const manifest=JSON.parse(fs.readFileSync('reports/property-gallery/production-manifest.json')),file='server/database.mjs',bytes=fs.readFileSync(manifest.artifact+'/'+file);assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.files.find(f=>f.file===file).sha256);
  const {verifyPasswordAsync}=await import(pathToFileURL(manifest.artifact+'/'+file));const credential=keychain('com.villacheck.production.green-sun-56847773.application-admin','initial-admin');
  const row=await db.prepare('SELECT id,role,password_hash FROM users WHERE email=?').get(credential.email.toLowerCase());assert.equal(row?.role,'admin');assert(await verifyPasswordAsync(credential.password,row.password_hash),'Existing application operator authentication failed');operatorId=row.id;
 }
 const result=await removeMfaOnlyHold(db,scope,{execute,operatorId});fs.mkdirSync(mfaOut,{recursive:true});fs.writeFileSync(mfaOut+'/production-mfa-only-hold-'+(execute?'repair':'preflight')+'.json',JSON.stringify({at:new Date().toISOString(),...result,noNewAccounts:true,noBusinessWrites:true,noProviderCalls:true,preservesHistoricalReason:true,existingOperatorVerified:execute},null,2)+'\n');console.log(result)}finally{await db.close()}
}
