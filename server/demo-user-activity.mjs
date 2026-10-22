import {createHash} from 'node:crypto';
import {trustDto} from './catalog.mjs';
const idFor=value=>createHash('sha256').update('demo-user-activity:'+value).digest('hex').slice(0,32);
// Extend existing demo accounts only. Never create credentials or rewrite historical activity.
export async function seedDemoUserActivity(db){
 return db.transaction(async()=>{
  const users=(await db.prepare("SELECT id,name,email FROM users WHERE role='user'").all()).filter(u=>/^demo[-a-z0-9]*@villacheck\.example$/i.test(u.email)||/^DEMO User 0?[1-3]$/i.test(u.name.trim()));
  const villas=await db.prepare("SELECT v.* FROM villas v JOIN users u ON u.id=v.owner_id WHERE v.status='approved' AND v.qr IS NOT NULL AND u.email LIKE 'demo%@villacheck.example' ORDER BY v.id LIMIT 6").all();
  let checks=0,reports=0;
  for(const user of users)for(const [index,villa] of villas.entries()){
   const trust=await trustDto(db,villa),matched=index%3!==1&&trust.qrStatus==='ACTIVE';
   const account=index%3===1?'9999999999':villa.account_number;
   const created=new Date(Date.now()-(index+1)*86400000).toISOString();
   const id=idFor(user.id+':check:'+villa.id);
   const result=`รายการสาธิต: ตรวจข้อมูล ${villa.name} (${villa.province}) — `+(index%3===1?'เลขบัญชีที่ได้รับไม่ตรงกับข้อมูลที่พัก ควรตรวจสอบกับเจ้าของก่อนโอน':trust.qrStatus!=='ACTIVE'?'QR ยังไม่พร้อมใช้งาน ควรรอการตรวจสอบก่อนโอน':'เบอร์ติดต่อและเลขบัญชีตรงกับข้อมูลที่ลงทะเบียน ณ เวลาตรวจสอบ ไม่ใช่การรับประกันการจอง');
   checks+=(await db.prepare('INSERT INTO user_checks(id,reference,user_id,villa_id,villa_name,qr,status,result,submitted_account,submitted_contact,request_key,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id,'CHK-'+id,user.id,villa.id,villa.name,villa.qr,matched?'MATCHED':'REVIEW_REQUIRED',result,account,villa.phone,'demo-activity-'+villa.id,created)).changes;
   if(index>=3)continue;
   const reportId=idFor(user.id+':report:'+villa.id),status=['NEW','UNDER_REVIEW','RESOLVED'][index];
   const detail=`รายการสาธิตสำหรับ ${villa.name} (${villa.province}): `+['ขอให้ตรวจสอบช่องทางติดต่อก่อนยืนยันการจอง ยังไม่มีการโอนเงินจริง','ได้รับเลขบัญชี 9999999999 ซึ่งไม่ตรงกับข้อมูลลงทะเบียน ขอให้ทีมงานตรวจสอบก่อนโอน','สอบถามวิธีอ่านระดับการตรวจสอบและข้อมูลที่พัก ทีมงานอธิบายข้อมูลเรียบร้อยแล้ว'][index];
   reports+=(await db.prepare('INSERT INTO support_reports(id,reference,user_id,villa_id,villa_name,type,detail,reporter,contact,status,public_note,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(reportId,'RPT-'+reportId,user.id,villa.id,villa.name,'สอบถามข้อมูลที่พัก',detail,user.name,user.email,status,index===2?'รายการสาธิต: ทีมงานชี้แจงระดับการตรวจสอบแล้ว กรุณาตรวจข้อมูลล่าสุดก่อนจอง ไม่มีธุรกรรมจริง':'',created,created)).changes;
  }
  return {accounts:users.length,namedDemoAccounts:users.filter(u=>/^DEMO User 0?[1-3]$/i.test(u.name.trim())).length,checks,reports};
 });
}
