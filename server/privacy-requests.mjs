import {createHash,randomUUID} from 'node:crypto'
import {publishedCms} from './cms.mjs'
import {audit,verifyPasswordAsync} from './database.mjs'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
export async function privacyNoticeVersion(db){
 const published=await publishedCms(db),notice=published.content.pages.find(p=>p.slug==='privacy')||null
 return {version:createHash('sha256').update(JSON.stringify(notice)).digest('hex'),cmsRevision:published.revision,notice,legalApproval:'NOT_ASSERTED'}
}
// Intake only. This never exports, erases, anonymizes or transfers business data.
export async function privacyRequests(db,actor,method,data={}){
 if(!actor||!['user','merchant','admin'].includes(actor.role))fail(403,'กรุณาเข้าสู่ระบบบัญชีของคุณ')
 const prefix='privacy_request:'+actor.id+':'
 if(method==='GET')return {requests:(await db.prepare('SELECT value FROM system_settings WHERE key LIKE ? ORDER BY key').all(prefix+'%')).map(r=>JSON.parse(r.value))}
 if(method!=='POST')fail(405,'ไม่รองรับคำสั่งนี้')
 if(!['access','correction','deletion'].includes(data.kind)||typeof data.requestKey!=='string'||!/^[a-f0-9-]{36}$/.test(data.requestKey))fail(400,'ประเภทคำขอหรือเลขคำขอไม่ถูกต้อง')
 const account=await db.prepare('SELECT password_hash FROM users WHERE id=?').get(actor.id)
 if(typeof data.currentPassword!=='string'||data.currentPassword.length>128||!account||!await verifyPasswordAsync(data.currentPassword,account.password_hash))fail(403,'กรุณายืนยันรหัสผ่านปัจจุบันก่อนส่งคำขอ')
 const notice=await privacyNoticeVersion(db)
 return db.transaction(async()=>{
  const current=await db.prepare('SELECT password_hash FROM users WHERE id=?').get(actor.id)
  const session=await db.prepare('SELECT expires FROM sessions WHERE token_hash=? AND user_id=?').get(actor.token_hash,actor.id)
  if(!current||current.password_hash!==account.password_hash||!session||Number(session.expires)<=Date.now())fail(401,'กรุณาเข้าสู่ระบบใหม่')
  const key=prefix+data.requestKey,existing=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key)
  if(existing){const record=JSON.parse(existing.value);if(record.kind!==data.kind)fail(409,'เลขคำขอนี้ถูกใช้แล้ว');return {ok:true,request:record}}
  const pending=(await db.prepare('SELECT value FROM system_settings WHERE key LIKE ?').all(prefix+'%')).map(r=>JSON.parse(r.value)).find(r=>r.kind===data.kind&&r.status==='pending_review')
  if(pending)return {ok:true,request:pending}
  const request={id:randomUUID(),userId:actor.id,kind:data.kind,status:'pending_review',requestedAt:new Date().toISOString(),noticeVersion:notice.version}
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(key,JSON.stringify(request))
  await audit(db,actor,'privacy.request_created',request.id)
  return {ok:true,request}
 })
}
export async function adminPrivacyRequests(db,actor){
 if(actor.role!=='admin')fail(403,'เฉพาะ Admin')
 return {requests:(await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'privacy_request:%'").all()).map(r=>JSON.parse(r.value))}
}
