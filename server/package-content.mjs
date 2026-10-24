export const socialSinglePostFeature='ภาพเดี่ยว (Single Post) 1 โพสต์ต่อเดือนบนทุก Social ของ VillaCheck';
export const normalizeSocialFeatures=features=>[...new Set(features.filter(f=>!(/วิดีโอ|วีดีโอ|video/i.test(f)&&/โพสต์|ชิ้น|อัน|คลิป|post|social|คอนเทนต์|โปรโมท/i.test(f))).map(f=>f==='ภาพเดี่ยว 1 โพสต์ต่อเดือนบนทุก Social ของ VillaCheck'?socialSinglePostFeature:f))];
export const onlineVerificationFeatures=['ยืนยันตัวตนเจ้าของบ้านในระดับสูงขึ้น','สแกนหน้าโดยส่งภาพ/วิดีโอให้ Admin ตรวจ','ตรวจทะเบียนบ้านประกอบการยืนยันเจ้าของบ้าน'];
export const basicVerificationNotice='Basic Verify เป็นการตรวจสอบข้อมูลเบื้องต้น ไม่รับประกันว่าที่พักจะไม่โกงหรือบ้านตรงปก';
export const premiumGuaranteeFeature='การันตีบ้านตรงปก';
export const footerAdFeature="โฆษณาขนาดเล็ก 1 ชิ้นก่อน Footer หน้าแรก";
const basic=['หน้ารายละเอียดที่พัก','QR ประจำที่พัก','อัปโหลดรูปภาพ','ตรวจเอกสารและผู้มีสิทธิ์ดูแลเบื้องต้น','ลูกค้าเขียนรีวิวได้','Basic Verify แสดงหลังทีมอนุมัติ'];
const online=[...basic,'อัปโหลดวิดีโอ',...onlineVerificationFeatures];
const social=[...online,'ส่งรูปภาพให้ทีมทาง Facebook เดือนละ 1 ครั้ง',footerAdFeature,socialSinglePostFeature,'ทีมตรวจสอบรีวิวตามกติกาก่อนเผยแพร่','รวมงบโฆษณาบนทุก Social ของ VillaCheck'];
export const packageContent={
 basic:{description:`${basicVerificationNotice} · ราคาปกติ 990 บาท ช่วงโปรโมชั่นลด 100% ยอดสุทธิ 0 บาท ระยะเวลาและเงื่อนไขต่ออายุรอประกาศ`,features:basic},
 starter:{description:'เพิ่มวิดีโอได้ พร้อมยืนยันตัวตนเจ้าของบ้านในระดับสูงขึ้นด้วยการสแกนหน้าและตรวจทะเบียนบ้าน โดยทีมตรวจอนุมัติตามหลักฐาน',features:online},
 pro:{description:'ภาพเดี่ยว (Single Post) 1 โพสต์ต่อเดือนบนทุก Social ของ VillaCheck รวมงบโฆษณา',features:social},
 premium:{description:'สิทธิ์ทั้งหมด พร้อมแบนเนอร์หน้าแรก',features:[...social,'ส่งวิดีโอให้ทีมทาง Facebook เดือนละ 1 ครั้ง','แบนเนอร์ขนาดใหญ่หน้าแรก','วิดีโอ 1 ชิ้นต่อเดือนบนทุก Social ของ VillaCheck']},
};
