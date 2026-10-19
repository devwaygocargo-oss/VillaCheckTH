import {randomUUID} from 'node:crypto'
import {audit} from './database.mjs'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
export async function acceptanceApi(db,user,req,path,body){
 if(path!=='/api/admin/acceptance')return undefined
 if(user.role!=='admin')fail(403,'เฉพาะ Admin')
 if(req.method==='POST'){
  const d=await body(req)
  if(!['uat','physical-device','live-email','google','line','otp','payment','training','backup-restore','monitoring','content','meta'].includes(d.area)||!['pass','fail','blocked'].includes(d.outcome)||typeof d.evidence!=='string'||d.evidence.trim().length<10||d.evidence.length>4000||d.confirmed!==true)fail(400,'กรุณาระบุผลและหลักฐานจริงอย่างน้อย 10 ตัวอักษร และยืนยันการบันทึก')
  const row={id:randomUUID(),area:d.area,outcome:d.outcome,evidence:d.evidence.trim(),reviewer:user.name,reviewerId:user.id,created:new Date().toISOString(),source:'manual-admin-attestation'}
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('acceptance:'+row.id,JSON.stringify(row));await audit(db,user,'acceptance.record',row.id)
 }
 const rows=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'acceptance:%'").all();return {records:rows.map(r=>JSON.parse(r.value)).sort((a,b)=>b.created.localeCompare(a.created))}
}
