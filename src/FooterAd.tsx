import {useEffect,useState,useRef} from "react";
import {api} from "./api";
import type {HomeBannerItem} from "./cms";
export default function FooterAd(){
 const [ad,setAd]=useState<HomeBannerItem|null>(null),slot=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  let active=true,started=false,timer:number|undefined;
  const load=()=>void api<{advertisements:HomeBannerItem[]}>("/public/advertisements?placement=footer").then(({advertisements})=>{if(active)setAd(advertisements[0]||null);}).catch(()=>{if(active)setAd(null);});
  const start=()=>{if(started)return;started=true;load();timer=window.setInterval(load,30000);};
  const observer=typeof IntersectionObserver!=="undefined"?new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))start();},{rootMargin:"600px"}):null;
  if(observer&&slot.current)observer.observe(slot.current);else start();
  return()=>{active=false;observer?.disconnect();if(timer)window.clearInterval(timer);};
 },[]);
 return <div ref={slot} className="footer-ad-slot">{ad&&<aside className="footer-ad" aria-label="พื้นที่โฆษณาก่อน Footer"><div className="container"><div className="footer-ad-card"><picture>{ad.mobileImage&&<source media="(max-width:640px)" srcSet={ad.mobileImage}/>}<img src={ad.image} alt="" loading="lazy"/></picture><div className="footer-ad-copy"><span className="footer-ad-label">{ad.demo?"โฆษณาตัวอย่าง · แพ็กเกจ 2,990 บาท/เดือน":"พื้นที่โฆษณาที่พัก"}</span><h2>{ad.title}</h2><p>{ad.description}</p></div><a className="footer-ad-link" href={ad.href||"#page=directory"} {...(ad.href?.startsWith("https:")?{target:"_blank",rel:"noopener noreferrer"}:{})}>{ad.label||"ดูรายละเอียด"} <span aria-hidden="true">↗</span></a></div></div></aside>}</div>;
}
