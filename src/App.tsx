import AdminAccounts from "./AdminAccounts";
import {useCopy,usePresentation} from "./cms";
import HomeLogoLink from "./HomeLogoLink";
import HomeVillaShowcase from "./HomeVillaShowcase";
import FooterAd from "./FooterAd";
import HomeNews from "./HomeNews";
import {publicNavigation} from "../server/cms-home-config.mjs";
import HomeShortcuts from "./HomeShortcuts";
import {qrReference as parseQrReference} from "./qrReference";
import HomeBanner from "./HomeBanner";
import AdminReceivingBank from "./AdminReceivingBank";
import AdminApprovedVillas from "./AdminApprovedVillas";
import AdminPendingVillas from "./AdminPendingVillas";
import AdminLogin from "./AdminLogin";
import AdminAccess from "./AdminAccess";
import AdminCms from "./AdminCms";
import DemoNotice from "./DemoNotice";
import { CmsProvider, CmsBlocks, CmsHomeLayout, useCms } from "./cms";
import OperationsPortal from "./OperationsPortal";
import MerchantProfile from "./MerchantProfile";
import AdminBusiness from "./AdminBusiness";
import { selectedPlanKey, packageIntentKey } from "./packagePlans";
import type { Account } from "./merchantStore";
import { api, ApiError, currentAccount, logout } from "./api";
import VillaMap from "./VillaMap";
import ProvinceExplorer, { popularProvinces } from "./ProvinceExplorer";
import { UserRegistration, AdminUsers, MemberDashboard } from "./UserAccounts";
import Backoffice, { MerchantVerification } from "./Backoffice";
import { openSupport, supportHref } from "./support";
import { usePageNavigation } from "./navigation";
import { useEffect, useRef, useState } from "react";
import type { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { PortalShell, LoginPage, OwnerPackageAuth, OwnerRegistration, PublicInfoPage, PublicReportPage, PublicReportSuccess, type Page, type UserReport, UserPages } from "./prototype";
type IconName =
  | "search"
  | "pin"
  | "users"
  | "check"
  | "shield"
  | "arrow"
  | "phone"
  | "mail"
  | "clock"
  | "qr"
  | "chart"
  | "home"
  | "wifi"
  | "pool"
  | "car"
  | "kitchen"
  | "bed"
  | "info"
  | "camera"
  | "upload"
  | "facebook"
  | "instagram"
  | "message"
  | "menu"
  | "close";

const photos = [
  "/demo/villas/villa-1.jpg",
  "/demo/villas/villa-2.jpg",
  "/demo/villas/villa-3.jpg",
  "/demo/villas/villa-4.jpg",
];

const villas = [
  { name: "Sea Sky Pool Villa", province: "ชลบุรี", guests: "12 คน", status: "ตรวจสอบข้อมูลแล้ว", updated: "18 มิ.ย. 2568", image: photos[0] },
  { name: "Khao Yai Forest Pool", province: "นครราชสีมา", guests: "10 คน", status: "ตรวจสอบข้อมูลแล้ว", updated: "16 มิ.ย. 2568", image: photos[1] },
  { name: "Hua Hin Blue House", province: "ประจวบคีรีขันธ์", guests: "8 คน", status: "ตรวจสอบข้อมูลแล้ว", updated: "12 มิ.ย. 2568", image: photos[2] },
  { name: "Phuket Ocean Residence", province: "ภูเก็ต", guests: "14 คน", status: "รอตรวจสอบ", updated: "08 มิ.ย. 2568", image: photos[3] },
  { name: "Chiang Mai Garden Villa", province: "เชียงใหม่", guests: "8 คน", status: "ตรวจสอบข้อมูลแล้ว", updated: "06 มิ.ย. 2568", image: photos[1] },
  { name: "Krabi Cliff Pool Villa", province: "กระบี่", guests: "10 คน", status: "ตรวจสอบข้อมูลแล้ว", updated: "04 มิ.ย. 2568", image: photos[2] },
  { name: "Samui Sunset Residence", province: "สุราษฎร์ธานี", guests: "12 คน", status: "รอตรวจสอบ", updated: "02 มิ.ย. 2568", image: photos[0] },
];

const provinces = popularProvinces;

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.3 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" />,
    mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 7L2 7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 13h3M13 20h3" /></>,
    chart: <><path d="M4 19V9M10 19V4M16 19v-7M22 19H2" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-7h6v7" /></>,
    wifi: <><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="20" r="1" /></>,
    pool: <><path d="M2 15c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 20c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M7 15V5a3 3 0 0 1 6 0M7 10h6" /></>,
    car: <><path d="M5 17h14l1-5-2-5H6l-2 5 1 5Z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
    kitchen: <><path d="M6 3v8M3 3v5a3 3 0 0 0 6 0V3M6 11v10M16 3v18M16 3c4 2 5 8 0 10" /></>,
    bed: <><path d="M3 20v-8h18v8M3 16h18M7 12V8h5a4 4 0 0 1 4 4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    camera: <><path d="M14.5 5 13 3h-2L9.5 5H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4.5Z" /><circle cx="12" cy="12.5" r="4" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
    facebook: <path d="M14 8h4V3h-4a6 6 0 0 0-6 6v3H4v5h4v5h5v-5h4l1-5h-5V9a1 1 0 0 1 1-1Z" />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".5" fill="currentColor" /></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.7-5A7 7 0 0 1 3 12V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5Z" /><path d="M8 10h8M8 14h5" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Logo({ light = false }: { light?: boolean }) {
  const {site}=useCms();
  return <div className={`logo ${light ? "logo-light" : ""}`}><span className="logo-mark">{site.logo?<img src={site.logo} alt="" style={{width:32,height:32,objectFit:"contain"}}/>:<Icon name="shield" size={24} />}</span><span>{site.name === "VillaCheck" ? <>Villa<span>Check</span></> : site.name}</span></div>;
}

function Badge({ pending = false, children = "ตรวจสอบข้อมูลแล้ว" }: { pending?: boolean; children?: React.ReactNode }) {
  return <span className={`badge ${pending ? "badge-pending" : ""}`}><span className="badge-icon"><Icon name={pending ? "clock" : "check"} size={12} /></span>{children}</span>;
}

const accountHome = (account: Account): Page => account.role === "admin" ? "admin-dashboard" : account.role === "merchant" ? "owner-dashboard" : "user-dashboard";
const accountLabel = (account: Account) => `บัญชี ${account.role === "admin" ? "Admin" : account.role === "merchant" ? "Merchant" : "User"}`;

function Header({ page, go, account, preview=false }: { page: Page; go: (page: Page) => void; account: Account | null; preview?:boolean }) {
  const t=useCopy();
  const {navigation}=useCms();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const accountMenu = useRef<HTMLDivElement>(null);
  useEffect(() => { setAccountMenuOpen(false); setLogoutError(""); }, [page, account?.id]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!accountMenu.current?.contains(event.target as Node)) setAccountMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && accountMenu.current?.querySelector("[aria-expanded=true]")) { setAccountMenuOpen(false); accountMenu.current?.querySelector<HTMLButtonElement>(".nav-account-button")?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const signOut = async () => {
    setLoggingOut(true); setLogoutError("");
    try { await logout(); setAccountMenuOpen(false); go("home"); }
    catch (error) { setLogoutError(error instanceof Error ? error.message : "ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setLoggingOut(false); }
  };
  useEffect(() => { setMobileMenuOpen(false); }, [page]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileMenuOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  const reportIssue = () => {
    setMobileMenuOpen(false);
    go("villa-report");
  };
  const showHowItWorks = () => {
    setMobileMenuOpen(false);
    if (page !== "home") go("home");
    window.setTimeout(() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  const navigate = (next: Page) => {
    setMobileMenuOpen(false);
    if(!preview)go(next);
  };

  return <header className="header">
    <div className="container nav">
      <HomeLogoLink className="logo-button" onNavigate={() => navigate("home")}><Logo /></HomeLogoLink>
      <nav id="public-menu" className={mobileMenuOpen ? "mobile-open" : ""}>
        {publicNavigation(navigation).filter(n=>n.visible && !(account && ["#page=login","#page=owner-auth","#page=admin-login"].includes(n.href))).map(n=><button key={n.id} className={n.href===`#page=${page}`?"active":""} onClick={()=>{if(preview)return;setMobileMenuOpen(false);if(n.href==="#how"){showHowItWorks();}else if(n.href.startsWith("https:")){window.open(n.href,"_blank","noopener,noreferrer");}else{if(account && ["#page=login","#page=owner-auth","#page=admin-login"].includes(n.href)) go(accountHome(account)); else window.location.hash=n.href;}}}>{account && ["#page=login","#page=owner-auth","#page=admin-login"].includes(n.href) ? accountLabel(account) : n.label}</button>)}
      </nav>
      <div className="nav-actions">{account && <div className="nav-account" ref={accountMenu}><button className="outline-button nav-account-button" title={`${account.name} · ${accountLabel(account)}`} aria-expanded={accountMenuOpen} aria-controls="account-dropdown" onClick={() => setAccountMenuOpen(open => !open)}><span className="nav-session-status" role="status"><span aria-hidden="true">●</span> เข้าสู่ระบบอยู่</span><strong>{accountLabel(account)} <span aria-hidden="true">▾</span></strong></button>{accountMenuOpen && <div id="account-dropdown" className="account-dropdown"><strong>{account.name}</strong><button onClick={() => navigate(accountHome(account))}>ไปยังบัญชี {account.role === "admin" ? "Admin" : account.role === "merchant" ? "Merchant" : "User"}</button><button disabled={loggingOut} onClick={() => void signOut()}>{loggingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</button>{logoutError && <p role="alert">{logoutError}</p>}</div>}</div>}<button aria-label={t("header.qr")} className="outline-button nav-qr-button" onClick={() => navigate("scan")}><Icon name="qr" size={17} /><span>{t("header.qr")}</span></button><button className="mobile-menu-button" aria-label={mobileMenuOpen ? "ปิดเมนู" : "เปิดเมนู"} aria-expanded={mobileMenuOpen} aria-controls="public-menu" onClick={() => setMobileMenuOpen(open => !open)}><Icon name={mobileMenuOpen ? "close" : "menu"} size={22} /></button></div>
    </div>
  </header>;
}

function VillaCard({ villa, onClick }: { villa: typeof villas[0] & {premiumBanner?:boolean}; onClick: () => void }) {
  return <article className="villa-card" onClick={onClick}>
    <div className="card-image"><img src={villa.image} alt={`ภาพ ${villa.name}`} /><Badge pending={villa.status !== "ตรวจสอบข้อมูลแล้ว"}>{villa.status}</Badge></div>
    <div className="card-body">
      <h3>{villa.name}</h3>{villa.premiumBanner && <small>✦ Premium Verified</small>}
      <div className="villa-meta"><span><Icon name="pin" size={17} />{villa.province}</span>{villa.guests !== "ไม่ระบุ" && <span><Icon name="users" size={17} />สูงสุด {villa.guests}</span>}</div>
      <div className="card-foot"><span><Icon name="clock" size={15} />อัปเดตล่าสุด {villa.updated}</span><button aria-label={`ดู ${villa.name}`} onClick={event => { event.stopPropagation(); onClick(); }}><Icon name="arrow" size={18} /></button></div>
    </div>
  </article>;
}

function SearchBox({ onSearch }: { onSearch: (query: string, province: string) => void }) {
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("");
  return <div className="search-box">
    <label><span>ชื่อวิลล่าหรือที่พัก</span><div><Icon name="search" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาชื่อวิลล่า..." /></div></label>
    <label><span>จังหวัด</span><div><Icon name="pin" /><select value={province} onChange={event => setProvince(event.target.value)}><option value="">ทุกจังหวัด</option>{provinces.map(item => <option key={item}>{item}</option>)}</select></div></label>
    <button className="primary-button" onClick={() => onSearch(query, province)}><Icon name="search" size={18} />ค้นหา</button>
  </div>;
}

function Home({ go, onSearch }: { go: (p: Page, item?: string) => void; onSearch: (query: string, province: string) => void; onSelect: (id: string) => void }) {
  const {home}=useCms();const t=useCopy(),presentation=usePresentation();
  const section=(id:string)=>home.sections.find(s=>s.id===id)!;
  return <CmsHomeLayout>
    <section className="home-discovery"><HomeBanner/><HomeShortcuts go={go} onSearch={onSearch}/></section>
    <div />
    <section className="section how-section" id="how">
      <div className="container">
        <div className="timeline-head"><div><span className="kicker">{t("home.journeyKicker")}</span><h2 className="cms-prose">{section("how").title}</h2></div><p className="cms-prose">{section("how").description}</p></div>
        <div className="home-service-grid">
          {presentation.services.filter(item=>item.visible).map((item,index)=><a key={item.id} className="home-service-card" href={item.href} {...(item.href.startsWith("https:")?{target:"_blank",rel:"noopener noreferrer"}:{})}><div className={`home-service-art home-service-art-0${index%3+1}`}>{item.image?<img src={item.image} alt="" loading="lazy"/>:<><span>{item.number}</span><Icon name={item.icon as IconName} size={46}/><i aria-hidden="true"/></>}</div><div className="home-service-body"><h3>{item.title}</h3><p>{item.description}</p><span>{item.label} <Icon name="arrow" size={16}/></span></div></a>)}
        </div>
      </div>
    </section>

    <ProvinceExplorer onSearch={onSearch} />

    <HomeVillaShowcase go={go} onSearch={onSearch}/>

    <HomeNews go={go}/>

    <section className="section home-feature-banner home-feature-qr">
      <div className="container home-feature-layout">
        <div className="home-feature-image"><img src={section("qr").image||"/demo/villas/villa-1.jpg"} alt="ภาพประกอบที่พักสำหรับตรวจสอบ QR" loading="lazy"/><div className="home-feature-image-note"><Icon name="qr" size={26}/><div><small>{t("home.qrNoteKicker")}</small><strong>{t("home.qrNote")}</strong></div></div></div>
        <div className="home-feature-copy"><span className="kicker">{t("home.qrKicker")}</span><h2 className="cms-prose">{section("qr").title}</h2><p>{section("qr").description}</p><ul><li><Icon name="check" size={17}/>{t("home.qrBullet1")}</li><li><Icon name="check" size={17}/>{t("home.qrBullet2")}</li><li><Icon name="check" size={17}/>{t("home.qrBullet3")}</li></ul><a className="primary-button" href={presentation.cta.qr}>{t("home.qrButton")} <Icon name="arrow" size={17}/></a></div>
      </div>
    </section>
    <section className="section home-feature-banner home-feature-merchant">
      <div className="container home-feature-layout">
        <div className="home-feature-image"><img src={section("merchant").image||"/demo/villas/villa-3.jpg"} alt="ภาพประกอบพูลวิลล่าสำหรับเจ้าของที่พัก" loading="lazy"/><div className="home-feature-image-note"><Icon name="shield" size={26}/><div><small>{t("home.ownerNoteKicker")}</small><strong>{t("home.ownerNote")}</strong></div></div></div>
        <div className="home-feature-copy"><span className="kicker">{t("home.ownerKicker")}</span><h2 className="cms-prose">{section("merchant").title}</h2><p>{section("merchant").description}</p><div className="home-merchant-tools"><span><Icon name="shield" size={17}/>{t("home.ownerTool1")}</span><span><Icon name="qr" size={17}/>{t("home.ownerTool2")}</span><span><Icon name="chart" size={17}/>{t("home.ownerTool3")}</span></div><a className="primary-button" href={presentation.cta.merchant}>{t("home.ownerButton")} <Icon name="arrow" size={17}/></a></div>
      </div>
    </section>

    <div />
    <div className="container"><CmsBlocks blocks={home.blocks}/></div>
  </CmsHomeLayout>;
}

function Directory({ go, initialQuery = "", initialProvince = "" }: { go: (p: Page, item?: string) => void; initialQuery?: string; initialProvince?: string }) {
  const t=useCopy();
  const [query, setQuery] = useState(initialQuery);
  const [province, setProvince] = useState(initialProvince);
  const [status, setStatus] = useState("");
  const [guests, setGuests] = useState("");
  const [sort, setSort] = useState("ล่าสุด");
  const [liveVillas,setLiveVillas]=useState<(typeof villas[number] & {qr:string;nameEn:string;premiumBanner:boolean;createdAt:string})[]>([]);
  const [directoryError,setDirectoryError]=useState("");
  useEffect(()=>{let active=true;void api<{villas:{name:string;nameEn:string;province:string;qr:string;qrStatus:string;photoUrl:string;updated:string|null;createdAt:string;premiumBanner:boolean;guestCapacity:number|null}[]}>("/public/villas").then(data=>{if(active)setLiveVillas(data.villas.map(v=>({...v,createdAt:v.updated || v.createdAt,updated:v.updated ? new Date(v.updated).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Bangkok"}) : "ยังไม่มีข้อมูลวันที่ตรวจ",guests:v.guestCapacity == null ? "ไม่ระบุ" : `${v.guestCapacity} คน`,status:({ACTIVE:"ตรวจสอบข้อมูลแล้ว",EXPIRED:"หมดอายุ",SUSPENDED:"ถูกระงับ",INACTIVE:"ปิดใช้งาน",PENDING:"รอตรวจสอบ"} as Record<string,string>)[v.qrStatus] || v.qrStatus,image:v.photoUrl || "/villa-placeholder.svg"})));}).catch(e=>{if(active)setDirectoryError(e.message);});return()=>{active=false;};},[]);
  const filtered = [...liveVillas]
    .filter(v => `${v.name} ${v.nameEn || ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(v => !province || v.province === province)
    .filter(v => !status || v.status === status)
    .filter(v => !guests || (guests === "unknown" ? v.guests === "ไม่ระบุ" : guests === "small" ? Number.parseInt(v.guests) <= 8 : guests === "medium" ? Number.parseInt(v.guests) >= 9 && Number.parseInt(v.guests) <= 14 : Number.parseInt(v.guests) >= 15))
    .sort((a, b) => sort === "A–Z" ? a.name.localeCompare(b.name) : Date.parse(b.createdAt)-Date.parse(a.createdAt));
  return <main className="page-bg">
    <div className="page-hero container"><span className="kicker">{t("directory.kicker")}</span><h1>{t("directory.title")}</h1><p>{t("directory.description")}</p></div>
    <div className="container filter-panel">
      <label className="wide"><span>{t("directory.search")}</span><div><Icon name="search" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("directory.placeholder")} /></div></label>
      <label><span>จังหวัด</span><div><Icon name="pin" /><select value={province} onChange={event => setProvince(event.target.value)}><option value="">ทุกจังหวัด</option>{provinces.map(item => <option key={item}>{item}</option>)}</select></div></label>
      <label><span>จำนวนผู้พัก</span><div><Icon name="users" /><select aria-label="จำนวนผู้พัก" value={guests} onChange={e => setGuests(e.target.value)}><option value="">ไม่จำกัด</option><option value="small">1–8 คน</option><option value="medium">9–14 คน</option><option value="large">15 คนขึ้นไป</option><option value="unknown">ยังไม่ระบุ</option></select></div></label>
      <label><span>สถานะ</span><div><Icon name="shield" /><select value={status} onChange={event => setStatus(event.target.value)}><option value="">ทุกสถานะ</option><option>ตรวจสอบข้อมูลแล้ว</option><option>รอตรวจสอบ</option></select></div></label>
      <button className="primary-button" onClick={() => window.scrollTo({ top: 300, behavior: "smooth" })}><Icon name="search" size={18} />ค้นหา</button>
    </div>
    <section className="container directory-results">
      <div className="results-head"><div><h2>{t("directory.results")}</h2><p>แสดง {filtered.length} รายการ</p>{directoryError&&<p role="alert">{directoryError}</p>}</div><select aria-label="เรียงลำดับ" value={sort} onChange={event => setSort(event.target.value)}><option value="ล่าสุด">อัปเดตล่าสุด</option><option>A–Z</option></select></div>
      {filtered.length ? <div className="villa-grid directory-grid">{filtered.map(v => <div key={v.qr}><VillaCard villa={v} onClick={() => go("detail", v.qr)} /></div>)}</div> : <div className="empty-results"><strong>ไม่พบ Villa ที่ตรงกับการค้นหา</strong><p>ลองเปลี่ยนคำค้นหาหรือจังหวัด</p><button className="outline-button" onClick={() => { setQuery(""); setProvince(""); setStatus(""); setGuests(""); }}>ล้างตัวกรอง</button></div>}
    </section>
  </main>;
}

function TrustRow({ label, children, icon }: { label: string; children: React.ReactNode; icon: IconName }) {
  return <div className="trust-info-row"><span><Icon name={icon} /></span><div><small>{label}</small><strong>{children}</strong></div></div>;
}

function QrPattern() {
  return <div className="qr-pattern" aria-label="คิวอาร์โค้ด">
    {Array.from({ length: 81 }, (_, i) => <i key={i} className={([0,1,2,9,11,15,17,18,19,20,23,25,27,28,31,32,35,37,39,40,41,43,44,47,49,52,54,55,57,59,61,63,64,67,69,71,72,73,75,77,79,80].includes(i)) ? "on" : ""} />)}
  </div>;
}

function VillaGallery() {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStart = useRef(0);
  const show = (index: number) => setActive((index + photos.length) % photos.length);
  const onTouchStart = (event: React.TouchEvent) => { touchStart.current = event.touches[0].clientX; };
  const onTouchEnd = (event: React.TouchEvent) => {
    const distance = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(distance) > 45) show(active + (distance < 0 ? 1 : -1));
  };
  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft") show(active - 1);
      if (event.key === "ArrowRight") show(active + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, lightboxOpen]);

  return <>
    <div className="container gallery gallery-interactive">
      <div className="gallery-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button className="gallery-image-button" aria-label="เปิดภาพขนาดใหญ่" onClick={() => setLightboxOpen(true)}><img src={photos[active]} alt={`Sea Sky Pool Villa ภาพที่ ${active + 1}`} /></button>
        <button className="gallery-nav previous" aria-label="ภาพก่อนหน้า" onClick={() => show(active - 1)}>←</button><button className="gallery-nav next" aria-label="ภาพถัดไป" onClick={() => show(active + 1)}>→</button>
        <span className="gallery-count">{active + 1}/{photos.length}</span>
        <div className="gallery-dots">{photos.map((photo, index) => <button key={photo} aria-label={`ไปภาพที่ ${index + 1}`} className={active === index ? "active" : ""} onClick={() => show(index)} />)}</div>
      </div>
      <div className="gallery-thumbnails">{photos.slice(0, 2).map((photo, index) => <button key={photo} className={active === index ? "active" : ""} onClick={() => show(index)}><img src={photo} alt={`ภาพที่ ${index + 1}`} /></button>)}<button className="gallery-all" onClick={() => setLightboxOpen(true)}><img src={photos[2]} alt="เปิดแกลเลอรีทั้งหมด" /><span>ดูทั้งหมด<br />{photos.length} รูป</span></button></div>
    </div>
    {lightboxOpen && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="แกลเลอรี Sea Sky Pool Villa" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <button className="lightbox-close" aria-label="ปิดแกลเลอรี" onClick={() => setLightboxOpen(false)}><Icon name="close" /></button>
      <button className="lightbox-nav previous" aria-label="ภาพก่อนหน้า" onClick={() => show(active - 1)}>←</button>
      <img src={photos[active]} alt={`Sea Sky Pool Villa ภาพขนาดใหญ่ที่ ${active + 1}`} />
      <button className="lightbox-nav next" aria-label="ภาพถัดไป" onClick={() => show(active + 1)}>→</button>
      <div className="lightbox-footer"><span>{active + 1}/{photos.length}</span><div>{photos.map((photo, index) => <button key={photo} aria-label={`ไปภาพที่ ${index + 1}`} className={active === index ? "active" : ""} onClick={() => show(index)} />)}</div></div>
    </div>}
  </>;
}

function Detail({ go, villa }: { go: (p: Page, item?: string) => void; villa: typeof villas[number] }) {
  if (villa.name !== villas[0].name) return <main className="page-bg"><div className="container page-hero"><button className="outline-button" onClick={() => go("directory")}>← กลับไปค้นหา Villa</button><h1>{villa.name}</h1><p>{villa.province} · {villa.guests}</p><img src={villa.image} alt={villa.name} style={{ width: "100%", maxHeight: 480, objectFit: "cover", borderRadius: 24 }} /><h2>{villa.status}</h2><p>อัปเดต {villa.updated} · ข้อมูลที่พักสาธิต</p><VillaMap name={villa.name} /><button className="outline-button" onClick={() => go("villa-report")}>แจ้งปัญหา</button></div></main>;
  return <main className="detail-page">
    <div className="container breadcrumbs"><button onClick={() => go("home")}>หน้าหลัก</button><span>/</span><button onClick={() => go("directory")}>ค้นหาวิลล่า</button><span>/</span><strong>Sea Sky Pool Villa</strong></div>
    <VillaGallery />
    <div className="container detail-grid">
      <div className="detail-main">
        <div className="title-block"><div><Badge>VillaCheck VERIFIED</Badge><h1>Sea Sky Pool Villa</h1><p><Icon name="pin" size={18} />บางแสน, ชลบุรี · รองรับสูงสุด 12 คน</p></div><span className="trust-score"><strong>98</strong><small>TRUST<br />SCORE</small></span></div>
        <div className="notice"><Icon name="shield" /><div><strong>Verified Property · ตรวจสอบข้อมูลแล้ว</strong><p>VillaCheck ตรวจสอบตัวตน ช่องทางติดต่อ และบัญชีรับเงินของเจ้าของที่พักเมื่อ 18 มิถุนายน 2568</p></div></div>
        <section className="verification-ledger" aria-labelledby="verification-heading"><div className="ledger-heading"><span className="kicker">VERIFICATION RECORD</span><h2 id="verification-heading">ข้อมูลที่ตรวจสอบ</h2><p>รายการสำหรับเปรียบเทียบดีไซน์</p></div><div className="ledger-items">{[["01", "ตัวตนเจ้าของ", "เอกสารและชื่อผู้ดูแล"], ["02", "ช่องทางติดต่อ", "โทรศัพท์และ LINE ทางการ"], ["03", "บัญชีรับเงิน", "ชื่อผู้รับเงินตรงกับข้อมูล"]].map(([number, title, description]) => <div key={number}><span className="ledger-number">{number}</span><div><strong>{title}</strong><small>{description}</small></div><span className="ledger-check"><Icon name="check" size={16} />ตรวจแล้ว</span></div>)}</div></section>
        <section className="detail-section"><h2>เกี่ยวกับที่พัก</h2><p>พูลวิลล่าส่วนตัวบรรยากาศสงบ ใกล้หาดบางแสน เหมาะสำหรับครอบครัวและกลุ่มเพื่อน พร้อมสระว่ายน้ำระบบเกลือ พื้นที่ปิ้งย่าง และห้องนั่งเล่นกว้างขวาง</p></section>
        <section className="detail-section"><h2>สิ่งอำนวยความสะดวก</h2><div className="amenities">{[["pool","สระว่ายน้ำส่วนตัว"],["bed","4 ห้องนอน"],["wifi","Wi-Fi ฟรี"],["kitchen","ห้องครัว"],["car","ที่จอดรถ 4 คัน"],["home","พื้นที่ปิ้งย่าง"]].map(a => <span key={a[1]}><Icon name={a[0] as IconName} />{a[1]}</span>)}</div></section>
        <VillaMap name={villa.name} />
      </div>
      <aside className="trust-card">
        <div className="trust-card-head"><span><Icon name="shield" size={26} /></span><div><small>VILLACHECK VERIFIED</small><h3>ตรวจสอบข้อมูลแล้ว</h3></div></div>
        <div className="status-line"><span /><div><small>ตรวจสอบล่าสุด</small><strong>18 มิถุนายน 2568</strong></div></div>
        <div className="status-line future"><span /><div><small>ตรวจสอบครั้งถัดไป</small><strong>18 กันยายน 2568</strong></div></div>
        <hr />
        <h4>ช่องทางติดต่อทางการ</h4>
        <TrustRow label="โทรศัพท์" icon="phone">08X-XXX-4289</TrustRow>
        <TrustRow label="LINE Official" icon="mail">@seaskypoolvilla</TrustRow>
        <hr />
        <h4>บัญชีรับเงินที่ตรวจสอบข้อมูลแล้ว</h4>
        <div className="bank-box"><span className="bank-mark">K</span><div><small>ธนาคารกสิกรไทย</small><strong>XXX-X-X4289-X</strong><p>ชื่อบัญชี บจก. ซีสกาย วิลล่า</p></div><Icon name="check" /></div>
        <div className="secure-note"><Icon name="info" size={17} />ตรวจสอบชื่อบัญชีให้ตรงกันทุกครั้งก่อนโอน</div>
        <div className="qr-side"><QrPattern /><div><strong>สแกนเพื่อตรวจสอบ</strong><span>VC-TH-2025-01842</span></div></div>
        <button className="primary-button full" onClick={() => go("scan")}><Icon name="qr" size={18} />เปิดหน้าตรวจสอบ QR</button>
        <button className="outline-button full report-button" onClick={() => go("villa-report")}><Icon name="info" size={18} />Report Villa</button>
      </aside>
    </div>
  </main>;
}

function ScanQr({ go, onVerified,preview=false }: { go: (p: Page, item?: string) => void; onVerified: (reference: string) => void;preview?:boolean }) {
  const t=useCopy();
  const [scanState, setScanState] = useState<"idle" | "requesting" | "scanning" | "loading" | "success" | "permission-error" | "not-found" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [scannedReference, setScannedReference] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const cameraRequest = useRef(0);
  const cameraActive = scanState === "requesting" || scanState === "scanning";
  const busy = scanState === "requesting" || scanState === "loading" || scanState === "success";

  const stopCamera = () => {
    cameraRequest.current += 1;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach(track => track.stop());
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const getQrReader = async () => {
    if (!readerRef.current) {
      const { BrowserQRCodeReader: QrReader } = await import("@zxing/browser");
      readerRef.current = new QrReader();
    }
    return readerRef.current;
  };

  const completeScan = (reference: string, controls?: IScannerControls) => {
    controls?.stop();
    stopCamera();
    const code=parseQrReference(reference);
    if(!code) { setErrorMessage("QR ไม่ถูกต้อง กรุณาใช้ QR ของ VillaCheck หรืออัปโหลดรูป QR ใหม่");setScanState("error");return; }
    setScannedReference(code);
    setErrorMessage("");
    setScanState("success");
  };

  const startCamera = async () => {
    stopCamera();
    const request = cameraRequest.current;
    setErrorMessage("");
    setScanState("requesting");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Browser นี้ไม่รองรับการเปิดกล้อง กรุณาอัปโหลดรูป QR แทน");
      setScanState("error");
      return;
    }
    try {
      const reader = await getQrReader();
      if (request !== cameraRequest.current) return;
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: "environment" } } },
        videoRef.current ?? undefined,
        (result, _error, activeControls) => {
          if (request !== cameraRequest.current) { activeControls.stop(); return; }
          if (result) completeScan(result.getText(), activeControls);
        },
      );
      if (request !== cameraRequest.current) { controls.stop(); return; }
      controlsRef.current = controls;
      setScanState("scanning");
      timeoutRef.current = window.setTimeout(() => {
        stopCamera();
        setErrorMessage("ไม่พบ QR Code กรุณาลองใหม่");
        setScanState("not-found");
      }, 15000);
    } catch (error) {
      if (request !== cameraRequest.current) return;
      const cameraError = error as DOMException;
      const permissionDenied = cameraError.name === "NotAllowedError" || cameraError.name === "PermissionDeniedError";
      setErrorMessage(permissionDenied ? "ไม่ได้รับอนุญาตให้ใช้กล้อง คุณสามารถอัปโหลดรูป QR แทน หรือเปลี่ยนสิทธิ์กล้องในการตั้งค่าเบราว์เซอร์" : cameraError.name === "NotFoundError" ? "ไม่พบกล้องบนอุปกรณ์นี้ กรุณาอัปโหลดรูป QR" : "เปิดกล้องไม่สำเร็จ กรุณาอัปโหลดรูป QR หรือตรวจสอบว่ากล้องไม่ได้ถูกใช้งานโดยแอปอื่น");
      setScanState(permissionDenied ? "permission-error" : "error");
    }
  };

  const uploadQr = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    stopCamera();
    setErrorMessage("");
    setScanState("loading");
    const imageUrl = URL.createObjectURL(file);
    try {
      const reader = await getQrReader();
      const result = await reader.decodeFromImageUrl(imageUrl);
      completeScan(result.getText());
    } catch {
      setErrorMessage("ไม่พบ QR Code กรุณาลองใหม่");
      setScanState("not-found");
    } finally {
      URL.revokeObjectURL(imageUrl);
      event.target.value = "";
    }
  };

  useEffect(() => {
    if (scanState === "success") {
      const resultTimer = window.setTimeout(() => onVerified(scannedReference), 700);
      return () => window.clearTimeout(resultTimer);
    }
  }, [onVerified, scanState, scannedReference]);

  useEffect(() => { if(!preview)void startCamera(); return () => stopCamera(); }, []);

  return <main className="scan-page">
    <div className="verify-top"><div className="container"><HomeLogoLink className="logo-button" onNavigate={()=>{stopCamera();go("home")}}><Logo light /></HomeLogoLink><button onClick={() => { stopCamera(); go("home"); }}><Icon name="close" />{t("scan.close")}</button></div></div>
    <div className="scan-bg">
      <div className="scan-intro">
        <span className="kicker light-kicker">{t("scan.kicker")}</span>
        <h1>{t("scan.title")}</h1>
        <p>{t("scan.description")}</p>
      </div>
      <div className="scanner-card">
        <div className={`camera-scanner ${cameraActive ? "camera-active" : ""} ${busy ? "is-scanning" : ""} ${scanState === "success" ? "scan-success" : ""} ${errorMessage ? "scan-error" : ""}`}>
          <video ref={videoRef} className={cameraActive ? "camera-preview active" : "camera-preview"} muted playsInline />
          <div className="scanner-overlay">
            <div className="qr-frame"><span /><span /><span /><span />{!cameraActive && <Icon name={scanState === "loading" ? "search" : scanState === "success" ? "check" : "qr"} size={54} />}</div>
            <strong>{scanState === "requesting" ? "กำลังขอสิทธิ์เข้าถึงกล้อง..." : scanState === "scanning" ? "กำลังสแกน QR Code" : scanState === "loading" ? "กำลังตรวจสอบ QR Code..." : scanState === "success" ? "Scan Success" : errorMessage ? "ไม่สามารถอ่าน QR Code" : "Camera Scanner"}</strong>
            <p>{scanState === "success" ? "อ่าน QR แล้ว กำลังตรวจสอบสถานะที่พัก" : errorMessage || "วาง QR Code ให้อยู่ในกรอบ"}</p>
            {(scanState === "scanning" || scanState === "loading") && <span className="scan-line" />}
          </div>
        </div>
        {errorMessage && <div className="scanner-error"><Icon name="info" size={18} /><span>{errorMessage}</span><button onClick={startCamera}>ลองอีกครั้ง</button></div>}
        <div className="scanner-actions">
          <button type="button" className="gallery-picker" disabled={preview || scanState === "loading" || scanState === "success"} onClick={() => { const input=galleryRef.current;if(input){input.value="";if(typeof input.showPicker==="function"){try{input.showPicker();}catch{input.click();}}else input.click();} }}>
            <span className="gallery-picker-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m3 17 5-5 4 4 3-3 6 6" /></svg></span>
            <span className="gallery-picker-copy"><strong>{t("scan.galleryTitle")}</strong><span>{t("scan.galleryDescription")}</span></span>
            <Icon name="upload" size={20} />
          </button>
          <input ref={galleryRef} type="file" accept="image/*" aria-label="เลือกรูป QR จากแกลเลอรี" hidden onChange={uploadQr} />
        </div>
      </div>
      <p className="scan-security"><Icon name="shield" size={15} />{t("scan.security")}</p>
    </div>
  </main>;
}

function Verify({ go, reference }: { go: (p: Page, item?: string) => void; reference: string }) {
  const [status, setStatus] = useState<"verified" | "pending" | "expired">("verified");
  const meta = status === "verified"
    ? { label: "VillaCheck VERIFIED", title: "Verified Property", date: "18 กันยายน 2568" }
    : status === "pending"
      ? { label: "PENDING", title: "อยู่ระหว่างการตรวจสอบ", date: "—" }
      : { label: "EXPIRED", title: "สถานะหมดอายุ", date: "18 มิถุนายน 2568" };
  return <main className="verify-page">
    <div className="verify-top"><div className="container"><Logo light /><button onClick={() => go("home")}><Icon name="close" />ปิดหน้าตรวจสอบ</button></div></div>
    <div className="verify-bg">
      <div className="verify-intro"><span className="kicker light-kicker">QR VERIFICATION</span><h1>ผลการตรวจสอบที่พัก</h1><p>ข้อมูลจากระบบ VillaCheck ณ วันที่ 20 มิถุนายน 2568 เวลา 14:42 น.</p></div>
      <div className={`verification-card ${status}`}>
        <div className="verify-status">
          <span className="status-shield"><Icon name={status === "verified" ? "shield" : "clock"} size={40} /></span>
          <div className="verify-label">{meta.label}</div><h2>{meta.title}</h2>
          <p>{status === "verified" ? "ตรวจสอบข้อมูลที่พักและเจ้าของแล้วโดย VillaCheck" : "โปรดติดต่อที่พักและตรวจสอบข้อมูลเพิ่มเติมก่อนโอน"}</p>
        </div>
        <div className="verify-body">
          <div className="verified-villa"><img src={photos[0]} alt="Sea Sky Pool Villa" /><div><small>ชื่อที่พัก</small><h3>Sea Sky Pool Villa</h3><p><Icon name="pin" size={16} />บางแสน, ชลบุรี</p></div></div>
          <div className="verify-details">
            <TrustRow label="QR Reference" icon="qr">{reference}</TrustRow>
            <TrustRow label="Verification Status" icon="shield">ตรวจสอบข้อมูลแล้ว</TrustRow>
            <TrustRow label="Official Contact" icon="phone">08X-XXX-4289 · @seaskypoolvilla</TrustRow>
            <TrustRow label="บัญชีรับเงินแบบ Masked" icon="users">กสิกรไทย · XXX-X-X4289-X</TrustRow>
          </div>
          <div className="date-grid"><div><span>Last Checked</span><strong>18 มิถุนายน 2568</strong></div><div><span>Expire Date</span><strong>{meta.date}</strong></div></div>
          <div className="warning-note"><Icon name="info" /><p><strong>ก่อนโอนเงินทุกครั้ง</strong> ตรวจสอบชื่อบัญชีให้ตรงกับข้อมูลด้านบน VillaCheck ไม่มีบริการรับจองหรือรับชำระเงิน</p></div>
          <button className="outline-button full" onClick={() => go("detail")}>ดู Trust Profile <Icon name="arrow" size={18} /></button>
          <button className="text-button report-result-link" onClick={() => go("villa-report")}><Icon name="info" size={16} />พบข้อมูลผิดปกติ? แจ้งปัญหา</button>
        </div>
      </div>
      <div className="prototype-switch"><span>Prototype:</span>{(["verified","pending","expired"] as const).map(s => <button key={s} onClick={() => setStatus(s)} className={status === s ? "active" : ""}>{s}</button>)}</div>
    </div>
  </main>;
}

function Footer({go,account}:{go:(p:Page,item?:string)=>void;account:Account|null}){
 const {site}=useCms(),presentation=usePresentation(),t=useCopy();
 if(!presentation.footerVisible)return null;
 return <footer className="public-footer"><div className="container footer-grid"><div className="footer-brand"><HomeLogoLink className="footer-logo" onNavigate={()=>go("home")}><Logo light/></HomeLogoLink><p>{site.description}</p><div className="footer-social">{site.facebook&&<a aria-label="Facebook" href={site.facebook} target="_blank" rel="noopener noreferrer"><Icon name="facebook" size={16}/></a>}{site.instagram&&<a aria-label="Instagram" href={site.instagram} target="_blank" rel="noopener noreferrer"><Icon name="instagram" size={16}/></a>}{site.line&&<a aria-label="LINE" href={site.line} target="_blank" rel="noopener noreferrer"><Icon name="message" size={16}/></a>}</div></div>
 {presentation.footerColumns.filter(c=>c.visible).map(column=><div key={column.id}><strong>{column.title}</strong>{column.links.filter(link=>link.visible).map(link=><a key={link.id} href={link.href==="#page=login"&&account?`#page=${accountHome(account)}`:link.href} {...(link.href.startsWith("https:")?{target:"_blank",rel:"noopener noreferrer"}:{})}>{link.href==="#page=login"&&account&&link.label==="เข้าสู่ระบบ"?accountLabel(account):link.label}</a>)}</div>)}
 <div className="footer-support"><strong>{t("footer.support")}</strong><button onClick={()=>go("help")}>{t("footer.help")}</button><button onClick={()=>go("contact")}>{t("footer.contact")}</button>{site.email&&<a href={`mailto:${site.email}`}><Icon name="mail" size={14}/>{t("footer.email")}</a>}{site.phone&&<a href={`tel:${site.phone.replace(/[^+0-9]/g,"")}`}><Icon name="phone" size={14}/>{t("footer.phone")}</a>}<small>{site.hours}</small></div></div>
 <div className="container footer-bottom"><span>© {new Date().getFullYear()} {site.name}. {t("footer.copyright")}</span><div><button onClick={()=>go("privacy")}>{t("footer.privacy")}</button><button onClick={()=>go("terms")}>{t("footer.terms")}</button></div><span>{t("footer.tagline")}</span></div></footer>;
}

function AppContent() {
  const {site}=useCms();
  const [page, navigate, selectedItem] = usePageNavigation<Page>();
  const [selectedPackage, setSelectedPackage] = useState(() => sessionStorage.getItem(selectedPlanKey) || "Basic Verify");
  const [directorySearch, setDirectorySearch] = useState({ query: "", province: "" });
  const [qrReference, setQrReference] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [accountLoaded,setAccountLoaded]=useState(false);
  useEffect(() => {
    let active = true;
    let request = 0;
    const refresh = () => {
      const version = ++request;
      void currentAccount().then(value => { if (active && version === request) setAccount(value); }).catch(error => {
        if (active && version === request && error instanceof ApiError && error.status === 401) setAccount(null);
      }).finally(()=>{if(active && version===request)setAccountLoaded(true);});
    };
    refresh();
    window.addEventListener("app-navigation", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("auth-session-changed", refresh);
    return () => { active = false; window.removeEventListener("app-navigation", refresh); window.removeEventListener("focus", refresh); window.removeEventListener("auth-session-changed", refresh); };
  }, []);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [reportReference, setReportReference] = useState("");


  const go = (next: Page, item?: string) => { navigate(next, item); };
  useEffect(() => {
    if (page === "pricing" && accountLoaded) {
      if (account?.role === "merchant") navigate("owner-package");
      else { sessionStorage.setItem("villacheck-merchant-return", "owner-package"); navigate("owner-auth"); }
    }
  }, [page, account?.role, accountLoaded, navigate]);
  const search = (query: string, province: string) => {
    setDirectorySearch({ query, province });
    go("directory");
  };
  const selectPackage = async (name: string) => {
    setSelectedPackage(name);
    sessionStorage.setItem(selectedPlanKey, name);
    sessionStorage.setItem(packageIntentKey, "true");
    try { const account = await currentAccount(); go(account.role === "merchant" ? "owner-add-villa" : "owner-auth"); }
    catch { go("owner-auth"); }
  };
  const showVerificationResult = (reference: string) => {
    let code = reference.trim();
    try { const url = new URL(code); code = new URLSearchParams(url.hash.slice(1)).get("item") || code; } catch { /* Raw QR reference. */ }
    sessionStorage.setItem("villacheck-scan-reference",code);
    setQrReference(code);
    go("verify", code);
  };
  const submitReport = async (report: Omit<UserReport, "reference" | "guest">) => {
    const result=await api<{reference:string;linkedToUser:boolean}>("/public/reports",report);
    setReportReference(result.reference);setUserLoggedIn(result.linkedToUser);go("villa-report-success",result.reference);
  };
  const isPublicInfoPage = ["cms-page", "about", "verification-standard", "articles", "article-detail", "owner-guide", "help", "contact", "privacy", "terms", "social-facebook", "social-instagram", "social-line", "gallery"].includes(page);
  const isOwnerPage = page.startsWith("owner-") && !isPublicInfoPage && !["owner-auth", "owner-registration", "owner-information", "owner-onboarding-villa", "owner-select-villa"].includes(page);
  const isAdminPage = page.startsWith("admin-");
  const isUserPage = page.startsWith("user-");
  const content =
    page === "admin-verify" ? <PortalShell role="Admin" page={page} go={go}><MerchantVerification reference={selectedItem} go={go} adminView/></PortalShell> :
    page === "admin-login" ? <AdminLogin go={go}/> :
    page === "home" ? <Home go={go} onSearch={search} onSelect={selectPackage} /> :
    page === "directory" ? <Directory go={go} initialQuery={directorySearch.query} initialProvince={directorySearch.province} /> :
    page === "detail" ? <MerchantVerification go={go} reference={selectedItem || qrReference} /> :
    page === "scan" ? <ScanQr go={go} onVerified={showVerificationResult} /> :
    page === "verify" ? <MerchantVerification go={go} reference={selectedItem || qrReference} /> :
    page === "pricing" ? <main className="container"><p role="status">กำลังเข้าสู่ Member Room…</p></main> :
    isPublicInfoPage ? <PublicInfoPage page={page} go={go} selectedArticle={selectedItem} /> :
    page === "villa-report" ? <PublicReportPage onSubmit={submitReport} reference={selectedItem} /> :
    page === "villa-report-success" ? <PublicReportSuccess go={go} reference={selectedItem||reportReference} linkedToUser={userLoggedIn} /> :
    page === "user-registration" ? <UserRegistration go={go} reference={selectedItem} /> :
    page === "admin-receiving-bank" ? <AdminReceivingBank go={go}/> :
    ["admin-approved-villas","admin-subscriptions"].includes(page) ? <AdminApprovedVillas go={go}/> :
    ["admin-pending-villas","admin-owner-verification"].includes(page) ? <AdminPendingVillas go={go}/> :
    page === "admin-cms" ? <AdminCms go={go} renderPreview={(target,reference)=><><Header page={target} go={()=>{}} account={null} preview/>{target==="directory"?<Directory go={()=>{}}/>:target==="scan"?<ScanQr go={()=>{}} onVerified={()=>{}} preview/>:target==="login"?<LoginPage go={()=>{}}/>:target==="owner-auth"?<LoginPage go={()=>{}} accountType="merchant"/>:target==="user-registration"?<UserRegistration go={()=>{}} reference=""/>:target==="owner-registration"?<OwnerRegistration go={()=>{}} packageName=""/>:target==="verify"?(reference?<MerchantVerification go={()=>{}} reference={reference} preview/>:<p>กรอก QR ของที่พัก แล้วกดแสดงที่พัก</p>):target==="villa-report"?<PublicReportPage onSubmit={async()=>{}}/>:<PublicInfoPage page={target} go={()=>{}}/>}<Footer go={()=>{}} account={null}/></>} renderHome={<><Header page="home" go={()=>{}} account={null} preview/><Home go={()=>{}} onSearch={()=>{}} onSelect={()=>{}}/><FooterAd/><Footer go={()=>{}} account={null}/></>}/> :
    ["admin-packages","admin-leads","admin-settings","admin-advertising","admin-reviews"].includes(page) ? <AdminBusiness page={page} go={go} /> :
    ["admin-users","admin-owners"].includes(page) ? <AdminAccounts role={page === "admin-users" ? "user" : "merchant"} go={go}/> :
    ["admin-owners","admin-checks","admin-reports","admin-qr","owner-analytics","owner-reports"].includes(page) || page.startsWith("user-") ? <OperationsPortal page={page} go={go} item={selectedItem} /> :
    page === "login" ? <LoginPage reference={selectedItem} go={go} onAuthenticated={role => setUserLoggedIn(role === "User")} /> :
    page === "owner-auth" ? <OwnerPackageAuth go={go} packageName={selectedPackage} onOwnerLogin={() => {}} /> :
    page === "owner-information" || page === "owner-profile" ? <MerchantProfile page={page} go={go} /> :
    page === "owner-registration" ? <OwnerRegistration go={go} packageName={selectedPackage} /> :
    page === "owner-onboarding-villa" ? <Backoffice page={page} go={go} initialPackage={selectedPackage} initialItem={selectedItem} /> :
    page === "owner-select-villa" ? <Backoffice page="owner-villas" go={go} /> :
    page === "package-confirmation" ? <Backoffice page="owner-package" go={go} /> :
    page === "package-request-pending" ? <Backoffice page="owner-package" go={go} /> :
    isOwnerPage ? <Backoffice page={page} go={go} initialPackage={selectedPackage} initialItem={selectedItem} /> :
    isAdminPage ? <Backoffice page={page} go={go} initialPackage={selectedPackage} initialItem={selectedItem} /> :
    <UserPages page={page} go={go} reports={[]} selectedReference={selectedItem} />;
  const showPublicHeader = !isAdminPage && !isOwnerPage && (!isUserPage || page === "user-registration");
  const showPublicFooter = ["home", "directory", "detail", "pricing", "scan", "verify", "villa-report", "villa-report-success"].includes(page) || isPublicInfoPage;
  return <div className={`app${showPublicHeader?" app-public-header":""}`} style={{"--cms-accent":site.accent} as React.CSSProperties}>{showPublicHeader && <Header page={page} go={go} account={account} />}{!isAdminPage&&!isOwnerPage&&!isUserPage&&<DemoNotice/>}{isAdminPage&&page!=="admin-login"?<AdminAccess go={go}>{content}</AdminAccess>:content}{page==="home"&&<FooterAd/>}{showPublicFooter && <Footer go={go} account={account} />}</div>;
}

export default function App() { return <CmsProvider><AppContent/></CmsProvider>; }
