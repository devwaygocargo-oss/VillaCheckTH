// Shared by CMS validation, the editor and public rendering. No runtime secrets.
export const shortcutIcons = [
  {id:"find",label:"บ้านและแว่นขยาย"},{id:"scan",label:"กรอบสแกน QR"},
  {id:"transfer",label:"เอกสารและโล่"},{id:"status",label:"โล่ตรวจสอบสถานะ"},
  {id:"owner",label:"บ้านและกุญแจ"},{id:"contact",label:"กล่องสนทนา"},
];
export const publicDestinations = [
  {href:"#page=directory",label:"ค้นหาที่พัก / เช็กก่อนโอน"},
  {href:"#page=scan",label:"สแกน QR"},{href:"#page=verification-standard",label:"เข้าใจสถานะ / มาตรฐานการตรวจสอบ"},
  {href:"#page=owner-auth",label:"เข้าสู่ระบบเจ้าของที่พัก"},{href:"#page=owner-guide",label:"คู่มือเจ้าของที่พัก"},
  {href:"#page=contact",label:"ติดต่อเรา"},{href:"#page=villa-report",label:"แจ้งปัญหา"},
  {href:"#page=about",label:"เกี่ยวกับเรา"},{href:"#page=articles",label:"บทความ"},
  {href:"#page=gallery",label:"รูปที่พัก"},{href:"#page=help",label:"ช่วยเหลือ"},{href:"#page=login",label:"เข้าสู่ระบบ"},
];
export const discoveryDefaults = {
  visible:true,searchVisible:true,heading:"ค้นหาและตรวจสอบที่พักกับ VillaCheck",
  placeholder:"ค้นหาชื่อที่พัก ไทย / English",buttonLabel:"ค้นหา",
  showProvinceHint:true,provinceHint:"หรือเลือกจังหวัดด้านล่างได้เลย",showFreeHint:false,freeHint:"",
  background:"#102a33",iconColor:"#7ce1da",accentColor:"#f7d98b",
  shortcuts:[
    {id:"find",icon:"find",label:"ค้นหาที่พัก",href:"#page=directory",description:"ค้นหาที่พักด้วยชื่อไทย อังกฤษ หรือจังหวัด",visible:true,image:""},
    {id:"scan",icon:"scan",label:"สแกน QR",href:"#page=scan",description:"สแกน QR ของที่พักเพื่อดูผลตรวจสอบ",visible:true,image:""},
    {id:"transfer",icon:"transfer",label:"เช็กก่อนโอน",href:"#page=directory",description:"ค้นหาที่พักเพื่อตรวจข้อมูลติดต่อและบัญชีทางการก่อนโอน",visible:true,image:""},
    {id:"status",icon:"status",label:"เข้าใจสถานะ",href:"#page=verification-standard",description:"อ่านความหมายและมาตรฐานของสถานะการตรวจสอบ",visible:true,image:""},
    {id:"owner",icon:"owner",label:"เจ้าของที่พัก",href:"#page=owner-auth",description:"เข้าสู่ Member Room สำหรับเจ้าของที่พัก",visible:true,image:""},
    {id:"contact",icon:"contact",label:"ติดต่อเรา",href:"#page=contact",description:"ติดต่อทีม VillaCheck",visible:true,image:""},
  ],
};
export function isPublicNavigation(item) {
  return !["home","how","pricing"].includes(item.id) &&
    !["#page=home","#how","#page=pricing","#page=owner-package"].includes(item.href) &&
    !["หน้าหลัก","วิธีการทำงาน","แพ็กเกจเจ้าของที่พัก"].includes(typeof item.label==="string"?item.label.trim():"");
}
/** @template {{id:string,label:string,href:string,visible:boolean}} T
 * @param {T[]} items
 * @returns {T[]}
 */
export function publicNavigation(items) {
  const rows=items.filter(isPublicNavigation).map(item=>item.href==="#page=contact"?{...item,visible:true}:item);
  if(!rows.some(item=>item.href==="#page=contact")){
    let id="contact";while(rows.some(item=>item.id===id))id+="-link";
    const contact={id,label:"ติดต่อเรา",href:"#page=contact",visible:true};
    const login=rows.findIndex(item=>item.href==="#page=login");rows.splice(login<0?rows.length:login,0,/** @type {T} */ (contact));
  }
  return rows;
}
export const newsSectionDefault={id:"news",visible:true,title:"ข่าวสารและอัปเดต",description:"เรื่องน่ารู้และคำแนะนำ เพื่อทุกการเดินทางที่มั่นใจ"};
export function homeConfig(home) {
  const sections=[...home.sections];
  if(!sections.some(s=>s.id==="news"))sections.splice(Math.max(0,sections.findIndex(s=>s.id==="showcase")+1),0,{...newsSectionDefault});
  const discovery={...discoveryDefaults,...home.discovery,shortcuts:home.discovery?.shortcuts??discoveryDefaults.shortcuts};
  if(discovery.freeHint==="ไม่ต้องสมัครสมาชิกเพื่อดูข้อมูล"){discovery.freeHint="";discovery.showFreeHint=false;}
  return {...home,sections,buttonLabel:home.buttonLabel??"ค้นหาที่พัก",buttonHref:home.buttonHref??"#page=directory",discovery};
}
export function shortcutMediaUrls(content,publicOnly=false) {
  const discovery=content.home.discovery;
  if(!discovery || publicOnly&&!discovery.visible)return [];
  return discovery.shortcuts.filter(item=>!publicOnly||item.visible).map(item=>item.image).filter(Boolean);
}
