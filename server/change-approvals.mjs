import {randomUUID} from 'node:crypto'
import {audit} from './database.mjs'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
export async function changeApprovals(db,user,req,path,readBody,execute){
 if(!path.startsWith('/api/admin/change-approvals'))return undefined
 if(user.role!=='admin')fail(403,'เฉพาะ Admin')
 const policyRow=await db.prepare("SELECT value FROM system_settings WHERE key='approval:reviewer_email'").get()
 const reviewerEmail=policyRow?String(JSON.parse(policyRow.value)).trim().toLowerCase():''
 const isReviewer=Boolean(reviewerEmail)&&user.email?.toLowerCase()===reviewerEmail
 const canReview=!reviewerEmail||isReviewer,canPropose=!isReviewer
 const read=async()=>{const rows=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'change_approval:%'").all();return rows.map(r=>JSON.parse(r.value)).sort((a,b)=>b.created.localeCompare(a.created)).slice(0,100)}
 if(req.method==='GET'&&path==='/api/admin/change-approvals')return {requests:await read(),currentAdminId:user.id,canReview,canPropose,reviewerEmail}
 const data=await readBody(req)
 if(req.method==='POST'&&path==='/api/admin/change-approvals'){
  if(!canPropose)fail(403,'บัญชีผู้อนุมัติไม่สามารถเสนอแก้ไข ต้องใช้บัญชีผู้เสนอแยกต่างหาก')
  if(!['bank','cms'].includes(data.kind)||!data.payload||typeof data.payload!=='object')fail(400,'ประเภทคำขอไม่ถูกต้อง')
  if(JSON.stringify(data.payload).length>500000)fail(400,'ข้อมูลคำขอใหญ่เกินไป')
  // Validate and snapshot the current revision before allowing a proposal into the queue.
  await execute(data.kind,data.payload,true)
  const value={id:randomUUID(),kind:data.kind,payload:data.payload,proposerId:user.id,proposerName:user.name,status:'pending',created:new Date().toISOString()}
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('change_approval:'+value.id,JSON.stringify(value));await audit(db,user,'change.propose',value.id)
  return {request:value}
 }
 const match=path.match(/^\/api\/admin\/change-approvals\/([a-f0-9-]{36})\/(approve|reject)$/)
 if(req.method==='POST'&&match)return db.transaction(async()=>{
  if(!canReview)fail(403,'เฉพาะบัญชี Admin ผู้อนุมัติที่กำหนดเท่านั้น')
  const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('change_approval:'+match[1]);if(!row)fail(404,'ไม่พบคำขอ')
  const value=JSON.parse(row.value);if(value.status!=='pending')fail(409,'คำขอนี้พิจารณาแล้ว')
  if(value.proposerId===user.id)fail(403,'ผู้เสนอไม่สามารถอนุมัติหรือปฏิเสธคำขอของตนเอง ต้องใช้ Admin อีกบัญชี')
  const reason=typeof data.reason==='string'?data.reason.trim():'';if(match[2]==='reject'&&!reason)fail(400,'กรุณาระบุเหตุผลที่ไม่อนุมัติ');if(reason.length>2000)fail(400,'เหตุผลยาวเกินไป')
  if(match[2]==='approve')await execute(value.kind,value.payload,false)
  Object.assign(value,{status:match[2]==='approve'?'approved':'rejected',reviewerId:user.id,reviewerName:user.name,reviewedAt:new Date().toISOString(),reason})
  await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(value),'change_approval:'+value.id);await audit(db,user,'change.'+match[2],value.id)
  return {request:value}
 })
 fail(404,'ไม่พบ API อนุมัติ')
}
