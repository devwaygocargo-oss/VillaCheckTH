import { useState } from "react";
import type { ReactNode } from "react";
import type { Page } from "./prototype";

type Shortcut = "find" | "scan" | "transfer" | "status" | "owner" | "contact";
const drawings: Record<Shortcut, ReactNode> = {
  find: <><path className="shortcut-icon-fill" d="m5 15 10-9 10 9v12H5Z"/><path d="m4 15 11-10 11 10M7 13v13h9M12 26v-8h5"/><circle cx="23" cy="22" r="5"/><path d="m27 26 4 4"/></>,
  scan: <><path d="M11 4H5v6M23 4h6v6M5 23v6h6M29 23v6h-6"/><path className="shortcut-icon-fill" d="M10 10h5v5h-5zM20 10h4v5h-4zM10 20h5v4h-5z"/><path d="M10 10h5v5h-5zM20 10h4v5h-4zM10 20h5v4h-5zM20 20h4v4M20 27h7"/><path className="shortcut-icon-accent" d="M3 17h28"/></>,
  transfer: <><path className="shortcut-icon-fill" d="M7 5h16v23H7Z"/><path d="M12 5V3h7v2M9 5H6v24h10M21 5h4v10M11 11h9M11 16h5"/><path d="m23 18 7 3v4c0 4-7 7-7 7s-7-3-7-7v-4Z"/><path className="shortcut-icon-accent" d="m20 25 2 2 4-5"/></>,
  status: <><circle className="shortcut-icon-fill" cx="17" cy="17" r="11"/><path d="M26 8a13 13 0 1 0 4 13M28 3v7h-7"/><path d="m17 8 8 3v7c0 5-8 9-8 9s-8-4-8-9v-7Z"/><path className="shortcut-icon-accent" d="m13 17 3 3 5-6"/></>,
  owner: <><path className="shortcut-icon-fill" d="m16 4 12 10v14H4V14Z"/><path d="m3 14 13-11 13 11M6 15v13h8M25 15v6M11 28v-9h7"/><circle cx="24" cy="25" r="4"/><path className="shortcut-icon-accent" d="m21 28-5 5m2-2-2-2"/></>,
  contact: <><path className="shortcut-icon-fill" d="M4 5h20v16H12l-6 5v-5H4Z"/><path d="M24 15V7a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3v5l6-5h5"/><path d="M27 12h2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3v5l-6-5h-4a3 3 0 0 1-3-3v-2"/><path className="shortcut-icon-accent" d="M9 11h9M9 16h5"/></>,
};
const shortcuts: { icon: Shortcut; label: string; page: Page; description: string }[] = [
  { icon: "find", label: "ค้นหาที่พัก", page: "directory", description: "ค้นหาที่พักด้วยชื่อไทย อังกฤษ หรือจังหวัด" },
  { icon: "scan", label: "สแกน QR", page: "scan", description: "สแกน QR ของที่พักเพื่อดูผลตรวจสอบ" },
  { icon: "transfer", label: "เช็กก่อนโอน", page: "directory", description: "ค้นหาที่พักเพื่อตรวจข้อมูลติดต่อและบัญชีทางการก่อนโอน" },
  { icon: "status", label: "เข้าใจสถานะ", page: "verification-standard", description: "อ่านความหมายและมาตรฐานของสถานะการตรวจสอบ" },
  { icon: "owner", label: "เจ้าของที่พัก", page: "owner-auth", description: "เข้าสู่ Member Room สำหรับเจ้าของที่พัก" },
  { icon: "contact", label: "ติดต่อเรา", page: "contact", description: "ติดต่อทีม VillaCheck" },
];
export default function HomeShortcuts({ go, onSearch }: { go: (page: Page) => void; onSearch: (query: string, province: string) => void }) {
  const [query, setQuery] = useState("");
  return <section className="home-shortcuts" aria-label="ค้นหาและทางลัด VillaCheck">
    <div className="container">
      <h1 className="sr-only">ค้นหาและตรวจสอบที่พักกับ VillaCheck</h1>
      <form className="shortcut-search" role="search" aria-label="ค้นหาที่พัก" onSubmit={event => { event.preventDefault(); onSearch(query.trim(), ""); }}>
        <svg className="shortcut-search-symbol" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
        <input aria-label="ค้นหาชื่อที่พัก ไทย / English" value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาชื่อที่พัก ไทย / English" autoComplete="off" enterKeyHint="search"/>
        <button type="submit">ค้นหา <span aria-hidden="true">↗</span></button>
      </form>
      <p className="shortcut-search-hint"><button type="button" onClick={() => { const provinces = document.querySelector(".province-section"); if (provinces) provinces.scrollIntoView({ behavior: "smooth", block: "start" }); else go("directory"); }}>หรือเลือกจังหวัดด้านล่างได้เลย <span aria-hidden="true">↓</span></button><span aria-hidden="true"> · </span><span>ไม่ต้องสมัครสมาชิกเพื่อดูข้อมูล</span></p>
      <nav className="shortcut-grid" aria-label="เมนูลัด">
        {shortcuts.map(item => <a className={`shortcut-item shortcut-${item.icon}`} href={`#page=${item.page}`} key={item.icon} title={item.description} onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); go(item.page); }}>
          <span className="shortcut-icon"><svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawings[item.icon]}</svg></span>
          <span className="shortcut-label">{item.label}</span>
        </a>)}
      </nav>
    </div>
  </section>;
}
