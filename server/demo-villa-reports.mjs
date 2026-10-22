import {createHash} from 'node:crypto';
import {trustDto} from './catalog.mjs';
import {loadTrustContext} from './villa-read-context.mjs';
const idFor=value=>{const h=createHash('sha256').update('demo-villa-report:'+value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`};
const cases=[
 ['basic','NEW','สอบถามช่องทางติดต่อ','ขอให้ทีมตรวจสอบช่องทางติดต่อก่อนสอบถามวันว่าง',''],
 ['starter','UNDER_REVIEW','ตรวจสอบข้อมูลก่อนจอง','รายละเอียดการเช็กอินจากช่องทางที่ได้รับไม่ตรงกับหน้าเว็บ ขอให้เจ้าของที่พักยืนยันข้อมูลล่าสุด','ทีมงานกำลังประสานเจ้าของที่พักเพื่อยืนยันข้อมูล'],
 ['pro','RESOLVED','สอบถามค่าใช้จ่ายเพิ่มเติม','ขอรายละเอียดค่าบริการและเงื่อนไขก่อนยืนยันการจอง','ทีมงานชี้แจงรายการค่าใช้จ่ายและช่องทางสอบถามกับเจ้าของที่พักแล้ว'],
 ['premium','NEW','สอบถามรูปภาพที่พัก','ต้องการภาพมุมห้องและบริเวณสระเพิ่มเติมสำหรับวางแผนทริป',''],
 ['pro','UNDER_REVIEW','สอบถามสิ่งอำนวยความสะดวก','ขอให้ยืนยันจำนวนเตียงและอุปกรณ์ครัวสำหรับจำนวนผู้เข้าพักที่ระบุ','ทีมงานรับเรื่องและรอรายละเอียดจากเจ้าของที่พัก'],
 ['premium','RESOLVED','สอบถามการเดินทาง','สอบถามเส้นทางและจุดสังเกตก่อนเดินทางไปที่พัก','ทีมงานแจ้งช่องทางรับแผนที่และข้อมูลการเดินทางกับเจ้าของที่พักแล้ว'],
];
export async function seedDemoVillaReports(db){
 return db.transaction(async()=>{
  const users=(await db.prepare("SELECT id,name,email FROM users WHERE role='user' ORDER BY email").all()).filter(u=>/^demo[-a-z0-9]*@villacheck\.example$/i.test(u.email));
  if(!users.length)return {reports:0,villas:0};
  const candidates=await db.prepare("SELECT v.* FROM villas v JOIN users u ON u.id=v.owner_id WHERE u.email LIKE 'demo%@villacheck.example' AND v.status='approved' AND v.qr IS NOT NULL AND (v.payments>0 OR v.package_id='basic') ORDER BY v.id").all();
  const context=await loadTrustContext(db,candidates),villas=[];
  for(const villa of candidates)if((await trustDto(db,villa,context)).qrStatus==='ACTIVE')villas.push(villa);
  const existing=new Set((await db.prepare("SELECT id FROM support_reports WHERE reference LIKE 'RPT-DUMMY-VILLA-%'").all()).map(r=>r.id));
  let reports=0;const used=new Set();
  for(const [index,[plan,status,type,detail,note]]of cases.entries()){
   const id=idFor(String(index)),villa=villas.find(v=>v.package_id===plan),user=users[index%users.length];if(existing.has(id)||!villa)continue;
   const created=new Date(Date.now()-(index+1)*86400000).toISOString();
   const result=await db.prepare('INSERT INTO support_reports(id,reference,user_id,villa_id,villa_name,type,detail,reporter,contact,status,admin_note,public_note,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id,'RPT-DUMMY-VILLA-'+String(index+1).padStart(3,'0'),user.id,villa.id,villa.name,type,`DUMMY — รายงานสาธิต ไม่ใช่เหตุการณ์หรือข้อร้องเรียนจริง: ${villa.name} (${villa.province}) — ${detail}`,user.name,user.email,status,'DUMMY: บันทึกภายในสำหรับทดสอบการติดตามรายงาน',note?'DUMMY — '+note:'',created,created);
   if(result.changes){reports++;used.add(villa.id);}
  }
  return {reports,villas:used.size};
 },{timeout:120000});
}
