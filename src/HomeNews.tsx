import {t as translateSystem} from "./locale"
import {t} from "./locale"
import HomeMarketingImage from "./HomeMarketingImage";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useCms,useCopy,usePresentation } from "./cms";
import type { Page } from "./prototype";
export default function HomeNews({go}:{go:(page:Page,item?:string)=>void}){
  const t=useCopy(),presentation=usePresentation();
  const {home,articles}=useCms(),section=home.sections.find(s=>s.id==="news");
  const items=articles.filter(a=>a.visible).slice(0,presentation.newsLimit),track=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState({start:true,end:true,index:0});
  const signature=items.map(a=>a.id).join(",");
  const measure=()=>{const el=track.current;if(!el)return;const first=el.firstElementChild as HTMLElement|null;const step=first?first.getBoundingClientRect().width+20:1;setPosition({start:el.scrollLeft<2,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-2,index:Math.round(el.scrollLeft/step)});};
  useEffect(()=>{const el=track.current;if(!el)return;const observer=new ResizeObserver(measure);observer.observe(el);measure();return()=>observer.disconnect();},[signature]);
  const move=(direction:number)=>{const el=track.current,card=el?.firstElementChild as HTMLElement|null;if(el&&card)el.scrollBy({left:direction*(card.getBoundingClientRect().width+20),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  if(!items.length)return null;
  return <section className="home-news section" aria-labelledby="home-news-title"><div className="container">
    <div className="home-news-heading"><div><span className="kicker">{translateSystem("ข่าวจาก VillaCheck")}</span><h2 id="home-news-title">{section?.title||translateSystem("ข่าวสารและอัปเดต")}</h2><p>{(section?.description === "เรื่องน่ารู้และคำแนะนำ เพื่อทุกการเดินทางที่มั่นใจ" ? translateSystem("ประกาศจากแพลตฟอร์มและคำแนะนำสำหรับผู้ใช้งานและเจ้าของที่พัก") : section?.description)||translateSystem("ประกาศจากแพลตฟอร์มและคำแนะนำสำหรับผู้ใช้งานและเจ้าของที่พัก")}</p></div><a className="home-news-all" href="#page=articles" onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();go("articles");}}>{t("home.newsAll")} <span aria-hidden="true">↗</span></a></div>
    <div className="home-news-track" style={{"--news-card-width":`calc((100% - ${20*(Math.min(items.length,4)-1)}px) / ${Math.min(items.length,4)})`} as CSSProperties} ref={track} onScroll={measure} aria-label={translateSystem("รายการข่าวสาร")}>
      {items.map((item,index)=><a className="home-news-card" key={item.id} href={`#page=article-detail&item=${encodeURIComponent(item.id)}`} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();go("article-detail",item.id);}}>
        <div className={`home-news-art home-news-art-${index%3}`}>
          <HomeMarketingImage kind="news" src={item.image}/>
          <span className="home-news-tag">{translateSystem("ข้อมูลและคำแนะนำ")}</span>
        </div>
        <div className="home-news-body"><h3>{item.title}</h3><p>{item.description}</p><span className="home-news-read">{t("home.newsRead")} <span aria-hidden="true">↗</span></span></div>
      </a>)}
    </div>
    <div className="home-news-controls"><span className="home-news-count" aria-live="polite">{Math.min(position.index+1,items.length)} / {items.length}</span><div><button type="button" aria-label={translateSystem("ข่าวสารก่อนหน้า")} disabled={position.start} onClick={()=>move(-1)}>←</button><button type="button" aria-label={translateSystem("ข่าวสารถัดไป")} disabled={position.end} onClick={()=>move(1)}>→</button></div></div>
  </div></section>;
}
