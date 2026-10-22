import {createHash} from 'node:crypto';
import {dummyPdf} from './demo-seed.mjs';
import {trustDto} from './catalog.mjs';
import {loadTrustContext} from './villa-read-context.mjs';
const idFor=value=>{const h=createHash('sha256').update('demo-owner-proof:'+value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`};
export async function seedDemoOwnerVerification(db){
 return db.transaction(async()=>{
  const villas=await db.prepare("SELECT v.* FROM villas v JOIN users u ON u.id=v.owner_id WHERE u.email LIKE 'demo%@villacheck.example' AND v.status='approved' AND v.payments>0 AND v.package_id IN ('starter','pro','premium') ORDER BY v.id").all();
  const context=await loadTrustContext(db,villas),existing=new Set((await db.prepare("SELECT key FROM system_settings WHERE key LIKE 'owner_verification:%'").all()).map(r=>r.key));
  const counts={starter:0,pro:0,premium:0};
  for(const villa of villas){
   const key='owner_verification:'+villa.id;if(existing.has(key)||(await trustDto(db,villa,context)).qrStatus!=='ACTIVE')continue;
   const now=new Date().toISOString(),files={};
   for(const slot of ['face','house']){
    const id=idFor(villa.id+':'+slot),name=slot==='face'?'DUMMY-face-placeholder.png':'DUMMY-house-proof-NOT-LEGAL.pdf',type=slot==='face'?'image/png':'application/pdf';
    // Deliberate placeholder image; no person's biometric image or real household document.
    const bytes=slot==='face'?Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV3sAAAAASUVORK5CYII=','base64'):dummyPdf({Purpose:'DUMMY OWNER VERIFICATION - NOT A LEGAL DOCUMENT',Villa:villa.id});
    await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id,villa.owner_id,name,type,bytes);
    files[slot]={id,name,type,url:'/api/documents/'+id,uploadedAt:now};
   }
   const row={villaId:villa.id,ownerId:villa.owner_id,ownerName:'เจ้าของที่พัก DUMMY',status:'accepted',revision:1,demo:true,files,checks:{faceMatched:true,houseMatched:true,ownerConfirmed:true},consentAt:now,submittedAt:now,reviewedAt:now,reviewedBy:null,reviewedByName:'ระบบสาธิต — ไม่ใช่การตรวจหลักฐานจริง',updatedAt:now,history:[{action:'demo_seed',status:'accepted',by:null,at:now,reason:'DUMMY success scenario; no real identity verification'}]};
   await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run(key,JSON.stringify(row));counts[villa.package_id]++;
  }
  return counts;
 },{timeout:120000});
}
