import {createHash} from "node:crypto";
import {hashPassword} from "./database.mjs";

export const freeDemoSamples=[
 ["Pattaya Palm Free Demo Villa","พัทยาปาล์ม","ชลบุรี"],
 ["Bang Saen Breeze Free Demo Villa","บางแสนบรีซ","ชลบุรี"],
 ["Hua Hin Sand Free Demo Villa","หัวหินแซนด์","ประจวบคีรีขันธ์"],
 ["Pranburi Green Free Demo Villa","ปราณบุรีกรีน","ประจวบคีรีขันธ์"],
 ["Khao Yai Meadow Free Demo Villa","เขาใหญ่เมโดว์","นครราชสีมา"],
 ["Pak Chong Valley Free Demo Villa","ปากช่องวัลเลย์","นครราชสีมา"],
 ["Phuket Coral Free Demo Villa","ภูเก็ตคอรัล","ภูเก็ต"],
 ["Rawai Retreat Free Demo Villa","ราไวย์รีทรีต","ภูเก็ต"],
 ["Chiang Mai Fern Free Demo Villa","เชียงใหม่เฟิร์น","เชียงใหม่"],
 ["Mae Rim Mist Free Demo Villa","แม่ริมมิสต์","เชียงใหม่"],
 ["Krabi Cove Free Demo Villa","กระบี่โคฟ","กระบี่"],
 ["Ao Nang Haven Free Demo Villa","อ่าวนางเฮเวน","กระบี่"],
 ["Rayong Dune Free Demo Villa","ระยองดูน","ระยอง"],
 ["Mae Phim Calm Free Demo Villa","แม่พิมพ์คาล์ม","ระยอง"],
 ["Phang Nga Grove Free Demo Villa","พังงาโกรฟ","พังงา"],
 ["Khao Lak Horizon Free Demo Villa","เขาหลักฮอไรซัน","พังงา"],
 ["Cha Am Bloom Free Demo Villa","ชะอำบลูม","เพชรบุรี"],
 ["Phetchaburi Nest Free Demo Villa","เพชรบุรีเนสต์","เพชรบุรี"],
 ["Samui Blue Free Demo Villa","สมุยบลู","สุราษฎร์ธานี"],
 ["Samui Island Free Demo Villa","สมุยไอแลนด์","สุราษฎร์ธานี"],
];
const idFor=name=>{const h=createHash("sha256").update("villacheck-free-demo-v1:"+name).digest("hex");return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
// Keep each free Villa in its own account. Batch inserts bound bootstrap time
// on remote PostgreSQL; all fields are complete on first insert and never reset
// subsequent Merchant/Admin edits, purchases, documents or QR identities.
export async function seedFreeDemo(db,password,pdf){
 const now=new Date().toISOString(),company="ธุรกิจสาธิต — ไม่ใช่ที่พักจริง";
 const entries=freeDemoSamples.map(([english,thai,province],index)=>({english,name:thai+" · DUMMY",province,email:`demo-free-${String(index+1).padStart(2,"0")}@villacheck.example`,id:idFor(english),ownerId:idFor(english+"-owner"),doc:idFor(english+"-document"),image:`/demo/villas/villa-${index%9+1}.jpg`,guests:index%2?8:12}));
 const old=await db.prepare(`SELECT id,email,role FROM users WHERE email IN (${entries.map(()=>"?").join(",")})`).all(...entries.map(e=>e.email));
 for(const entry of entries){const owner=old.find(u=>u.email===entry.email);if(owner){if(owner.role!=="merchant")throw Error("Free demo owner role mismatch");entry.ownerId=owner.id;}}
 const insert=async(table,columns,rows,conflict)=>{if(!rows.length)return;await db.prepare(`INSERT INTO ${table}(${columns.join(",")}) VALUES ${rows.map(row=>"("+row.map(()=>"?").join(",")+")").join(",")} ON CONFLICT(${conflict}) DO NOTHING`).run(...rows.flat());};
 const missing=entries.filter(e=>!old.some(u=>u.email===e.email));
 if(missing.length){const hashed=hashPassword(password);await insert("users",["id","email","name","password_hash","role","created","business_name","business_name_en","phone","address"],missing.map(e=>[e.ownerId,e.email,"เจ้าของที่พักตัวอย่าง "+e.name,hashed,"merchant",now,company,"DUMMY business - no real bookings","0800000000","DUMMY address - not a real business location"]),"id");}
 await insert("subscriptions",["owner_id","package_id","payments","created","lifecycle"],entries.map(e=>[e.ownerId,"basic",0,now,"PENDING_RENEWAL"]),"owner_id");
 await insert("documents",["id","owner_id","name","mime","bytes"],entries.map(e=>[e.doc,e.ownerId,"dummy-ownership.pdf","application/pdf",pdf({"Villa ID":e.id,"Villa name":e.english,"Merchant email":e.email,"Purpose":"DUMMY free Basic Verify - no purchase, payment or real property rights"})]),"id");
 await insert("villas",["id","owner_id","name","name_en","province","merchant","email","package_id","document_id","status","qr","payments","created","phone","bank_name","account_name","account_number","verification_level","photo_url","guest_capacity"],entries.map(e=>[e.id,e.ownerId,e.name,e.english,e.province,company,e.email,"basic",e.doc,"approved","VC-DEMO-"+e.id,0,now,"0800000000","ธนาคารตัวอย่าง — ห้ามโอนเงินจริง","บัญชีสาธิต","0000000000","BASIC_CHECKED",e.image,e.guests]),"id");
 return entries.length;
}
