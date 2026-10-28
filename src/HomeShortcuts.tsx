import {t as translateSystem} from "./locale"
import {t} from "./locale"
import { useState } from "react";
import type { CSSProperties } from "react";
import type { Page } from "./prototype";
import { useCms, type HomeDiscovery } from "./cms";
import { discoveryDefaults } from "../server/cms-home-config.mjs";
import ShortcutIcon from "./ShortcutIcon";
export default function HomeShortcuts({ go, onSearch }: { go: (page: Page, item?:string) => void; onSearch: (query: string, province: string) => void }) {
  const [query, setQuery] = useState("");
  const {home}=useCms();
  const discovery={...discoveryDefaults,...home.discovery} as HomeDiscovery;
  if(!discovery.visible)return null;
  const shortcuts=discovery.shortcuts.filter(item=>item.visible);
  return <section className="home-shortcuts" style={{"--shortcut-background":discovery.background,"--shortcut-icon-color":discovery.iconColor,"--shortcut-accent-color":discovery.accentColor} as CSSProperties} aria-label={translateSystem("ค้นหาและทางลัด VillaCheck")}>
    <div className="container">
      <h1 className="sr-only">{discovery.heading}</h1>
      {discovery.searchVisible && <form className="shortcut-search" role="search" aria-label={translateSystem("ค้นหาที่พัก")} onSubmit={event => { event.preventDefault(); onSearch(query.trim(), ""); }}>
        <svg className="shortcut-search-symbol" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
        <input aria-label={discovery.placeholder} value={query} onChange={event => setQuery(event.target.value)} placeholder={discovery.placeholder} autoComplete="off" enterKeyHint="search"/>
        <button type="submit">{discovery.buttonLabel} <span aria-hidden="true">↗</span></button>
      </form>}
      {(discovery.showProvinceHint||discovery.showFreeHint)&&<p className="shortcut-search-hint">{discovery.showProvinceHint&&<button type="button" onClick={() => { const provinces = document.querySelector(".province-section"); if (provinces) provinces.scrollIntoView({ behavior: "smooth", block: "start" }); else go("directory"); }}>{discovery.provinceHint} <span aria-hidden="true">↓</span></button>}{discovery.showProvinceHint&&discovery.showFreeHint&&<span aria-hidden="true"> · </span>}{discovery.showFreeHint&&<span>{discovery.freeHint}</span>}</p>}
      {!!shortcuts.length&&<nav className="shortcut-grid" aria-label={translateSystem("เมนูลัด")}>
        {shortcuts.map(item => <a className={`shortcut-item shortcut-${item.icon}`} href={item.href} key={item.id} {...(item.href.startsWith("https:")?{target:"_blank",rel:"noopener noreferrer"}:{})} title={item.description} onClick={event => { if (item.href.startsWith("https:") || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); const params=new URLSearchParams(item.href.slice(1)); go(params.get("page") as Page, params.get("item") || undefined); }}>
          <span className="shortcut-icon">{item.image?<img src={item.image} alt=""/>:<ShortcutIcon name={item.icon}/>}</span>
          <span className="shortcut-label">{item.label}</span>
        </a>)}
      </nav>}
    </div>
  </section>;
}
