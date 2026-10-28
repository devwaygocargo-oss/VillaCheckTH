import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto'
import {hashPassword,audit} from './database.mjs'
const digest=value=>createHash('sha256').update(value).digest('hex')
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
const responseMessage='หากบัญชีรองรับการกู้คืน ระบบจะส่งรหัสยืนยันไปยังอีเมลของคุณ'

export async function beginPasswordRecovery(db,otp,address){
 if(typeof address!=='string'||address.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(address.trim()))fail(400,'กรุณาระบุอีเมลให้ถูกต้อง')
 const email=address.trim().toLowerCase(),nonce=randomBytes(32).toString('hex')
 const account=await db.prepare('SELECT id,role FROM users WHERE email=?').get(email)
 const access=account&&await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+account.id)
 // Privileged recovery remains an operator-controlled workflow. No account is created.
 const unverified=account&&await db.prepare('SELECT value FROM system_settings WHERE key=?').get('unverified_registration_email:'+account.id)
 if(!account||unverified||!['user','merchant'].includes(account.role)||access&&JSON.parse(access.value).status==='suspended')return {challengeId:randomUUID(),expiresAt:new Date(Date.now()+300000).toISOString(),resendAfter:60,nonce,message:responseMessage}
 let challenge
 try{challenge=await otp.request({channel:'email',destination:email,accountType:account.role,purpose:'reset_password'},null,{passwordRecovery:true})}
 catch(error){if(![403,429,503].includes(error.status))throw error;return {challengeId:randomUUID(),expiresAt:new Date(Date.now()+300000).toISOString(),resendAfter:60,nonce,message:responseMessage}}
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('password_recovery:'+challenge.challengeId,JSON.stringify({userId:account.id,email,role:account.role,nonceHash:digest(nonce),expiresAt:challenge.expiresAt}))
 await audit(db,account,'account.recovery_requested',account.id)
 return {...challenge,nonce,message:responseMessage}
}

export async function finishPasswordRecovery(db,otp,data,nonce){
 const invalid=()=>fail(401,'คำขอกู้คืนไม่ถูกต้องหรือหมดอายุ กรุณาเริ่มใหม่')
 if(typeof data?.challengeId!=='string'||!/^[-a-f0-9]{36}$/.test(data.challengeId)||typeof nonce!=='string'||!/^[a-f0-9]{64}$/.test(nonce))invalid()
 if(typeof data.newPassword!=='string'||data.newPassword.length<10||data.newPassword.length>128)fail(400,'รหัสผ่านใหม่ต้องมี 10–128 ตัวอักษร')
 const key='password_recovery:'+data.challengeId
 const read=async()=>{
  const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key)
  if(!row)invalid()
  const pending=JSON.parse(row.value)
  if(Date.parse(pending.expiresAt)<=Date.now()||!timingSafeEqual(Buffer.from(pending.nonceHash,'hex'),Buffer.from(digest(nonce),'hex')))invalid()
  return pending
 }
 await read()
 const passwordHash=hashPassword(data.newPassword)
 await otp.verify({challengeId:data.challengeId,code:data.code},null,{passwordRecovery:true,onVerified:async account=>{
  const pending=await read()
  if(account.id!==pending.userId||account.email!==pending.email||account.role!==pending.role)invalid()
  const access=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+account.id)
  if(access&&JSON.parse(access.value).status==='suspended')invalid()
  await db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash,account.id)
  await db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(account.id)
  await audit(db,account,'account.password_recovered',account.id)
  await db.prepare('DELETE FROM system_settings WHERE key=?').run(key)
  return account
 }})
 return {ok:true,requiresLogin:true}
}
