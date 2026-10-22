export const introBannerImage="/demo/diverse/photo-37736542.jpg"
export function introBanner(home){return {id:"villacheck-intro",image:home.introImage||introBannerImage,mobileImage:"",title:home.title,description:home.description,href:home.buttonHref||"#page=directory",label:home.buttonLabel||"ค้นหาที่พัก",visible:home.introVisible!==false,sponsored:false,startsAt:"",endsAt:""}}
export function editorialBanners(home){
 const rows=home.banners?.length?home.banners:home.images.map((image,i)=>({id:`legacy-slide-${i}`,image,mobileImage:"",title:home.title,description:home.description,href:home.buttonHref||"#page=directory",label:home.buttonLabel||"ค้นหาที่พัก",visible:i===0,sponsored:false,startsAt:"",endsAt:""}))
 const selected=home.introVisible!==false?null:rows.find(row=>row.visible)?.id
 return rows.map(row=>({...row,visible:row.id===selected}))
}
export function selectEditorialBanner(home,id){return {...home,introVisible:id==="villacheck-intro",banners:editorialBanners({...home,introVisible:false}).map(row=>({...row,visible:row.id===id}))}}

const inTime=(b,now)=>b.visible!==false&&(!b.startsAt||Date.parse(b.startsAt)<=now)&&(!b.endsAt||Date.parse(b.endsAt)>now)
export function carouselBanners(home,presentation,advertisements,now=Date.now()){
 if(home.sections?.find(s=>s.id==="hero")?.visible===false)return []
 const editorial=editorialBanners(home).filter(b=>inTime(b,now)),ads=advertisements.filter(b=>inTime(b,now)&&b.approved!==false&&b.eligible!==false)
 const primary=home.introVisible!==false?[introBanner(home)]:editorial.slice(0,1)
 return [...primary,...(presentation.bannerSource==="editorial-first"&&primary.length?[]:ads)]
}
export function bannerDisplayStatus(row,home,presentation,advertisements,now=Date.now()){
 if(!row.visible)return "ปิดแสดงผล"
 if(row.kind==="ad"&&!row.approved)return "รออนุมัติ"
 if(row.startsAt&&Date.parse(row.startsAt)>now)return "รอเริ่มแสดง"
 if(row.endsAt&&Date.parse(row.endsAt)<=now)return "สิ้นสุดแล้ว"
 if(row.kind==="ad"&&row.eligible===false)return "ไม่แสดง · สิทธิ์แพ็กเกจไม่พร้อม"
 if(row.category==="footer"){
  if(!presentation.footerAdsVisible)return "ปิดส่วนโฆษณาก่อน Footer"
  const eligible=advertisements.filter(a=>a.placement==="footer"&&inTime(a,now)&&a.approved&&a.eligible).sort((a,b)=>a.order-b.order)
  return eligible.slice(0,presentation.footerAdLimit).some(a=>a.id===row.id)?"อยู่ในรายการก่อน Footer":"ไม่แสดง · เกินจำนวนที่ตั้งไว้"
 }
 if(row.category==="detail")return row.eligible?"พร้อมสุ่มแสดง":"รอตรวจสิทธิ์แพ็กเกจ"
 if(home.sections?.find(s=>s.id==="hero")?.visible===false)return "ปิด Section หน้าแรก"
 const activeAds=advertisements.filter(a=>a.placement==="home"&&a.eligible&&a.approved)
 if(carouselBanners(home,presentation,activeAds,now).some(b=>b.id===row.id))return "อยู่ในชุด Carousel"
 return row.kind==="ad"?"ไม่แสดง · ใช้สไลด์ CMS ก่อน":"ไม่แสดง · ใช้โฆษณาก่อน"
}
