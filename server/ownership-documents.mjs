import {assertWriteSession} from "./write-session.mjs";
import {recordVillaReview} from './villa-review.mjs';
import {assertVerificationDocumentCapacity,activeVerificationDocumentIds} from './verification-document-limits.mjs';
import {randomUUID} from 'node:crypto';
import {audit} from './database.mjs';
export const ownershipDocumentKinds=Object.freeze({ownership:'หลักฐานกรรมสิทธิ์หรือหนังสือมอบอำนาจ',title_deed:'โฉนดที่ดิน',house_registration:'ทะเบียนบ้าน',rental_agreement:'สัญญาเช่า'});
const key=id=>'ownership_documents:'+id;
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
export async function ownershipDocuments(db,user,req,path,url,readBody,validateDocument){
 if(!['/api/merchant/ownership-documents','/api/admin/ownership-documents'].includes(path))return undefined;
 const admin=path.startsWith('/api/admin/');if(!user||user.role!==(admin?'admin':'merchant'))fail(403,'ไม่มีสิทธิ์จัดการเอกสารเจ้าของที่พัก');
 const data=req.method==='GET'?null:await readBody(req),villaId=data?.villaId||url.searchParams.get('villaId');
 let villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(villaId||'');if(!villa||!admin&&villa.owner_id!==user.id)fail(404,'ไม่พบที่พัก');
 const read=async()=>JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(villaId)))?.value||'{"revision":0,"documents":[],"history":[]}');
 if(req.method==='GET')return {...await read(),kinds:ownershipDocumentKinds,limits:{documents:10},counts:{documents:(await activeVerificationDocumentIds(db,villa)).size}};
 if(req.method!=='POST')fail(405,'ไม่รองรับคำสั่งนี้');
 return db.transaction(async()=>{await assertWriteSession(db,user);villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(villaId);if(!villa||!admin&&villa.owner_id!==user.id)fail(404,'ไม่พบที่พัก');const state=await read();if(data.revision!==state.revision)fail(409,'เอกสารมีการเปลี่ยนแปลง กรุณาโหลดใหม่');const at=new Date().toISOString();
 if(admin){
  if(data.action!=='review'||!['accepted','changes','rejected'].includes(data.status))fail(400,'ผลการตรวจไม่ถูกต้อง');
  const doc=state.documents.find(d=>d.id===data.documentId);if(!doc||doc.supersededAt||doc.removedAt)fail(404,'ไม่พบเอกสารฉบับปัจจุบัน');
  if(doc.status!=='pending')fail(409,'เอกสารฉบับนี้ตรวจแล้ว ให้ขอฉบับใหม่ผ่านประวัติการแก้ไข');
  if(typeof data.remark!=='string'||data.remark.length>2000||data.status!=='accepted'&&!data.remark.trim())fail(400,'กรุณาระบุข้อแก้ไขรายเอกสาร');
  Object.assign(doc,{status:data.status,remark:data.remark.trim(),reviewedAt:at,reviewedBy:user.id});
  state.history.push({action:'review',documentId:doc.id,kind:doc.kind,status:doc.status,remark:doc.remark,by:user.id,at});
 }else if(data.action==='remove'){
  const doc=state.documents.find(d=>d.id===data.documentId&&!d.supersededAt&&!d.removedAt);if(!doc)fail(404,'ไม่พบเอกสารฉบับปัจจุบัน');
  if(data.confirm!==true||typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>2000||/[\x00-\x1f]/.test(data.reason))fail(400,'กรุณายืนยันและระบุเหตุผลนำเอกสารออก');
  if(villa.status==='approved'){await recordVillaReview(db,villa,{...villa},'verification_documents_update',user);await db.prepare("UPDATE villas SET status='pending',reason='' WHERE id=?").run(villa.id)}
  doc.removedAt=at;doc.removedBy=user.id;state.history.push({action:'remove',documentId:doc.id,kind:doc.kind,reason:data.reason.trim(),by:user.id,at});
 }else{
  if(data.action!=='upload'||!Object.hasOwn(ownershipDocumentKinds,data.kind))fail(400,'ประเภทเอกสารไม่ถูกต้อง');
  const file=validateDocument(data.file),id=randomUUID(),active=state.documents.filter(d=>d.kind===data.kind&&!d.supersededAt&&!d.removedAt);
  if(!data.replacementDocumentId&&data.additional!==true&&active.length>1)fail(409,'กรุณาเลือกเอกสารที่ต้องการเปลี่ยน');
  const previous=data.replacementDocumentId?state.documents.find(d=>d.id===data.replacementDocumentId&&!d.supersededAt&&!d.removedAt&&d.kind===data.kind):data.additional===true?null:active[0];
  if(data.replacementDocumentId&&!previous)fail(404,'ไม่พบเอกสารที่ต้องการเปลี่ยน');
  await assertVerificationDocumentCapacity(db,villa,previous?.id);
  if(previous?.status==='pending')fail(409,'เอกสารอยู่ระหว่างตรวจสอบ กรุณารอผลก่อนส่งใหม่');
  if(villa.status==='approved'){await recordVillaReview(db,villa,{...villa},'verification_documents_update',user);await db.prepare("UPDATE villas SET status='pending',reason='' WHERE id=?").run(villa.id)}
  await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(id,user.id,file.name,file.mime,file.bytes);
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('private_document:'+id,JSON.stringify({ownerId:user.id,villaId,kind:data.kind}));
  if(previous)previous.supersededAt=at;
  state.documents.push({id,kind:data.kind,name:file.name,mime:file.mime,status:'pending',uploadedAt:at,remark:''});
  state.history.push({action:previous?'resubmit':'upload',documentId:id,kind:data.kind,previousDocumentId:previous?.id||null,by:user.id,at});
 }
 state.revision++;await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key(villaId),JSON.stringify(state));
 await audit(db,user,admin?'ownership_document.review':data.action==='remove'?'ownership_document.remove':'ownership_document.upload',villaId);
 // This review NEVER creates an Owner or approves ownership/Villa from a phone call.
 return {ok:true,...state};});
}
export async function assertOwnershipDocumentsReviewed(db,villaId){const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(villaId));if(!row)return;const state=JSON.parse(row.value);if(state.documents.some(d=>!d.supersededAt&&!d.removedAt&&d.status!=='accepted'))fail(409,'กรุณาตรวจเอกสารแต่ละรายการให้ครบก่อนอนุมัติที่พัก');}
