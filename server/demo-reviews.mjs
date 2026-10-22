import {createHash} from 'node:crypto';
import {trustDto} from './catalog.mjs';
import {loadTrustContext} from './villa-read-context.mjs';
const reviewId=value=>{const h=createHash('sha256').update('demo-review:'+value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`};
// Seed labelled reviews only for existing demo users and demo-owned properties.
// Never overwrite a review or an Admin decision on a subsequent deployment.
export async function seedDemoReviews(db){
 return db.transaction(async()=>{
  const users=(await db.prepare("SELECT id,name,email FROM users WHERE role='user' ORDER BY email").all()).filter(u=>/^demo[-a-z0-9]*@villacheck\.example$/i.test(u.email));
  const candidates=await db.prepare("SELECT v.*,p.amount,p.name AS package_name FROM villas v JOIN users u ON u.id=v.owner_id JOIN package_catalog p ON p.id=v.package_id WHERE u.email LIKE 'demo%@villacheck.example' AND v.status='approved' AND v.qr IS NOT NULL ORDER BY v.id").all();
  const context=await loadTrustContext(db,candidates);
  const villas=[];for(const villa of candidates)if((await trustDto(db,villa,context)).qrStatus==='ACTIVE')villas.push(villa);
  const existing=(await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'customer_review:%'").all()).map(r=>JSON.parse(r.value));
  const seen=new Set(existing.map(r=>r.userId+':'+r.villaId));let published=0,pending=0;
  for(const [index,user] of users.entries())for(const plan of ['basic','starter','pro','premium']){
   const villa=villas.find(v=>v.package_id===plan&&!seen.has(user.id+':'+v.id));
   if(!villa || existing.some(r=>r.demoFixture==='demo-reviews-v1'&&r.userId===user.id&&r.packageId===plan))continue;
   const id=reviewId(user.id+':'+plan),moderationRequired=villa.amount>=299000,createdAt=new Date(Date.now()-(index+1)*86400000).toISOString();
   const content=`DUMMY — รีวิวสาธิตสำหรับทดสอบระบบ ไม่ใช่ประสบการณ์เข้าพักจริง: ${villa.name} (${villa.province}) — `+(index%2?'ข้อมูลที่พักอ่านเข้าใจง่าย แต่อยากให้เพิ่มภาพมุมห้องและรายละเอียดการเดินทางให้ชัดเจนขึ้น':'ภาพและข้อมูลสิ่งอำนวยความสะดวกช่วยให้เปรียบเทียบที่พักได้สะดวก ก่อนจองควรตรวจช่องทางติดต่อและบัญชีล่าสุดอีกครั้ง');
   const review={id,villaId:villa.id,villaName:villa.name,userId:user.id,author:user.name,content,rating:index%2?3:4,status:moderationRequired?'pending':'published',moderationRequired,packageId:plan,packageName:villa.package_name,publishedAt:moderationRequired?null:createdAt,createdAt,history:[],demoFixture:'demo-reviews-v1'};
   const result=await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run('customer_review:'+id,JSON.stringify(review));
   if(result.changes){seen.add(user.id+':'+villa.id);if(moderationRequired)pending++;else published++;}
  }
  return {accounts:users.length,published,pending};
 },{timeout:120000});
}
