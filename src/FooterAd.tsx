import {useCopy,usePresentation} from "./cms";
import {useEffect,useState,useRef} from "react";
import {api} from "./api";
import type {HomeBannerItem} from "./cms";
export default function FooterAd(){
 const t=useCopy(),presentation=usePresentation();
 const [ads,setAds]=useState<HomeBannerItem[]>([]),slot=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!presentation.footerAdsVisible)return;
  let active=true,started=false,timer:number|undefined;
  const load=()=>void api<{advertisements:HomeBannerItem[]}>("/public/advertisements?placement=footer").then(({advertisements})=>{if(active)setAds(advertisements.slice(0,presentation.footerAdLimit));}).catch(()=>{if(active)setAds([]);});
  const refreshed=()=>{if(started)load()};const changed=(event:StorageEvent)=>{if(event.key==="villacheck-advertisements-updated")refreshed()};window.addEventListener("villacheck-advertisements-updated",refreshed);window.addEventListener("storage",changed);
  const start=()=>{if(started)return;started=true;load();timer=window.setInterval(load,30000);};
  const observer=typeof IntersectionObserver!=="undefined"?new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))start();},{rootMargin:"600px"}):null;
  if(observer&&slot.current)observer.observe(slot.current);else start();
  return()=>{active=false;window.removeEventListener("villacheck-advertisements-updated",refreshed);window.removeEventListener("storage",changed);observer?.disconnect();if(timer)window.clearInterval(timer);};
 },[presentation.footerAdLimit,presentation.footerAdsVisible]);
 if(!presentation.footerAdsVisible)return null;
 return <div ref={slot} className="footer-ad-slot">{ads.length>0&&<aside className="footer-ad" aria-label="พื้นที่โฆษณาก่อน Footer"><div className="container"><div className="footer-ad-heading"><span className="kicker">{t("footerAds.kicker")}</span><h2>{t("footerAds.title")}</h2><p>{t("footerAds.description")}</p></div><div className="footer-ad-grid" role="list" aria-label="โฆษณาที่พักแนะนำ">{ads.map(ad=><article className="footer-ad-card" key={ad.id} role="listitem"><picture>{ad.mobileImage&&<source media="(max-width:640px)" srcSet={ad.mobileImage}/>}<img src={ad.image} alt={ad.title} loading="lazy"/></picture><div className="footer-ad-copy"><span className="footer-ad-label">{ad.demo?"โฆษณา · แพ็กเกจ 2,990 บาท/เดือน":"พื้นที่โฆษณาที่พัก"}</span><h3>{ad.title}</h3><p>{ad.description}</p></div><a className="footer-ad-link" href={ad.href||"#page=directory"} {...(ad.href?.startsWith("https:")?{target:"_blank",rel:"noopener noreferrer"}:{})}>{ad.label||"ดูรายละเอียด"} <span aria-hidden="true">↗</span></a></article>)}</div></div></aside>}</div>;
}
