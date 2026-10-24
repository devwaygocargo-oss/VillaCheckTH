import {preserveApprovedVilla,saveRecord} from "./approval-history.mjs"
import {randomUUID} from 'node:crypto'
const fields={name_en:'ชื่อที่พักภาษาอังกฤษ',name:'ชื่อ Villa',province:'จังหวัด',merchant:'ชื่อ Merchant',phone:'เบอร์โทร',bank_name:'ธนาคาร',account_name:'ชื่อบัญชี',account_number:'เลขบัญชี',guest_capacity:'จำนวนผู้เข้าพักสูงสุด',photo_url:'รูป Villa'}
const key=id=>'villa_review:'+id
export async function villaReview(db,villa,prefetched){
 const row=prefetched===undefined?await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(villa.id)):prefetched
 if(row){try{return JSON.parse(row.value)}catch{ /* Legacy invalid metadata has no usable change history. */ }}
 const legacy=String(villa.reason||'').includes('Information changed')
 return {id:null,kind:legacy?'legacy_update':'registration',submittedAt:legacy?null:villa.created,submittedBy:null,changes:[],summary:legacy?'แก้ไขข้อมูล Villa — รายการเดิมไม่มีประวัติระบุช่องที่เปลี่ยน':'รอตรวจเอกสารกรรมสิทธิ์และข้อมูล Villa ที่ลงทะเบียน'}
}
export async function recordVillaReview(db,villa,next,kind,user){
 await preserveApprovedVilla(db,villa)
 const previous=await villaReview(db,villa),changes=[]
 for(const [field,label]of Object.entries(fields)){
  const old=String(villa[field]??''),after=String(next[field]??'')
  const pending=villa.status==='pending'&&previous.kind==='information_update'?previous.changes.find(c=>c.field===field):null
  const before=pending?pending.before:old
  if(before!==after)changes.push({field,label,before,after})
 }
 if(kind==='media_removal')changes.push({field:'media',label:'นำสื่อออก',before:next._removedMedia.name,after:'นำออกหลังอนุมัติ'})
 if(kind==='document_resubmission'){
  const old=await db.prepare('SELECT name FROM documents WHERE id=?').get(villa.document_id)
  const file=await db.prepare('SELECT name FROM documents WHERE id=?').get(next.document_id)
  changes.push({field:'document',label:'เอกสารกรรมสิทธิ์',before:old?.name||'',after:file?.name||''})
 }
 const review={id:randomUUID(),kind,submittedAt:new Date().toISOString(),submittedBy:user.name,changes,summary:kind==='document_resubmission'?'ส่งเอกสารกรรมสิทธิ์ใหม่เพื่อตรวจสอบ':changes.length?'แก้ไขข้อมูล: '+changes.map(c=>c.label).join(', '):'ส่งข้อมูล Villa ให้ตรวจสอบอีกครั้ง (ไม่มีข้อมูลเปลี่ยน)'}
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key(villa.id),JSON.stringify(review))
 await saveRecord(db,"villa_change_history:"+review.id,{...review,villaId:villa.id,actorId:user.id})
 return review
}
