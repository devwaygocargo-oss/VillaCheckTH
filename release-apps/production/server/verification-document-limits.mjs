export const verificationDocumentLimit=10;
export async function activeVerificationDocumentIds(db,villa){
 const ids=new Set(villa.document_id?[villa.document_id]:[]),rows=await db.prepare('SELECT key,value FROM system_settings WHERE key=? OR key=?').all('ownership_documents:'+villa.id,'owner_verification:'+villa.id);
 for(const row of rows){const state=JSON.parse(row.value);if(row.key.startsWith('ownership_documents:')){for(const d of state.documents||[])if(!d.supersededAt&&!d.removedAt)ids.add(d.id)}else{for(const f of Object.values(state.files||{}))if(f?.id)ids.add(f.id)}}return ids;
}
export async function assertVerificationDocumentCapacity(db,villa,replacingId){const ids=await activeVerificationDocumentIds(db,villa);if(replacingId&&ids.has(replacingId))return;if(ids.size>=verificationDocumentLimit)throw Object.assign(Error('เอกสารประกอบการตรวจสอบรวมได้ไม่เกิน 10 ไฟล์ กรุณาเปลี่ยนไฟล์เดิมแทนการเพิ่ม'),{status:409,code:'DOCUMENT_LIMIT_EXCEEDED'});}
