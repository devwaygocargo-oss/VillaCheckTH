import {createHash,randomBytes,timingSafeEqual} from "node:crypto"
import {hashPassword} from "./database.mjs"
import {otpDestination} from "./login-otp.mjs"
import {saveRecord} from "./approval-history.mjs"
const hash=value=>createHash("sha256").update(value).digest("hex")
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
export async function beginPasswordRegistration(db,otp,{email,password,name,businessNameEn="",role,phone,allocatedUserId}) {
 const stale=await db.prepare("SELECT key,value FROM system_settings WHERE key LIKE 'password_registration:%'").all()
 for(const record of stale){if(Date.parse(JSON.parse(record.value).expiresAt)<=Date.now())await db.prepare("DELETE FROM system_settings WHERE key=?").run(record.key)}
 if(allocatedUserId&&await db.prepare("SELECT id FROM users WHERE id=?").get(allocatedUserId))fail(409,"บัญชีทดสอบนี้มีอยู่แล้ว กรุณาเข้าสู่ระบบ")
 const verifiedPhone=phone===undefined?null:otpDestination('sms',phone)
 if(verifiedPhone&&await db.prepare("SELECT user_id FROM oauth_identities WHERE provider='phone_otp' AND subject=?").get(verifiedPhone))fail(409,'หมายเลขนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ')
 const challenge=await otp.request({channel:verifiedPhone?'sms':'email',destination:verifiedPhone||email,accountType:role,purpose:'register'},null,verifiedPhone?{phoneRegistration:true,allocatedUserId}:{})
 const nonce=randomBytes(32).toString("hex")
 await saveRecord(db,"password_registration:"+challenge.challengeId,{email,name,businessNameEn,role,...(verifiedPhone?{phone:verifiedPhone,...(allocatedUserId?{allocatedUserId}:{})}:{}),passwordHash:hashPassword(password),nonceHash:hash(nonce),expiresAt:challenge.expiresAt})
 return {...challenge,nonce}
}
export async function finishPasswordRegistration(db,otp,data,nonce) {
 if(typeof data.challengeId!=="string"||!/^[-a-f0-9]{36}$/.test(data.challengeId)||typeof nonce!=="string"||!/^[a-f0-9]{64}$/.test(nonce))fail(401,"คำขอยืนยันการสมัครไม่ถูกต้อง กรุณาเริ่มสมัครใหม่")
 const key="password_registration:"+data.challengeId,row=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key)
 if(!row)fail(401,"คำขอสมัครหมดอายุ กรุณาเริ่มใหม่")
 const pending=JSON.parse(row.value)
 if(Date.parse(pending.expiresAt)<=Date.now()||!timingSafeEqual(Buffer.from(pending.nonceHash,"hex"),Buffer.from(hash(nonce),"hex")))fail(401,"คำขอสมัครหมดอายุหรือไม่ตรงกับเบราว์เซอร์ที่เริ่มสมัคร")
 if(pending.phone){
  return otp.verify({challengeId:data.challengeId,code:data.code},null,{phoneRegistration:true,onVerified:async user=>{
   const current=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key)
   if(!current||current.value!==row.value||Date.parse(pending.expiresAt)<=Date.now()||user.role!==pending.role)fail(401,'คำขอสมัครหมดอายุหรือเปลี่ยนไป')
   const identity=await db.prepare("SELECT user_id FROM oauth_identities WHERE provider='phone_otp' AND subject=?").get(pending.phone)
   if(identity?.user_id!==user.id||pending.allocatedUserId&&pending.allocatedUserId!==user.id)fail(409,'หมายเลขโทรศัพท์ไม่ตรงกับคำขอสมัคร')
   if(await db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(pending.email,user.id))fail(409,'อีเมลนี้ถูกใช้งานแล้ว')
   await db.prepare('UPDATE users SET email=?,name=?,password_hash=?,phone=? WHERE id=?').run(pending.email,pending.name,pending.passwordHash,pending.phone,user.id)
   if(user.role==='merchant')await db.prepare('UPDATE users SET business_name=?,business_name_en=? WHERE id=?').run(pending.name,pending.businessNameEn,user.id)
   await db.prepare('UPDATE leads SET email=?,name=?,phone=?,updated=? WHERE user_id=?').run(pending.email,pending.name,pending.phone,new Date().toISOString(),user.id)
   await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('unverified_registration_email:'+user.id,JSON.stringify({email:pending.email}))
   await db.prepare('DELETE FROM system_settings WHERE key=?').run(key)
   return {...user,email:pending.email,name:pending.name,password_hash:pending.passwordHash}
  }})
 }
 const user=await otp.verify({challengeId:data.challengeId,code:data.code})
 if(user.email!==pending.email||user.role!==pending.role)fail(409,"บัญชีเปลี่ยนระหว่างสมัคร กรุณาเข้าสู่ระบบด้วย OTP")
 // Restore the chosen password only for this browser's verified signup intent.
 // Ordinary mailbox recovery never restores a pre-registrant's old password.
 return db.transaction(async()=>{
  await db.prepare("UPDATE users SET name=?,password_hash=? WHERE id=?").run(pending.name,pending.passwordHash,user.id)
  if(user.role==="merchant")await db.prepare("UPDATE users SET business_name=?,business_name_en=? WHERE id=?").run(pending.name,pending.businessNameEn,user.id)
  await db.prepare("UPDATE leads SET name=?,updated=? WHERE user_id=?").run(pending.name,new Date().toISOString(),user.id)
  await db.prepare("DELETE FROM system_settings WHERE key=?").run(key)
  return {...user,name:pending.name,password_hash:pending.passwordHash}
 })
}
