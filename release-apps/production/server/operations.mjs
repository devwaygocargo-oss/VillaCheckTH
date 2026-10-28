import {assertWriteSession} from "./write-session.mjs";
import {assertVillaCoverLimit,activeVillaMedia} from './villa-media-limits.mjs'
import {resolvePublicQr,publishedVillas} from "./public-revision.mjs"
import { mediaDate } from "./media-date.mjs";
import {recordVillaReview} from './villa-review.mjs'
import {saveVillaPhoto} from './villa-photo.mjs'
import {guestCapacity} from './guest-capacity.mjs'
import { randomUUID } from 'node:crypto'
import { trustDto } from './catalog.mjs'
import { audit } from './database.mjs'
const error=(status,message)=>{throw Object.assign(Error(message),{status})}
const clean=(value,label,max=200,required=true)=>{
 if(typeof value!=='string'||value.trim().length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)||(required&&!value.trim()))error(400,`ข้อมูล ${label} ไม่ถูกต้อง`)
 return value.trim()
}
const ref=prefix=>`${prefix}-${randomUUID()}`
export async function createReport(db,data,user){
 const name=clean(data.villa,'Villa'),type=clean(data.type,'ประเภท'),detail=clean(data.detail,'รายละเอียด',4000),reporter=clean(data.reporter||'','ผู้แจ้ง',200,false),contact=clean(data.contact||'','ติดต่อ',254,false)
 let villa
 if(data.qr) villa=await db.prepare('SELECT id,name FROM villas WHERE qr=?').get(clean(data.qr,'QR',100))
 else {const matches=await db.prepare('SELECT id,name FROM villas WHERE name=?').all(name);if(matches.length===1)villa=matches[0]}
 const id=randomUUID(),reference=ref('RPT'),now=new Date().toISOString()
 await db.prepare('INSERT INTO support_reports(id,reference,user_id,villa_id,villa_name,type,detail,reporter,contact,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id,reference,user?.role==='user'?user.id:null,villa?.id||null,name,type,detail,reporter,contact,now,now)
 return {id,reference,linkedToUser:user?.role==='user'}
}
export async function recordEvent(db,qr,kind){
 if(!['PROFILE_VIEW','QR_SCAN','CONTACT_VIEW'].includes(kind))error(400,'ประเภทสถิติไม่ถูกต้อง')
 const villa=await resolvePublicQr(db,clean(qr,'QR',100))
 if(!villa||villa.status!=='approved')error(404,'ไม่พบ Villa')
 await db.prepare('INSERT INTO villa_events VALUES (?,?,?,?)').run(randomUUID(),villa.id,kind,new Date().toISOString())
 return {ok:true}
}
export async function operations(db,user,req,path,url,readBody){
 if(!/^\/api\/(user\/(?:checks|profile|summary)|reports|merchant\/(analytics|reports|villas)|admin\/(checks|reports|merchants|qr))/.test(path))return undefined
 const admin=user.role==='admin',merchant=user.role==='merchant'
 if(path.startsWith('/api/admin/')&&!admin)error(403,'เฉพาะ Admin')
 if(path.startsWith('/api/merchant/')&&!merchant)error(403,'เฉพาะ Merchant')
 if(path.startsWith('/api/user/')&&user.role!=='user')error(403,'เฉพาะ User')
 if(path==='/api/user/profile'){
  if(req.method==='GET')return {profile:await db.prepare('SELECT name,email,phone,address FROM users WHERE id=?').get(user.id)};
  if(req.method!=='POST')error(405,'ไม่รองรับคำสั่งนี้');
  const data=await readBody(req);if(!data||Object.keys(data).some(k=>!['name','phone','address'].includes(k)))error(400,'แก้ไขได้เฉพาะชื่อ เบอร์โทร และที่อยู่');
  const name=clean(data.name,'ชื่อ-นามสกุล',200),phone=clean(data.phone||'','เบอร์โทร',25,false),address=clean(data.address||'','ที่อยู่',1000,false);
  if(phone&&!/^[+0-9 ()-]{8,25}$/.test(phone))error(400,'เบอร์โทรไม่ถูกต้อง');
  await db.transaction(async()=>{await assertWriteSession(db,user);await db.prepare('UPDATE users SET name=?,phone=?,address=? WHERE id=?').run(name,phone,address,user.id);await audit(db,user,'user.profile_updated',user.id)});
  return {ok:true,profile:await db.prepare('SELECT name,email,phone,address FROM users WHERE id=?').get(user.id)};
 }
 if(path==='/api/user/summary'&&req.method==='GET'){
  const [counts,checks]=await Promise.all([
   db.prepare('SELECT (SELECT COUNT(*) FROM user_checks WHERE user_id=?) AS checks,(SELECT COUNT(*) FROM support_reports WHERE user_id=?) AS reports').get(user.id,user.id),
   db.prepare('SELECT id,reference,villa_name,status,result,created FROM user_checks WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 3').all(user.id)
  ]);return {counts,checks};
 }
 const villaEdit=path.match(/^\/api\/merchant\/villas\/([a-f0-9-]+)$/)
 if(villaEdit&&['POST','PATCH'].includes(req.method)){
  const data=await readBody(req),villa=await db.prepare('SELECT * FROM villas WHERE id=? AND owner_id=?').get(villaEdit[1],user.id)
  if(!villa)error(404,'ไม่พบ Villa')
  const nameEn=clean(data.nameEn||'','ชื่อที่พักภาษาอังกฤษ',200,true)
  const capacity = data.guestCapacity === undefined ? villa.guest_capacity : guestCapacity(data.guestCapacity)
  const values=['name','province','merchant','phone','bankName','accountName','accountNumber'].map(k=>clean(data[k]||'',k,200,['name','province','merchant'].includes(k)))
  if(values[3]&&!/^[+0-9 ()-]{8,25}$/.test(values[3]))error(400,'เบอร์โทรไม่ถูกต้อง')
  if(values[6]&&!/^[0-9 -]{6,30}$/.test(values[6]))error(400,'เลขบัญชีไม่ถูกต้อง')
  const photo=clean(data.photoUrl||'','photo',2000,false)
  const mediaCover=/^\/api\/public\/property-media-file\/[a-f0-9-]+$/.test(photo)
  if(photo&&!mediaCover&&!/^\/api\/public\/villa-photo\/[a-f0-9-]+$/.test(photo)&&!/^https:\/\//.test(photo)&&!/^\/demo\/villas\/villa-\d+\.jpg$/.test(photo))error(400,'รูปหน้าปกต้องเป็นไฟล์ที่อัปโหลดหรือ URL แบบ HTTPS ที่ถูกต้อง')
  await db.transaction(async()=>{await assertWriteSession(db,user);
   const latest=await db.prepare('SELECT * FROM villas WHERE id=? AND owner_id=?').get(villa.id,user.id)
   if(!latest)error(404,'ไม่พบ Villa')
   if(mediaCover&&!(await activeVillaMedia(db,latest.id)).some(m=>m.url===photo&&m.kind==='image'))error(403,'ไม่มีสิทธิ์ใช้รูปนี้เป็นรูปปก')
   const internalPhoto=photo.match(/^\/api\/public\/villa-photo\/([a-f0-9-]+)$/)
   if(internalPhoto&&!(await db.prepare("SELECT id FROM documents WHERE id=? AND owner_id=? AND name='villa-photo' AND mime IN ('image/jpeg','image/png')").get(internalPhoto[1],user.id)))error(403,'ไม่มีสิทธิ์ใช้รูปนี้เป็นรูปปก')
   const storedPhoto=data.photo?await saveVillaPhoto(db,user.id,data.photo):photo
   const savedCapacity=data.guestCapacity===undefined?latest.guest_capacity:capacity
   await recordVillaReview(db,latest,{...latest,...Object.fromEntries(['name','province','merchant','phone','bank_name','account_name','account_number'].map((key,i)=>[key,values[i]])),guest_capacity:savedCapacity,photo_url:storedPhoto,name_en:nameEn},'information_update',user)
   const activeMedia=await activeVillaMedia(db,latest.id);
   if(storedPhoto!==latest.photo_url&&!activeMedia.some(m=>m.kind==='image'&&m.url===storedPhoto))for(const oldCover of activeMedia.filter(m=>m.kind==='image'&&m.url===latest.photo_url))await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...oldCover,removedAt:new Date().toISOString(),removedBy:user.id,replacementCoverUrl:storedPhoto||null}),'property_media:'+latest.id+':'+oldCover.id);
   await assertVillaCoverLimit(db,latest,storedPhoto)
   await db.prepare("UPDATE villas SET name=?,province=?,merchant=?,phone=?,bank_name=?,account_name=?,account_number=?,photo_url=?,guest_capacity=?,status='pending',verification_level='REGISTERED',reason='ข้อมูลมีการเปลี่ยนแปลง รอผู้ดูแลตรวจสอบ' WHERE id=?").run(...values,storedPhoto,savedCapacity,villa.id)
   const changedPhoto = Boolean(data.photo) || storedPhoto !== latest.photo_url
   const takenAt = data.photoTakenAt === undefined ? (changedPhoto ? null : latest.photo_taken_at) : data.photoTakenAt ? mediaDate(data.photoTakenAt) : null
   await db.prepare("UPDATE villas SET name_en=?,photo_uploaded_at=?,photo_taken_at=?,photo_reviewed_at=? WHERE id=?").run(nameEn,changedPhoto?(storedPhoto?new Date().toISOString():null):latest.photo_uploaded_at,takenAt,changedPhoto?null:latest.photo_reviewed_at,villa.id)
   await audit(db,user,'villa.update',villa.id)
  })
  return {ok:true}
 }
 if(path==='/api/user/checks'&&req.method==='POST'){
  const data=await readBody(req),key=clean(data.requestKey,'request key',100)
  const qr=clean(data.qr||'','QR',100,false),name=clean(data.villa||'','Villa',200,!qr)
  const account=clean(data.account||'','บัญชี',50,false),contact=clean(data.contact||'','ติดต่อ',200,false)
  const replay=existing=>{if(!existing)error(409,'คำขอกำลังประมวลผล กรุณาลองอีกครั้ง');if(existing.qr!==qr||(!qr&&existing.villa_name!==name)||existing.submitted_account!==account||existing.submitted_contact!==contact)error(409,'ข้อมูลตรวจสอบเปลี่ยนแล้ว กรุณาส่งคำขอใหม่');return existing}
  return db.transaction(async()=>{await assertWriteSession(db,user);
   const existing=await db.prepare('SELECT * FROM user_checks WHERE user_id=? AND request_key=?').get(user.id,key);if(existing)return replay(existing)
   let villa=qr?await resolvePublicQr(db,qr):null
   if(!qr){const matches=(await publishedVillas(db)).filter(v=>v.name===name);if(matches.length===1)villa=matches[0]}
   const trust=villa?await trustDto(db,villa):null
   const normalize=v=>String(v||'').replace(/[\s-]/g,'')
   const matched=Boolean(normalize(account)||normalize(contact))&&trust?.qrStatus==='ACTIVE'&&(!account||(villa.account_number&&normalize(account)===normalize(villa.account_number)))&&(!contact||(villa.phone&&normalize(contact)===normalize(villa.phone)))
   const status=matched?'MATCHED':'REVIEW_REQUIRED'
   const result=!villa?'ไม่พบที่พักที่ระบุในระบบ':trust.qrStatus!=='ACTIVE'?`QR ไม่พร้อมใช้งาน: ${trust.qrStatus}`:matched?'ข้อมูลตรงกับทะเบียน ณ เวลาตรวจสอบ ไม่ใช่การรับประกันการจอง':'บัญชีหรือช่องทางติดต่อไม่ตรง กรุณาตรวจสอบกับที่พักก่อนโอน'
   const id=randomUUID(),reference=ref('CHK'),created=new Date().toISOString()
   const inserted=await db.prepare('INSERT INTO user_checks(id,reference,user_id,villa_id,villa_name,qr,status,result,submitted_account,submitted_contact,request_key,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,request_key) DO NOTHING RETURNING *').get(id,reference,user.id,villa?.id||null,villa?.name||name,qr,status,result,account,contact,key,created)
   if(inserted)return inserted
   return replay(await db.prepare('SELECT * FROM user_checks WHERE user_id=? AND request_key=?').get(user.id,key))
  })
 }
 if(['/api/user/checks','/api/admin/checks'].includes(path)&&req.method==='GET'){
  if(admin&&req.stagingCheckScope){
   const {userIds,villaIds}=req.stagingCheckScope
   if(!Array.isArray(userIds)||!Array.isArray(villaIds))error(403,'ขอบเขตข้อมูลไม่ถูกต้อง')
   if(!userIds.length||!villaIds.length)return {checks:[]}
   return {checks:await db.prepare('SELECT c.*,u.name AS user_name FROM user_checks c JOIN users u ON u.id=c.user_id WHERE c.user_id IN ('+userIds.map(()=>'?').join(',')+') AND c.villa_id IN ('+villaIds.map(()=>'?').join(',')+') ORDER BY c.created DESC LIMIT 500').all(...userIds,...villaIds)}
  }

  return {...(!admin&&req.stagingReadScope?{checkableVillaIds:req.stagingReadScope.villaIds}:{}),checks:admin?await db.prepare('SELECT c.*,u.name AS user_name FROM user_checks c JOIN users u ON u.id=c.user_id ORDER BY c.created DESC LIMIT 500').all():await db.prepare('SELECT * FROM user_checks WHERE user_id=? ORDER BY created DESC LIMIT 500').all(user.id)}
 }
 if(['/api/reports','/api/merchant/reports','/api/admin/reports'].includes(path)&&req.method==='GET'){
  if(!admin&&!merchant&&user.role!=='user')error(403,'ไม่มีสิทธิ์')
  let rows=admin&&req.stagingReadScope?(!req.stagingReadScope.userIds.length||!req.stagingReadScope.villaIds.length?[]:await db.prepare('SELECT * FROM support_reports WHERE user_id IN ('+req.stagingReadScope.userIds.map(()=>'?').join(',')+') AND villa_id IN ('+req.stagingReadScope.villaIds.map(()=>'?').join(',')+') ORDER BY created DESC LIMIT 500').all(...req.stagingReadScope.userIds,...req.stagingReadScope.villaIds)):admin?await db.prepare('SELECT * FROM support_reports ORDER BY created DESC LIMIT 500').all():merchant?await db.prepare('SELECT r.* FROM support_reports r JOIN villas v ON v.id=r.villa_id WHERE v.owner_id=? ORDER BY r.created DESC LIMIT 500').all(user.id):await db.prepare('SELECT * FROM support_reports WHERE user_id=? ORDER BY created DESC LIMIT 500').all(user.id)
  rows=rows.map(r=>{if(admin)return r;const {admin_note,reporter,contact,user_id,...safe}=r;return safe})
  return {reports:rows}
 }
 const report=path.match(/^\/api\/admin\/reports\/([a-f0-9-]+)$/)
 if(report&&['POST','PATCH'].includes(req.method)){
  const data=await readBody(req);if(!['NEW','UNDER_REVIEW','RESOLVED','REJECTED'].includes(data.status))error(400,'สถานะไม่ถูกต้อง')
  const row=await db.prepare('SELECT id FROM support_reports WHERE id=?').get(report[1]);if(!row)error(404,'ไม่พบ Report')
  await db.transaction(async()=>{await assertWriteSession(db,user);await db.prepare('UPDATE support_reports SET status=?,admin_note=?,public_note=?,updated=? WHERE id=?').run(data.status,clean(data.adminNote||'','บันทึกภายใน',4000,false),clean(data.publicNote||'','คำตอบผู้แจ้ง',4000,false),new Date().toISOString(),row.id);await audit(db,user,'report.'+data.status,row.id)})
  return {ok:true}
 }
 if(path==='/api/merchant/analytics'&&req.method==='GET'){
  const since=new Date(Date.now()-30*86400000).toISOString()
  const totals=await db.prepare('SELECT e.kind,count(*) AS total FROM villa_events e JOIN villas v ON v.id=e.villa_id WHERE v.owner_id=? AND e.created>=? GROUP BY e.kind').all(user.id,since)
  const daily=await db.prepare('SELECT substr(e.created,1,10) AS day,count(*) AS total FROM villa_events e JOIN villas v ON v.id=e.villa_id WHERE v.owner_id=? AND e.created>=? GROUP BY substr(e.created,1,10) ORDER BY day').all(user.id,since)
  return {totals,daily,since}
 }
 if(path==='/api/admin/merchants'&&req.method==='GET'){
  return {merchants:await db.prepare("SELECT u.id,u.name,u.email,u.business_name,u.phone,u.address,u.created,s.package_id,s.expires,s.lifecycle,(SELECT count(*) FROM villas v WHERE v.owner_id=u.id) AS villa_count FROM users u LEFT JOIN subscriptions s ON s.owner_id=u.id WHERE u.role='merchant' ORDER BY u.created DESC").all()}
 }
 if(path==='/api/admin/qr'&&req.method==='GET'){
  const villas=await db.prepare('SELECT * FROM villas ORDER BY created DESC').all();return {qrs:await Promise.all(villas.map(async v=>({id:v.id,name:v.name,nameEn:v.name_en,merchant:v.merchant,qr:v.qr,expires:v.expires,trialUnlimited:v.payments===0,controlMode:(await db.prepare("SELECT value FROM system_settings WHERE key=?").get("villa_qr:"+v.id))?.value||"DEFAULT",...await trustDto(db,v)})))}
 }
 const qr=path.match(/^\/api\/admin\/qr\/([a-f0-9-]+)$/)
 if(qr&&['POST','PATCH'].includes(req.method)){
  const data=await readBody(req);
  if(data.action==='regenerate'){
   if(typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>2000||!Object.hasOwn(data,'expectedQr'))error(400,'ระบุเหตุผลและ QR เดิมก่อนสร้างใหม่');
   let next;
   await db.transaction(async()=>{await assertWriteSession(db,user);
    const v=await db.prepare('SELECT * FROM villas WHERE id=?').get(qr[1]);if(!v)error(404,'ไม่พบ Villa');
    if((v.qr||'')!==(data.expectedQr||''))error(409,'QR มีการเปลี่ยนแปลงแล้ว กรุณาโหลดรายการใหม่');
    if(v.status!=='approved')error(409,'ต้องอนุมัติข้อมูลที่พักก่อนสร้าง QR');
    next='VC-'+randomUUID();
    const updated=await db.prepare('UPDATE villas SET qr=? WHERE id=? AND (qr=? OR (qr IS NULL AND CAST(? AS TEXT) IS NULL))').run(next,v.id,v.qr,v.qr);
    if(updated.changes!==1)error(409,'QR มีการเปลี่ยนแปลงแล้ว กรุณาโหลดรายการใหม่');
    await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('qr_rotation:'+randomUUID(),JSON.stringify({villaId:v.id,oldQr:v.qr,newQr:next,reason:data.reason.trim(),actor:user.id,created:new Date().toISOString()}));
    await audit(db,user,'qr.regenerate',v.id);
   });return {ok:true,qr:next};
  }
  if(!['SUSPENDED','INACTIVE','DEFAULT'].includes(data.status))error(400,'สถานะ QR ไม่ถูกต้อง');
  const v=await db.prepare('SELECT id FROM villas WHERE id=?').get(qr[1]);if(!v)error(404,'ไม่พบ Villa');
  await db.transaction(async()=>{await assertWriteSession(db,user);await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('villa_qr:'+v.id,data.status);await audit(db,user,'qr.'+data.status,v.id)})
  return {ok:true}
 }
 return undefined
}
