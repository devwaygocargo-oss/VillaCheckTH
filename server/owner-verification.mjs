import { randomUUID } from 'node:crypto'
import { audit } from './database.mjs'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
const key=id=>'owner_verification:'+id
const read=async(db,id)=>{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(id));return row?JSON.parse(row.value):null}
const save=(db,row)=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key(row.villaId),JSON.stringify(row))
const villaSelect='SELECT v.*,s.lifecycle AS owner_lifecycle FROM villas v LEFT JOIN subscriptions s ON s.owner_id=v.owner_id'
const eligible=v=>!['SUSPENDED','CANCELLED'].includes(v.owner_lifecycle)&&['starter','pro','premium'].includes(v.package_id)&&v.payments>0&&Date.parse(v.expires)>Date.now()&&v.status==='approved'
const text=(v,max=300)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f]/.test(v))fail(400,'กรุณากรอกข้อมูลให้ถูกต้อง');return v.trim()}
export async function publicOwnerVerification(db,villa){
 if(!eligible(villa))return null
 const subscription=await db.prepare('SELECT lifecycle FROM subscriptions WHERE owner_id=?').get(villa.owner_id)
 const row=eligible({...villa,owner_lifecycle:subscription?.lifecycle})?await read(db,villa.id):null
 return row?.status==='accepted'?{status:'accepted',reviewedAt:row.reviewedAt,method:'Admin ตรวจใบหน้าและทะเบียนบ้าน พร้อมยืนยันเจ้าของบ้าน'}:null
}
export async function ownerVerificationApi(db,user,req,path,url,body){
 if(!['/api/merchant/owner-verification','/api/admin/owner-verification'].includes(path))return undefined
 const admin=path.startsWith('/api/admin/');if(!user||user.role!==(admin?'admin':'merchant'))fail(403,'ไม่มีสิทธิ์เข้าถึงหลักฐานยืนยันเจ้าของบ้าน')
 if(req.method==='GET'){
  const villas=await db.prepare(villaSelect+(admin?'':' WHERE v.owner_id=?')).all(...(admin?[]:[user.id]))
  const rows=(await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'owner_verification:%'").all()).map(r=>JSON.parse(r.value))
  const ids=new Set(villas.map(v=>v.id))
  return {villas:villas.map(v=>({id:v.id,name:v.name,eligible:eligible(v)})),submissions:rows.filter(r=>ids.has(r.villaId)).map(r=>({...r,villaName:villas.find(v=>v.id===r.villaId).name}))}
 }
 if(req.method!=='POST')fail(405,'ไม่รองรับคำขอ')
 return db.transaction(async()=>{
  const data=await body(req),villa=await db.prepare(villaSelect+' WHERE v.id=?').get(data.villaId)
  if(!villa||(!admin&&villa.owner_id!==user.id))fail(404,'ไม่พบที่พัก')
  const previous=await read(db,villa.id),revision=previous?.revision||0
  if(data.expectedRevision!==revision)fail(409,'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดล่าสุดก่อนทำรายการ')
  const now=new Date().toISOString(),row=previous||{villaId:villa.id,ownerId:user.id,status:'draft',revision:0,history:[],files:{}}
  if(admin){
   if(data.action!=='review'||!['pending','accepted'].includes(row.status)||(row.status==='accepted'&&data.status==='accepted'))fail(409,'พิจารณาได้เฉพาะรายการรอตรวจ')
   if(!['accepted','changes','rejected'].includes(data.status))fail(400,'สถานะไม่ถูกต้อง')
   if(data.status==='accepted'){
    if(!eligible(villa))fail(409,'ที่พักต้องมีแพ็กเกจ 1,990 ขึ้นไปที่ใช้งานอยู่และผ่านอนุมัติ')
    if(!row.files.face||!row.files.house||data.faceMatched!==true||data.houseMatched!==true||data.ownerConfirmed!==true)fail(400,'ต้องตรวจใบหน้า ทะเบียนบ้าน และยืนยันจากเจ้าของบ้านให้ครบ')
    row.checks={faceMatched:true,houseMatched:true,ownerConfirmed:true}
   }else row.reason=text(data.reason,2000)
   row.status=data.status;row.reviewedAt=now;row.reviewedBy=user.id;row.reviewedByName=user.name
   row.history.push({action:'review',status:row.status,reason:row.reason||'',by:user.id,at:now})
  }else{
   if(!eligible(villa))fail(403,'ใช้ได้สำหรับที่พักที่ผ่านอนุมัติและมีแพ็กเกจ 1,990 ขึ้นไปที่ใช้งานอยู่')
   if(!['draft','changes','rejected'].includes(row.status))fail(409,'ส่งหลักฐานแล้ว รอทีมตรวจ หรือให้ Admin ขอแก้ไขก่อนส่งใหม่')
   if(data.action==='upload'){
    if(!['face','house'].includes(data.slot))fail(400,'ประเภทหลักฐานไม่ถูกต้อง')
    const file=data.file,allowed=data.slot==='face'?['image/jpeg','image/png','video/mp4']:['image/jpeg','image/png','application/pdf']
    if(!file||!allowed.includes(file.type)||typeof file.data!=='string'||!file.data.startsWith(`data:${file.type};base64,`))fail(400,'รูปแบบไฟล์ไม่ถูกต้อง')
    const bytes=Buffer.from(file.data.slice(file.data.indexOf(',')+1),'base64')
    if(!bytes.length||bytes.length>2*1024*1024)fail(400,'ไฟล์ต้องมีขนาดไม่เกิน 2 MB')
    const valid=file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:file.type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):file.type==='video/mp4'?bytes.subarray(4,8).toString()==='ftyp':bytes.subarray(0,5).toString()==='%PDF-'
    if(!valid)fail(400,'เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์')
    const id=randomUUID(),name=text(file.name,200)
    await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(id,user.id,name,file.type,bytes)
    if(row.files[data.slot])await db.prepare('DELETE FROM documents WHERE id=? AND owner_id=?').run(row.files[data.slot].id,user.id)
    row.files[data.slot]={id,name,type:file.type,url:'/api/documents/'+id,uploadedAt:now}
    row.status='draft'
   }else if(data.action==='submit'){
    if(!row.files.face||!row.files.house)fail(400,'แนบหลักฐานใบหน้าและทะเบียนบ้านให้ครบ')
    if(data.consent!==true)fail(400,'กรุณายืนยันความยินยอมให้ตรวจหลักฐาน')
    row.ownerName=text(data.ownerName);row.consentAt=now;row.status='pending';row.submittedAt=now;row.reason='';delete row.checks
    row.history.push({action:'submit',by:user.id,at:now})
   }else fail(400,'คำขอไม่ถูกต้อง')
  }
  row.updatedAt=now;row.revision=revision+1;await save(db,row);await audit(db,user,'owner_verification.'+data.action,villa.id)
  return {submission:row}
 })
}
