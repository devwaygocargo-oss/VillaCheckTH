import {useEffect,useRef,useState} from "react";
import {api} from "./api";
import {useCms,useCopy,usePresentation} from "./cms";
import type {Page} from "./prototype";
import {popularProvinces} from "./ProvinceExplorer";
type Villa={id:string;name:string;nameEn:string;province:string;qr:string;qrStatus:string;photoUrl:string;updated:string|null;premiumBanner:boolean;guestCapacity:number|null};
const statusLabel:Record<string,string>={ACTIVE:"ตรวจสอบข้อมูลแล้ว",EXPIRED:"หมดอายุ",SUSPENDED:"ถูกระงับ",INACTIVE:"ปิดใช้งาน",PENDING:"รอตรวจสอบ"};
export default function HomeVillaShowcase({go,onSearch}:{go:(page:Page,item?:string)=>void;onSearch:(query:string,province:string)=>void}){
 const t=useCopy(),presentation=usePresentation();
 const {home}=useCms(),section=home.sections.find(s=>s.id==="showcase");
 const [province,setProvince]=useState(""),[items,setItems]=useState<Villa[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[attempt,setAttempt]=useState(0),[position,setPosition]=useState({start:true,end:true,index:0});
 const track=useRef<HTMLDivElement>(null);
 useEffect(()=>{let active=true;setLoading(true);setError("");setItems([]);setPosition({start:true,end:true,index:0});track.current?.scrollTo({left:0});const params=new URLSearchParams({limit:String(presentation.showcaseLimit)});if(province)params.set("province",province);void api<{villas:Villa[]}>("/public/villas?"+params).then(data=>{if(active)setItems(data.villas);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[province,attempt,presentation.showcaseLimit]);
 const measure=()=>{const el=track.current,card=el?.firstElementChild as HTMLElement|null;if(!el||!card)return;setPosition({start:el.scrollLeft<2,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-2,index:Math.max(0,Math.min(items.length-1,Math.round(el.scrollLeft/(card.getBoundingClientRect().width+20))))});};
 useEffect(()=>{const el=track.current;if(!el)return;const observer=new ResizeObserver(measure);observer.observe(el);measure();return()=>observer.disconnect();},[items,loading]);
 const move=(direction:number)=>{const el=track.current,card=el?.firstElementChild as HTMLElement|null;if(el&&card)el.scrollBy({left:direction*(card.getBoundingClientRect().width+20),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 return <section className="section villa-discovery-section" aria-labelledby="villa-discovery-title"><div className="container">
  <div className="villa-discovery-heading"><div><span className="kicker">{t("home.showcaseKicker")}</span><h2 id="villa-discovery-title" className="cms-prose">{section?.title||"ที่พักที่ลงทะเบียนกับ VillaCheck"}</h2><p>{section?.description||"ดูภาพ อ่านข้อมูล และตรวจสถานะของที่พักก่อนตัดสินใจ"}</p></div><button className="villa-discovery-all" onClick={()=>onSearch("",province)}>{t("home.showcaseAll")} <span aria-hidden="true">↗</span></button></div>
  <nav className="villa-province-tabs" aria-label="เลือกจังหวัดของที่พัก">{["",...presentation.provinces.slice(0,5)].map(name=><button type="button" key={name} aria-pressed={province===name} aria-controls="villa-discovery-track" onClick={()=>setProvince(name)}>{name||t("home.showcaseProvince")}</button>)}</nav>
  <div id="villa-discovery-track" className="villa-discovery-track" ref={track} onScroll={measure} aria-busy={loading} aria-label={province?`ที่พักใน${province}`:"ที่พักทุกจังหวัด"}>
    {loading?Array.from({length:4},(_,index)=><div key={index} className="villa-discovery-skeleton" aria-hidden="true"><div/><span/><span/></div>):items.map(villa=><a className="discovery-villa-card" key={villa.id} href={`#page=verify&item=${encodeURIComponent(villa.qr)}`} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();go("verify",villa.qr);}}>
      <div className="discovery-villa-photo"><img src={villa.photoUrl||"/villa-placeholder.svg"} alt={`ภาพ ${villa.name}`} loading="lazy"/><span className={`discovery-villa-status${villa.qrStatus==="ACTIVE"?"":" inactive"}`}><span aria-hidden="true">{villa.qrStatus==="ACTIVE"?"✓":"◷"}</span>{statusLabel[villa.qrStatus]||villa.qrStatus}</span>{villa.premiumBanner&&<span className="discovery-villa-premium">✦ Premium Verified</span>}</div>
      <div className="discovery-villa-body"><span className="discovery-villa-location">{villa.province}</span><h3>{villa.name}</h3>{villa.nameEn&&villa.nameEn!==villa.name&&<p className="discovery-villa-english">{villa.nameEn}</p>}<div className="discovery-villa-meta"><span>{villa.guestCapacity===null?"ไม่ระบุจำนวนผู้เข้าพัก":`สูงสุด ${villa.guestCapacity} คน`}</span><span>Trust Profile <span aria-hidden="true">↗</span></span></div><small>{villa.updated?`ตรวจล่าสุด ${new Date(villa.updated).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Bangkok"})}`:"ยังไม่มีข้อมูลวันที่ตรวจ"}</small></div>
    </a>)}
  </div>
  {!loading&&error&&<div className="villa-discovery-message" role="alert"><p>{error}</p><button onClick={()=>setAttempt(n=>n+1)}>ลองโหลดอีกครั้ง</button></div>}
  {!loading&&!error&&!items.length&&<div className="villa-discovery-message"><p>ยังไม่มีที่พักที่แสดง{province?`ใน${province}`:"ในขณะนี้"}</p><button onClick={()=>setProvince("")}>ดูจังหวัดอื่น</button></div>}
  {items.length>0&&!loading&&<div className="villa-discovery-controls"><span>{position.start&&position.end?`แสดง ${items.length} รายการ`:`${position.index+1} / ${items.length}`}</span><div><button type="button" aria-label="Villa ก่อนหน้า" disabled={position.start} onClick={()=>move(-1)}>←</button><button type="button" aria-label="Villa ถัดไป" disabled={position.end} onClick={()=>move(1)}>→</button></div></div>}
 </div></section>;
}
