export const onlineVerificationFeatures=['ยืนยันตัวตนเจ้าของบ้านในระดับสูงขึ้น','สแกนหน้าโดยส่งภาพ/วิดีโอให้ Admin ตรวจ','ตรวจทะเบียนบ้านประกอบการยืนยันเจ้าของบ้าน'];
export const basicVerificationNotice='Basic Verify เป็นการตรวจสอบข้อมูลเบื้องต้น ไม่รับประกันว่าที่พักจะไม่โกงหรือบ้านตรงปก';
export const premiumGuaranteeFeature='การันตีบ้านตรงปก';
export const footerAdFeature="โฆษณาขนาดเล็ก 1 ชิ้นก่อน Footer หน้าแรก";
const basic=['QR ประจำที่พัก','อัปโหลดรูปภาพ','ตรวจเอกสารและผู้มีสิทธิ์ดูแลเบื้องต้น','ลูกค้าเขียนรีวิวได้','Basic Verify แสดงหลังทีมอนุมัติ'];
const online=[...basic,'อัปโหลดวิดีโอ',...onlineVerificationFeatures];
const social=[...online,footerAdFeature,'แบนเนอร์โฆษณาในหน้ารายละเอียดที่พัก','ภาพเดี่ยว 1 โพสต์ต่อเดือนบนทุก Social ของ VillaCheck','ทีมตรวจสอบรีวิวตามกติกาก่อนเผยแพร่','รวมงบโฆษณาบนทุก Social ของ VillaCheck'];
export const packageContent={
 basic:{description:`${basicVerificationNotice} · ใช้สิทธิ์ฟรีไม่มีกำหนดจนกว่าจะเลือกซื้อ`,features:basic},
 starter:{description:'เพิ่มวิดีโอได้ พร้อมยืนยันตัวตนเจ้าของบ้านในระดับสูงขึ้นด้วยการสแกนหน้าและตรวจทะเบียนบ้าน โดยทีมตรวจอนุมัติตามหลักฐาน',features:online},
 pro:{description:'โฆษณาที่พักและคอนเทนต์รายเดือน',features:social},
 premium:{description:'สิทธิ์ทั้งหมด พร้อมแบนเนอร์หน้าแรกและการันตีบ้านตรงปก',features:[...social,'แบนเนอร์ขนาดใหญ่หน้าแรก','วิดีโอ 1 ชิ้นต่อเดือนบนทุก Social ของ VillaCheck',premiumGuaranteeFeature]},
};
