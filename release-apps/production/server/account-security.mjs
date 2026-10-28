import {consumeCustomerOAuthProof} from "./customer-oauth-security.mjs";
import {audit,hashPassword,verifyPasswordAsync} from './database.mjs'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}

// The caller must authenticate the session, enforce origin/CSRF and rate-limit.
// No identity or role supplied by the client selects the account being changed.
export async function secureAccountOperation(db,actor,action,data){
 if(!['password','logout-all'].includes(action))fail(404,'ไม่พบคำสั่งความปลอดภัย')
 const passwordVerification=typeof data?.currentPassword==='string'&&data.currentPassword.length>0
 if(passwordVerification&&data.currentPassword.length>128)fail(400,'กรุณาระบุรหัสผ่านปัจจุบัน')
 const account=await db.prepare('SELECT id,password_hash FROM users WHERE id=?').get(actor.id)
 if(!account)fail(403,'ไม่พบบัญชีที่ต้องการยืนยัน')
 if(passwordVerification&&!await verifyPasswordAsync(data.currentPassword,account.password_hash)){
  await audit(db,actor,'account.reauthentication_failed',actor.id)
  fail(403,'ยืนยันรหัสผ่านปัจจุบันไม่สำเร็จ')
 }
 if(!passwordVerification&&!['user','merchant'].includes(actor.role))fail(403,'กรุณายืนยันด้วยวิธีที่อนุญาตสำหรับบัญชีนี้')
 let replacement
 if(action==='password'){
  if(typeof data.newPassword!=='string'||data.newPassword.length<10||data.newPassword.length>128)fail(400,'รหัสผ่านใหม่ต้องมี 10–128 ตัวอักษร')
  if(data.newPassword===data.currentPassword)fail(400,'กรุณาใช้รหัสผ่านใหม่ที่ต่างจากเดิม')
  if(!passwordVerification&&await verifyPasswordAsync(data.newPassword,account.password_hash))fail(400,'กรุณาใช้รหัสผ่านใหม่ที่ต่างจากเดิม')
  replacement=hashPassword(data.newPassword)
 }
 return db.transaction(async()=>{
  if(!passwordVerification)await consumeCustomerOAuthProof(db,actor,action)
  // Recheck after the expensive KDF: a parallel password change must not allow
  // the old credential to overwrite the winner or authorize a later action.
  const current=await db.prepare('SELECT password_hash FROM users WHERE id=?').get(actor.id)
  if(!current||current.password_hash!==account.password_hash)fail(409,'ข้อมูลเข้าสู่ระบบเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่')
  const access=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+actor.id)
  if(access&&JSON.parse(access.value).status==='suspended')fail(403,'บัญชีถูกระงับการเข้าสู่ระบบ กรุณาติดต่อผู้ดูแล')
  if(actor.token_hash){
   const session=await db.prepare('SELECT expires FROM sessions WHERE token_hash=? AND user_id=?').get(actor.token_hash,actor.id)
   if(!session||Number(session.expires)<=Date.now())fail(401,'การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่')
  }
  if(replacement)await db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(replacement,actor.id)
  // Expiration preserves session evidence and revokes both portal sessions for
  // this account without touching another account or ownership relationships.
  await db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(actor.id)
  await audit(db,actor,action==='password'?'account.password_changed':'account.sessions_revoked',actor.id)
  return {ok:true,requiresLogin:true}
 })
}
