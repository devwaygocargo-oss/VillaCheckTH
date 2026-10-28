import {createHash} from 'node:crypto'
import {audit} from './database.mjs'
const digest=value=>createHash('sha256').update(value).digest('hex')
const fail=()=>{throw Object.assign(Error('การยืนยันบัญชีหมดอายุหรือข้อมูลเข้าสู่ระบบเปลี่ยนแล้ว กรุณายืนยันใหม่'),{status:403})}
const read=async(db,key)=>{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);return row?JSON.parse(row.value):null}
const save=(db,key,value)=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value))
const proofKey=actor=>'customer_oauth_stepup:'+actor.token_hash
export const customerOAuthBindingKey=stateHash=>'customer_oauth_flow:'+stateHash
// Caller serializes this snapshot with the action it authorizes. No subject,
// credential fingerprint, session hash or proof is returned by the public API.
export async function customerOAuthSnapshot(db,actor){
 if(!actor||!['user','merchant'].includes(actor.role)||!actor.id||! /^[a-f0-9]{64}$/.test(actor.token_hash||''))fail()
 const lock=db.dialect==='postgres'?' FOR UPDATE':''
 const current=await db.prepare('SELECT id,email,role,password_hash FROM users WHERE id=?'+lock).get(actor.id)
 const session=await db.prepare('SELECT expires FROM sessions WHERE token_hash=? AND user_id=?'+lock).get(actor.token_hash,actor.id)
 const access=await read(db,'account_status:'+actor.id)
 if(!current||current.role!==actor.role||current.email!==actor.email||!session||Number(session.expires)<=Date.now()||access?.status==='suspended')fail()
 const identities=await db.prepare('SELECT provider,subject FROM oauth_identities WHERE user_id=? ORDER BY provider,subject').all(actor.id)
 const binding={actorId:current.id,session:actor.token_hash,role:current.role,account:digest(current.id+'\n'+current.email+'\n'+current.role),credential:digest(current.password_hash),identities:digest(JSON.stringify(identities))}
 return {current,identities,binding}
}
const same=(actual,expected)=>['actorId','session','role','account','credential','identities'].every(key=>actual?.[key]===expected?.[key])
export async function assertCustomerOAuthBinding(db,actor,expected){const snapshot=await customerOAuthSnapshot(db,actor);if(!same(snapshot.binding,expected))fail();return snapshot}
export async function prepareCustomerOAuthFlow(db,actor,provider,action){
 const snapshot=await customerOAuthSnapshot(db,actor)
 if(action==='reauth'){
  if(!['google','line'].includes(provider)||!snapshot.identities.some(row=>row.provider===provider))fail()
 }else if(action==='link'){
  if(actor.oauthCredentialHash){if(snapshot.current.password_hash!==actor.oauthCredentialHash)fail()}
  else await consumeCustomerOAuthProof(db,actor,'link-provider')
 }else fail()
 const purpose=actor.oauthReauthPurpose||'link-provider';if(!['link-provider','password','logout-all'].includes(purpose))fail();return {action,provider,purpose,binding:snapshot.binding,startedAt:Date.now(),expires:Date.now()+600000}
}
export async function recordCustomerOAuthProof(db,actor,flow,provider,subject){
 const snapshot=await assertCustomerOAuthBinding(db,actor,flow.binding)
 if(flow.action!=='reauth'||flow.provider!==provider||!snapshot.identities.some(row=>row.provider===provider&&row.subject===subject))fail()
 await save(db,proofKey(actor),{binding:snapshot.binding,provider,purpose:flow.purpose,expires:Date.now()+300000})
 await audit(db,actor,'account.oauth_provider_verified',actor.id)
}
export async function customerOAuthStatus(db,actor){
 const snapshot=await customerOAuthSnapshot(db,actor),proof=await read(db,proofKey(actor))
 const purpose=proof&&proof.expires>Date.now()&&same(snapshot.binding,proof.binding)&&['link-provider','password','logout-all'].includes(proof.purpose)?proof.purpose:null;return {providers:snapshot.identities.filter(row=>['google','line'].includes(row.provider)).map(row=>row.provider),providerVerificationReady:purpose==='link-provider',providerVerificationPurpose:purpose}
}
export const saveCustomerOAuthFlow=(db,stateHash,flow)=>save(db,customerOAuthBindingKey(stateHash),flow)
export const consumeCustomerOAuthFlow=async(db,stateHash)=>{const row=await db.prepare('DELETE FROM system_settings WHERE key=? RETURNING value').get(customerOAuthBindingKey(stateHash));return row?JSON.parse(row.value):null}

// Opportunistic disposal is restricted to expired authentication sidecars. It
// is not a retention or deletion policy for accounts, audits or business data.
export async function cleanupCustomerOAuthTransient(db){
 const expiry=db.dialect==='postgres'?"(value::jsonb->>'expires')::numeric":"json_extract(value,'$.expires')"
 const rows=await db.prepare("SELECT key FROM system_settings WHERE (key LIKE 'customer!_oauth!_flow:%' ESCAPE '!' OR key LIKE 'customer!_oauth!_stepup:%' ESCAPE '!') AND "+expiry+"<=? ORDER BY key LIMIT 32").all(Date.now())
 for(const row of rows)if(row.key.startsWith('customer_oauth_flow:')||row.key.startsWith('customer_oauth_stepup:'))await db.prepare('DELETE FROM system_settings WHERE key=?').run(row.key)
}

// Purpose is chosen from a server allowlist at provider reauthentication. The
// caller consumes this inside the transaction committing its sensitive action.
export async function consumeCustomerOAuthProof(db,actor,purpose){
 if(!['link-provider','password','logout-all'].includes(purpose))fail()
 const snapshot=await customerOAuthSnapshot(db,actor),row=await db.prepare('DELETE FROM system_settings WHERE key=? RETURNING value').get(proofKey(actor)),proof=row?JSON.parse(row.value):null
 if(!proof||proof.purpose!==purpose||proof.expires<=Date.now()||!same(snapshot.binding,proof.binding))fail()
 return snapshot
}
