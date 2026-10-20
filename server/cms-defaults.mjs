const pages = {
  about: {
    kicker: "ABOUT VILLACHECK",
    title: "เกี่ยวกับ VillaCheck",
    description: "Trust before transfer.",
    body: "VillaCheck เป็นแพลตฟอร์มตรวจสอบข้อมูลที่พัก ช่องทางติดต่อ และบัญชีรับเงิน เพื่อช่วยให้ผู้ใช้งานมีข้อมูลประกอบการตัดสินใจก่อนโอน",
  },
  "verification-standard": {
    kicker: "VERIFICATION STANDARD",
    title: "มาตรฐานการตรวจสอบ",
    description: "หลักการตรวจสอบข้อมูลของ VillaCheck",
    body: "กระบวนการตรวจสอบครอบคลุมข้อมูลตัวตน ช่องทางติดต่อ บัญชีรับเงิน QR Reference วันตรวจสอบล่าสุด และวันหมดอายุของสถานะ",
  },
  "owner-guide": {
    kicker: "MERCHANT GUIDE",
    title: "คู่มือสำหรับเจ้าของที่พัก",
    description: "เริ่มต้นสร้าง Trust Profile ให้ Villa ของคุณ",
    body: "ศึกษาขั้นตอนลงทะเบียน เพิ่มข้อมูล Villa ส่งข้อมูลตรวจสอบ จัดการ QR และติดตามสถานะผ่าน Merchant Dashboard",
  },
  help: {
    kicker: "HELP / SUPPORT",
    title: "ศูนย์ช่วยเหลือ",
    description: "ค้นหาคำตอบและช่องทางรับความช่วยเหลือ",
    body: "ดูคำแนะนำเกี่ยวกับการค้นหาที่พัก การตรวจสอบก่อนโอน การสแกน QR การแจ้งปัญหา และการจัดการข้อมูลสำหรับเจ้าของที่พัก",
  },
  contact: {
    kicker: "CONTACT VILLACHECK",
    title: "ติดต่อเรา",
    description: "ทีมงานพร้อมช่วยเหลือในวันจันทร์–ศุกร์ เวลา 09:00–18:00 น.",
    body: "ฝากข้อมูลให้ทีมงานติดต่อกลับ หรือส่งอีเมลผ่านช่องทางด้านล่าง",
  },
  privacy: {
    kicker: "LEGAL",
    title: "นโยบายความเป็นส่วนตัว",
    description: "การใช้ข้อมูลบัญชีและข้อมูลการตรวจสอบที่พัก",
    body: "VillaCheck เก็บชื่อ อีเมล และตัวระบุบัญชีจากช่องทางที่คุณเลือกสมัคร เพื่อสร้างบัญชีและเข้าสู่ระบบ รวมถึงประวัติ Checks รายงานปัญหา เอกสาร Merchant และหลักฐานชำระเงิน เพื่อให้ Admin ตรวจสอบ ข้อมูลติดต่อและบัญชีของ Merchant แสดงตามสิทธิ์สมาชิก ไม่เผยเอกสารส่วนตัวต่อ Guest ข้อมูลที่ระบุ Demo เป็นข้อมูลสาธิต หากต้องการสอบถามหรือขอลบข้อมูล ติดต่อ villacheck69@gmail.com โดยระบุอีเมลบัญชี เราจะตรวจสอบความเป็นเจ้าของก่อนดำเนินการ รายการที่เกี่ยวกับธุรกรรมหรือข้อพิพาทอาจต้องเก็บไว้เท่าที่จำเป็น",
  },
  terms: {
    kicker: "LEGAL",
    title: "ข้อกำหนดและเงื่อนไข",
    description: "เงื่อนไขการใช้ระบบตรวจสอบข้อมูลที่พัก",
    body: "VillaCheck ให้บริการตรวจสอบข้อมูลที่พัก ไม่รับจองและไม่รับเงินค่าที่พัก สถานะการตรวจสอบสะท้อนเอกสารที่ Admin ตรวจและอายุ Subscription ณ เวลาที่แสดง ไม่ใช่การรับประกันการจองหรือการปลอดภัยจากการฉ้อโกง Merchant ต้องมีสิทธิ์ในเอกสารและส่งข้อมูลที่ถูกต้อง ค่าบริการแพ็กเกจชำระหลังเอกสารผ่านและเปิดใช้หลัง Admin ยืนยันสลิป โปรดตรวจยอดและระยะเวลาในใบแจ้งชำระก่อนชำระ ข้อมูล Demo และ Payment ทดสอบใช้เพื่อทดสอบระบบเท่านั้น ห้ามโอนเงินจริง หากต้องการแก้ไขข้อมูลหรือสอบถามเกี่ยวกับค่าบริการ ติดต่อ villacheck69@gmail.com",
  },
}
const articles = {
  "เช็ก 5 จุดก่อนโอนค่าที่พัก":
    "ตรวจสอบชื่อที่พัก ตัวตนผู้ประกอบการ ช่องทางติดต่อ บัญชีรับเงิน และสถานะล่าสุดก่อนโอน เก็บหลักฐานประกาศและการสนทนาไว้ประกอบการตรวจสอบ",
  "QR Verification ช่วยตรวจสอบอะไรบ้าง":
    "QR เชื่อมไปยังข้อมูลและสถานะของที่พัก ควรตรวจรหัส ชื่อ Villa และวันอัปเดตให้ตรงกับประกาศ การพบ QR ไม่ได้ยืนยันว่าคนที่ส่งประกาศเป็นเจ้าของที่พัก",
  วิธีสังเกตช่องทางติดต่อทางการ:
    "เปรียบเทียบเบอร์โทรและบัญชีสื่อสารกับข้อมูลใน Trust Profile หากมีผู้ขอเปลี่ยนบัญชีรับเงินหรือให้ติดต่อช่องทางใหม่ ควรยืนยันกับช่องทางเดิมก่อน",
}
const images = [
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1400&q=88",
  "https://images.unsplash.com/photo-1514803400321-3ca29fc47334?auto=format&fit=crop&w=1200&q=86",
  "https://images.unsplash.com/photo-1555426104-3a03a4e70b1d?auto=format&fit=crop&w=1200&q=86",
  "https://images.unsplash.com/photo-1756115377696-0bdbf1c21a02?auto=format&fit=crop&w=1200&q=86",
]
export const cmsDefaults = {
  schemaVersion: 1,
  business:{emailOtpSubject:"VillaCheck: รหัสเข้าสู่ระบบ",emailOtpBody:"รหัส OTP ของคุณคือ {{code}} ใช้ได้ {{minutes}} นาที ห้ามให้รหัสนี้กับผู้อื่น",smsOtpBody:"VillaCheck OTP: {{code}}. Expires in {{minutes}} minutes. Do not share.",emailOtpTemplateId:"",facebookLoginEnabled:false,monthlyInitialMonths:1,monthlyRenewalMonths:1,paymentEmailSubject:"VillaCheck: {{package}} แจ้งชำระแพ็กเกจ",paymentEmailIntro:"เรียน {{merchant}}\nกรุณาตรวจยอดและระยะเวลาในใบแจ้งชำระ แล้วแนบสลิปให้ Admin ตรวจสอบ"},
  site: {
    name: "VillaCheck",
    description: "Trust before transfer.",
    email: "",
    phone: "",
    facebook: "https://www.facebook.com/villacheckth/",
    instagram: "",
    line: "https://line.me/R/ti/p/@villacheckth",
    hours: "จันทร์–ศุกร์ 09:00–18:00 น.",
    paymentInstructions: "",
    paymentQrImage: "",
    logo: "",
    accent: "#173e51",
  },
  navigation: [
    {
      id: "directory",
      label: "ค้นหาวิลล่า",
      href: "#page=directory",
      visible: true,
    },
    { id: "scan", label: "ตรวจสอบก่อนโอน", href: "#page=scan", visible: true },
    {
      id: "report",
      label: "แจ้งปัญหา",
      href: "#page=villa-report",
      visible: true,
    },
    { id: "contact", label: "ติดต่อเรา", href: "#page=contact", visible: true },
    { id: "login", label: "เข้าสู่ระบบ", href: "#page=login", visible: true },
  ],
  home: {
    eyebrow: "TRUST INTELLIGENCE FOR TRAVEL",
    title: "เช็กให้ชัด\nก่อนออกเดินทาง\nก่อนโอนทุกครั้ง",
    description:
      "ค้นหาและตรวจสอบ Villa ผ่านข้อมูลตัวตน ช่องทางติดต่อ บัญชีรับเงิน และ QR Verification ในมุมมองเดียว",
    images,
    blocks: [],
    sections: [
      { id: "hero", visible: true, title: "", description: "" },
      { id: "promotion", visible: true, title: "", description: "" },
      {
        id: "how",
        visible: true,
        title: "ตรวจสอบใน 3 ขั้นตอน",
        description:
          "จากการค้นหา ไปจนถึงหลักฐานที่ตรวจสอบย้อนกลับได้\nออกแบบเพื่อช่วงเวลาก่อนตัดสินใจโอน",
      },
      { id: "provinces", visible: true, title: "", description: "" },
      {
        id: "showcase",
        visible: true,
        title: "ที่พักพร้อมหลักฐาน\nไม่ใช่แค่ภาพสวย",
        description: "สำรวจ Trust metadata ที่สำคัญก่อนตัดสินใจ",
      },
      {
        id: "qr",
        visible: true,
        title: "หนึ่งสแกน\nเห็นหลักฐานที่จำเป็น",
        description:
          "QR ของ VillaCheck เชื่อมผู้เดินทางกับข้อมูลตรวจสอบล่าสุด โดยไม่พาเข้าสู่ขั้นตอนจองหรือชำระเงิน",
      },
      {
        id: "merchant",
        visible: true,
        title: "สร้างความน่าเชื่อถือ\nให้ที่พักของคุณ",
        description:
          "เปลี่ยนความมั่นใจให้เป็นโอกาสทางธุรกิจ ด้วย Trust Profile, QR Verification และข้อมูลเชิงลึกที่ช่วยให้ลูกค้าตัดสินใจง่ายขึ้น",
      },
      {
        id: "pricing",
        visible: true,
        title: "ทำให้ความน่าเชื่อถือ\nมองเห็นและตรวจสอบได้",
        description: "",
      },
      { id: "custom", visible: true, title: "", description: "" },
    ],
  },
  pages: Object.entries(pages).map(([slug, p]) => ({ slug, ...p, blocks: [] })),
  articles: Object.entries(articles).map(([title, body], i) => ({
    id: "guide-" + (i + 1),
    title,
    description: "คำแนะนำจาก VillaCheck สำหรับการตรวจสอบข้อมูลที่พัก",
    body,
    image: "",
    visible: true,
  })),
  faqs: [],
}
