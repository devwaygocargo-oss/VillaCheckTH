import {t as translateSystem} from "./locale"
import './dashboard-documents.css'
import {t as translate,useLocale} from './locale';
import LanguageSwitcher from './LanguageSwitcher';
import {thaiUi} from "./thaiUi"
import PasswordRecovery from "./PasswordRecovery"
import {BusinessReadinessNotice} from './BusinessReadiness';
import PasswordRegistration from "./PasswordRegistration"
import HomeLogoLink from "./HomeLogoLink";
import AdminApprovalNotice from "./AdminApprovalNotice";
import { CmsPublicPage,useCopy } from "./cms";
import OtpLogin from "./OtpLogin";
import {oauthErrors} from "./authMessages";
import type {Account} from "./merchantStore";
import ContactLead from "./ContactLead";
import PublicMedia from "./PublicMedia";
import { usePackages, packageIntentKey } from "./packagePlans";
import { SocialLogin } from "./UserAccounts";
import { api, authenticate, currentAccount, logout, ApiError } from "./api";
import { openSupport } from "./support";
import { createContext, useContext, useEffect, useState } from "react";

export type Page =
  | "admin-villa-page" | "admin-receiving-bank" | "admin-approved-villas" | "admin-verify" | "admin-pending-villas" | "admin-login" | "admin-cms" | "cms-page" | "user-registration" | "admin-users"
  | "home" | "directory" | "detail" | "scan" | "verify" | "pricing" | "login"
  | "about" | "verification-standard" | "articles" | "article-detail" | "owner-guide"
  | "help" | "contact" | "privacy" | "terms" | "social-facebook" | "social-instagram"
  | "social-line" | "gallery"
  | "owner-auth" | "owner-registration" | "owner-information" | "owner-onboarding-villa"
  | "package-confirmation" | "owner-select-villa" | "package-request-pending"
  | "owner-profile" | "owner-dashboard" | "owner-villas"
  | "owner-villa-detail" | "owner-villa-edit" | "owner-add-villa" | "owner-preview"
  | "owner-pending" | "owner-analytics" | "owner-reports" | "owner-package"
  | "user-profile" | "user-dashboard" | "user-checks" | "user-check-detail" | "user-reports"
  | "user-report-detail" | "user-precheck" | "user-check-success" | "villa-report" | "villa-report-success"
  | "admin-dashboard" | "admin-owners" | "admin-villas"
  | "admin-advertising" | "admin-reviews" | "admin-owner-verification" | "admin-leads" | "admin-settings" | "admin-payments" | "admin-subscriptions" | "admin-checks" | "admin-reports" | "admin-qr" | "admin-packages";

type Go = (page: Page, item?: string) => void;
type Status = "Pending" | "Verified" | "Rejected" | "Suspended" | "Expired";
export type UserReport = { reference: string; villa: string; type: string; guest: boolean; qr?:string; detail?:string; reporter?:string; contact?:string };

export function PublicInfoPage({ page, go, selectedArticle }: { page: Page; go: Go; selectedArticle?: string }) {
  if (page === "gallery" || page.startsWith("social-")) return <PublicMedia page={page} go={go} />;
  return <CmsPublicPage page={page} item={selectedArticle} go={go}/>;
}

export function PublicReportPage({ onSubmit, reference="" }: { reference?:string; onSubmit: (report: Omit<UserReport, "reference" | "guest">) => Promise<void> }) {
  useEffect(()=>{void currentAccount().catch(()=>{});if(reference)void api<{name:string}>(`/public/qr/${encodeURIComponent(reference)}`).then(v=>setVilla(v.name)).catch(()=>{});},[reference]);
  const t=useCopy();
  const [villa, setVilla] = useState("");
  const [type, setType] = useState("ชื่อบัญชีไม่ตรง");
  const [detail, setDetail] = useState("");
  const [reporter, setReporter] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const [busy,setBusy]=useState(false);
  const submit = async () => {
    if(busy)return;
    if (!villa.trim() || !detail.trim()) {
      setError(translateSystem("กรุณากรอกชื่อ Villa และรายละเอียดปัญหา"));
      return;
    }
    setBusy(true);setError("");
    try {await onSubmit({ villa: villa.trim(), type, qr:reference||undefined, detail:detail.trim(),reporter:reporter.trim(),contact:contact.trim() });}
    catch(error){setError(error instanceof Error?error.message:translateSystem("ส่ง Report ไม่สำเร็จ"));}
    finally{setBusy(false);}
  };
  return <main className="page-bg public-report-page">
    <div className="page-hero container"><span className="kicker">{t("report.kicker")}</span><h1>{t("report.title")}</h1><p>{t("report.description")}</p></div>
    <div className="container report-form-card">
      <div className="report-guest-note"><span>{translateSystem("รายงานในสภาพแวดล้อมทดสอบ")}</span><strong>{translateSystem("ใช้บัญชี User ทดสอบที่ได้รับสิทธิ์")}</strong><p>{translateSystem("ข้อมูลผู้แจ้งและช่องทางติดต่อกลับไม่จำเป็นต้องระบุ")}</p></div>
      <div className="portal-form">
        <label><span>{t("report.villa")}</span><input value={villa} onChange={event => setVilla(event.target.value)} placeholder={translateSystem("ชื่อที่พักที่ต้องการแจ้งปัญหา")} /></label>
        <label><span>{t("report.type")}</span><select value={type} onChange={event => setType(event.target.value)}><option>{translateSystem("ชื่อบัญชีไม่ตรง")}</option><option>{translateSystem("สงสัยเพจปลอม")}</option><option>{translateSystem("ช่องทางติดต่อไม่ตรง")}</option><option>{translateSystem("QR ผิดปกติ")}</option><option>{translateSystem("อื่น ๆ")}</option></select></label>
        <label><span>{t("report.detail")}</span><textarea value={detail} onChange={event => setDetail(event.target.value)} placeholder={translateSystem("อธิบายข้อมูลหรือเหตุการณ์ที่พบ")} /></label>
        <div className="optional-fields"><label><span>{translateSystem("ชื่อผู้แจ้ง (ไม่จำเป็นต้องระบุ)")}</span><input value={reporter} onChange={event => setReporter(event.target.value)} placeholder={translateSystem("ไม่จำเป็นต้องระบุ")} /></label><label><span>{translateSystem("เบอร์โทรหรืออีเมลติดต่อกลับ (ไม่จำเป็นต้องระบุ)")}</span><input value={contact} onChange={event => setContact(event.target.value)} placeholder={translateSystem("ไม่จำเป็นต้องระบุ")} /></label></div>
        {error && <div className="form-message error-state">{error}</div>}
        <button className="primary-button" disabled={busy} onClick={()=>void submit()}>{busy?translateSystem("กำลังบันทึก…"):t("report.submit")}</button>
      </div>
    </div>
  </main>;
}

export function PublicReportSuccess({ go, reference, linkedToUser }: { go: Go; reference: string; linkedToUser: boolean }) {
  const t=useCopy();
  const [status,setStatus]=useState(""),[note,setNote]=useState(""),[linked,setLinked]=useState(linkedToUser),[error,setError]=useState("");
  useEffect(()=>{let active=true;const refresh=()=>{if(!reference){setError(translateSystem("ไม่พบเลขอ้างอิงรายงาน"));return;}void api<{status:string;publicNote:string;linkedToUser:boolean}>(`/public/reports/${encodeURIComponent(reference)}`).then(r=>{if(active){setStatus(r.status);setNote(r.publicNote);setLinked(r.linkedToUser);}}).catch(e=>{if(active)setError(e.message)});};refresh();const timer=window.setInterval(refresh,10000);return()=>{active=false;clearInterval(timer)};},[reference]);

  return <main className="page-bg public-report-page"><div className="page-hero container"><span className="kicker">{t("report.receivedKicker")}</span><h1>{status?t("report.receivedTitle"):translateSystem("กำลังตรวจสอบเลขอ้างอิง")}</h1><p>{t("report.receivedDescription")}</p></div><div className="container report-success-card"><StatusBadge status={status==="RESOLVED"?"Verified":status==="REJECTED"?"Rejected":"Pending"} /><span>{translateSystem("หมายเลขอ้างอิง")}</span><strong>{reference}</strong>{error?<p role="alert">{translateSystem(error)}</p>:<><p>{translateSystem("สถานะ:")}{" "}{status||translateSystem("กำลังโหลด…")}</p>{note&&<p>{translateSystem("คำตอบจากทีมงาน:")}{" "}{note}</p>}<a href={`#${new URLSearchParams({page:"villa-report-success",item:reference})}`}>{translateSystem("ลิงก์ติดตามรายงาน")}</a></>}<p>{translateSystem("กรุณาเก็บหมายเลขนี้ไว้สำหรับติดตามสถานะ")}{linked ? translateSystem(" · Report นี้ถูกเพิ่มในหน้า Report ของฉันแล้ว") : translateSystem(" · ส่งในรูปแบบ รายงานโดยไม่เข้าสู่ระบบ")}</p><div className="button-row">{linked && <button className="primary-button" onClick={() => go("user-reports")}>{translateSystem("ไปที่ Report ของฉัน")}</button>}<button className="outline-button" onClick={() => go("home")}>{translateSystem("กลับหน้าหลัก")}</button></div></div></main>;
}

const testAccounts = [
  { role: "User", email: "user@villacheck.test" },
  { role: "Merchant", email: "owner@villacheck.test" },
  { role: "Admin", email: "admin@villacheck.test" },
];

export function LoginPage({ go, onAuthenticated, reference = "", accountType="user",packageName="" }: { go: Go; reference?: string; onAuthenticated?: (role: "User" | "Merchant" | "Admin") => void;accountType?:"user"|"merchant";packageName?:string }) {
  const t=useCopy();
  useLocale();
  const [method,setMethod]=useState<"email"|"sms"|"password">("password");
  const passwordMode=method==="password";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const oauthError = new URLSearchParams(window.location.hash.slice(1)).get("oauth_error");
  const [error, setError] = useState(oauthError ? translateSystem(oauthErrors[oauthError]||"OAuth ไม่สำเร็จ") || "OAuth ไม่สำเร็จ" : "");

  const [localAccounts, setLocalAccounts] = useState(false);
  const [loginReady,setLoginReady]=useState(false);
  const [userHomeAvailable,setUserHomeAvailable]=useState(false);
  useEffect(() => {let active=true;void api<{localAccounts:boolean}>("/config").then(v=>{if(active)setLocalAccounts(v.localAccounts)}).catch(()=>{if(active)setError(translate(translateSystem("ตรวจช่องทางเข้าสู่ระบบไม่สำเร็จ ใช้อีเมลและรหัสผ่าน หรือลองโหลดหน้าใหม่")))}).finally(()=>{if(active)setLoginReady(true)});return()=>{active=false}}, []);
  const authenticated=async(account:Account)=>{
    if(account.role==="admin"){await logout();setError(translate(translateSystem("กรุณาเข้าสู่ระบบผ่านหน้าสำหรับผู้ดูแลระบบ")));return;}
    if(accountType==="merchant"&&account.role!=="merchant"){setUserHomeAvailable(account.role==="user");setError(translate(translateSystem("บัญชีนี้เป็นผู้ใช้ทั่วไป กรุณาไปยังบัญชีผู้ใช้ ไม่สามารถเข้าพื้นที่ผู้ประกอบการได้")));return;}
    const role=account.role==="merchant"?"Merchant":"User";
    onAuthenticated?.(role);
    if(role==="Merchant"){
      const destination = sessionStorage.getItem("villacheck-merchant-return");
      if(destination === "owner-package") { sessionStorage.removeItem("villacheck-merchant-return"); go("owner-package"); return; }
      if(accountType!=="merchant"){go(sessionStorage.getItem(packageIntentKey)?"owner-information":"owner-dashboard");return;}
      const profile=await api<{businessName:string;phone:string;address:string;email:string}>("/merchant/profile");
      go(sessionStorage.getItem(packageIntentKey)||!profile.businessName||!profile.phone||!profile.address||profile.email.endsWith("@phone.villacheck.invalid")?"owner-information":"owner-dashboard");
    }else go(reference?"verify":"user-dashboard",reference||undefined);
  };
  const login = async () => {
    if (loading) return;
    setError(""); setLoading(true);
    try {
      const account = await authenticate(email, password);
      await authenticated(account);
    } catch (error) { setError(error instanceof Error ? error.message : translate(translateSystem("เข้าสู่ระบบไม่สำเร็จ"))); }
    finally { setLoading(false); }
  };

  return <main className="login-screen">
    <div className="login-sheet">
      <div className="login-topbar"><LanguageSwitcher/><button aria-label={translate(translateSystem("กลับหน้าหลัก"))} onClick={()=>go("home")}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 5-7 7 7 7"/></svg></button><button aria-label={translate(translateSystem("ช่วยเหลือการเข้าสู่ระบบ"))} onClick={()=>go("help")}><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4"/><path d="M12 16h.01"/></svg></button></div>
      <HomeLogoLink className="login-brand" onNavigate={()=>go("home")}><span className="login-brand-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m8 12 3 3 5-6"/></svg></span><strong>Villa<span>Check</span></strong></HomeLogoLink>
      <h1 className="login-title">{accountType==="merchant"?t("auth.merchantTitle"):t("auth.userTitle")}</h1>
      {accountType==="merchant"&&<p className="login-account-note">{packageName?translate(translateSystem("แพ็กเกจที่สนใจ: {name}"),{name:packageName})+" · ":""}{translate(translateSystem("เลือกช่องทางเข้าสู่ระบบหรือสร้างบัญชี Merchant"))}</p>}
      {userHomeAvailable&&<button type="button" className="primary-button login-user-home" onClick={()=>go(reference?"verify":"user-dashboard",reference||undefined)}>{translate(translateSystem("ไปยังบัญชีผู้ใช้"))}</button>}
      <div className="login-method-tabs" role="group" aria-label={translate('otp.method')}>{(["email","sms","password"] as const).map(next=><button type="button" key={next} aria-pressed={method===next} onClick={()=>{setMethod(next);setError("")}}>{translate(next==="email"?translateSystem("อีเมล OTP"):next==="sms"?translateSystem("เบอร์โทรศัพท์ OTP"):translateSystem("เข้าสู่ระบบด้วยรหัสผ่าน"))}</button>)}</div>
      {!passwordMode&&error&&<p className="login-error" role="alert">{translateSystem(error)}</p>}
      {!loginReady?<p role="status">{translate(translateSystem("กำลังตรวจช่องทางเข้าสู่ระบบ…"))}</p>:!passwordMode?<OtpLogin key={method} initialChannel={method==='email'?'email':'sms'} showChannelTabs={false} accountType={accountType} onAuthenticated={account=>{void authenticated(account).catch(e=>setError(e.message));}}/>:<>
      <form className="login-email-form" onSubmit={event=>{event.preventDefault();void login();}}>
        <label className="login-field"><span>{t("auth.email")}</span><input aria-label={t("auth.email")} required type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} placeholder={translate(translateSystem("อีเมลของคุณ"))}/></label>
        <label className="login-field"><span>{t("auth.password")}</span><input aria-label={t("auth.password")} required autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} type="password" placeholder={translate(translateSystem("รหัสผ่าน"))}/></label>
        {error&&<p className="login-error" role="alert">{translateSystem(error)}</p>}
        <button className="login-submit" disabled={loading}>{loading?translate(translateSystem("กำลังเข้าสู่ระบบ…")):t("auth.submit")}</button>
      </form>
</>}
      <div className="login-divider"><span>{translate(translateSystem("หรือ"))}</span></div>
      <SocialLogin reference={reference} variant="stacked" accountType={accountType}/>

      <PasswordRecovery/><div className="login-bottom">{accountType==="merchant"?<><button className="login-create" onClick={()=>go("owner-registration")}>{translate(translateSystem("สมัคร Merchant ใหม่"))}</button><button className="login-merchant" onClick={()=>go("login")}>{t("auth.userLogin")}</button></>:<><button className="login-create" onClick={()=>go("user-registration",reference)}>{t("auth.createUser")}</button><button className="login-merchant" onClick={()=>go("owner-auth")}>{t("auth.merchantLogin")}</button><button className="login-merchant" onClick={()=>go("owner-registration")}>{t("auth.createMerchant")}</button></>}<p>{translate(translateSystem("เมื่อดำเนินการต่อ แสดงว่าคุณยอมรับ"))}<button onClick={()=>go("terms")}>{translate(translateSystem("เงื่อนไขการใช้บริการ"))}</button>{translate(translateSystem("และได้อ่าน"))}<button onClick={()=>go("privacy")}>{translate(translateSystem("นโยบายความเป็นส่วนตัว"))}</button>{translateSystem("ของ VillaCheck แล้ว")}</p></div>
      {localAccounts && <div className="test-accounts">
        <strong>{translate(translateSystem("บัญชีทดสอบบนเซิร์ฟเวอร์ Local"))}</strong>
        {testAccounts.filter(account=>account.role!=="Admin").map(account => <button key={account.role === "Merchant" ? "Merchant" : account.role} onClick={() => { setEmail(account.email); setPassword(""); setError(""); }}>
          <span>{account.role === "Merchant" ? "Merchant" : account.role}</span><small>{account.email}</small>
        </button>)}
      </div>}
    </div>
  </main>;
}

export function OwnerPackageAuth({ go }: { go: Go; packageName: string; onOwnerLogin: () => void }) {
  return <LoginPage go={go} accountType="merchant"/>;
}

export function OwnerRegistration({ go }: { go: Go; packageName: string }) {
  const t=useCopy();
  return <FlowPage onHome={()=>go("home")} kicker="MERCHANT REGISTRATION" title={t("registration.merchantTitle")} subtitle={t("registration.merchantDescription")} onBack={() => go("owner-auth")}><SocialLogin accountType="merchant" variant="stacked"/><OtpLogin accountType="merchant" purpose="register" onAuthenticated={account=>{if(account.role==="merchant")go("owner-information");}}/><div className="login-divider"><span>OTP / Password</span></div><PasswordRegistration accountType="merchant" onRegistered={()=>go("owner-information")}/></FlowPage>;
}

export function OwnerOnboardingVilla({ go, onVillaAdded }: { go: Go; onVillaAdded: (name: string) => void }) {
  const [name, setName] = useState("");
  const [province, setProvince] = useState("ชลบุรี");
  return <FlowPage onHome={()=>go("home")} kicker="ADD VILLA" title={translateSystem("เพิ่ม Villa แรกของคุณ")} subtitle={translateSystem('ข้อมูลนี้จะถูกส่งพร้อมคำขอแพ็กเกจ')} onBack={() => go("owner-information")}>
    <div className="form-stack"><label><span>{translateSystem("ชื่อ Villa")}</span><input value={name} onChange={event => setName(event.target.value)} placeholder={translateSystem("ชื่อที่พัก")} /></label><label><span>{translateSystem("จังหวัด")}</span><select value={province} onChange={event => setProvince(event.target.value)}>{["ชลบุรี","ประจวบคีรีขันธ์","นครราชสีมา","ภูเก็ต","เชียงใหม่","กระบี่","สุราษฎร์ธานี"].map(item => <option key={item} value={item}>{translateSystem(item)}</option>)}</select></label><button className="primary-button full" disabled={!name} onClick={() => { onVillaAdded(name); go("package-confirmation"); }}>{translateSystem("บันทึก Villa และดำเนินการต่อ")}</button></div>
  </FlowPage>;
}

export function PackageConfirmation({ go, packageName, villaName, onConfirm }: { go: Go; packageName: string; villaName: string; onConfirm: () => void }) {
  const {plans} = usePackages();
  const selectedPackage = plans.find(p=>p.id === packageName || p.name === packageName);
  if(!selectedPackage)return <FlowPage onHome={()=>go("home")} kicker="PACKAGE" title={translateSystem("กำลังโหลดแพ็กเกจ")} subtitle="" onBack={()=>go("pricing")}><p>{translateSystem("กรุณาเลือกแพ็กเกจที่เปิดใช้งาน")}</p></FlowPage>;
  return <FlowPage onHome={()=>go("home")} kicker="PACKAGE CONFIRMATION" title={translateSystem("ยืนยันแพ็กเกจ")} subtitle={translateSystem('ตรวจสอบรายละเอียดก่อนส่งคำขอ · ยังไม่มี Payment System')} onBack={() => go("pricing")}>
    <div className="confirmation-box package-confirmation">
      <div><span>{translateSystem("Package ที่เลือก")}</span><strong>{packageName}</strong><b>{selectedPackage.amount / 100} THB</b></div>
      <div><span>{translateSystem("Villa ที่เลือก")}</span><strong>{villaName || translateSystem("ยังไม่ได้เลือก Villa")}</strong><button className="text-button" onClick={() => go("owner-select-villa")}>{villaName ? translateSystem("เปลี่ยน Villa") : "Select Villa"} →</button></div>
      <div><span>Features</span><ul>{selectedPackage.features.map(feature => <li key={feature}>✓ {feature}</li>)}</ul></div>
      <p>{translateSystem("ไม่มีการเรียกเก็บเงินใน Prototype ทีมงานจะตรวจสอบและติดต่อกลับหลังอนุมัติคำขอ")}</p>
    </div>
    <button className="primary-button full" disabled={!villaName} onClick={onConfirm}>{translateSystem("ยืนยันแพ็กเกจ")}</button>
  </FlowPage>;
}

export function OwnerSelectVilla({ go, onSelect }: { go: Go; onSelect: (villa: string) => void }) {
  return <FlowPage onHome={()=>go("home")} kicker="SELECT VILLA" title={translateSystem("เลือก Villa สำหรับแพ็กเกจ")} subtitle={translateSystem('เลือกที่พักที่ต้องการใช้แพ็กเกจนี้')} onBack={() => go("package-confirmation")}>
    <div className="villa-choice"><button onClick={() => { onSelect("Sea Sky Pool Villa"); go("package-confirmation"); }}><span>Sea Sky Pool Villa</span><small>{translateSystem("ชลบุรี · VillaCheck VERIFIED")}</small></button><button onClick={() => { onSelect("Hua Hin Blue House"); go("package-confirmation"); }}><span>Hua Hin Blue House</span><small>{translateSystem("ประจวบคีรีขันธ์ · Pending")}</small></button></div>
  </FlowPage>;
}

export function PackageRequestPending({ go, packageName }: { go: Go; packageName: string }) {
  return <FlowPage onHome={()=>go("home")} kicker="REQUEST SUBMITTED" title={translateSystem("ส่งคำขอแพ็กเกจเรียบร้อยแล้ว")} subtitle={translateSystem('ทีมงาน VillaCheck จะตรวจสอบข้อมูลก่อนเปิดใช้งาน')} onBack={() => go("package-confirmation")}>
    <div className="state-panel"><StatusBadge status="Pending" /><h2>{translateSystem("รอดำเนินการ / Pending")}</h2><p>{packageName} {" "}{translateSystem("· ไม่มีการชำระเงินในขั้นตอนนี้")}</p></div>
    <button className="primary-button full" onClick={() => go("owner-dashboard")}>{translateSystem("ไป Merchant Dashboard")}</button>
  </FlowPage>;
}

function FlowPage({ kicker, title, subtitle, onBack, onHome, children }: { kicker: string; title: string; subtitle: string; onBack: () => void; onHome: () => void; children: React.ReactNode }) {
  return <main className="page-bg flow-page"><div className="flow-card"><HomeLogoLink className="flow-brand" onNavigate={onHome}>Villa<span>Check</span></HomeLogoLink>
    <button className="text-button" onClick={onBack}>{translateSystem("← ย้อนกลับ")}</button>
    <span className="kicker">{kicker}</span><h1>{thaiUi(title)}</h1><p>{subtitle}</p>{children}
  </div></main>;
}

const ownerNav: [string, Page][] = [
  ["ภาพรวม", "owner-dashboard"], ["ที่พักของฉัน", "owner-villas"], ["เพิ่มที่พัก", "owner-add-villa"],
  ["แพ็กเกจ", "owner-package"], ["จัดการเอกสาร", "owner-pending"], ["ข้อมูลบัญชี", "owner-profile"],
];
const adminNav: [string, Page][] = [
  ["CMS เว็บไซต์", "admin-cms"], ["Dashboard", "admin-dashboard"], ["Villa รออนุมัติ", "admin-pending-villas"], ["Villa ที่อนุมัติแล้ว", "admin-approved-villas"], ["Users", "admin-users"], ["Merchants", "admin-owners"],
  ["ประวัติตรวจสอบ", "admin-checks"], ["รายงานปัญหา", "admin-reports"], ["ทะเบียน QR", "admin-qr"], ["แพ็กเกจ / โปรโมชั่น", "admin-packages"], ["รีวิวลูกค้า", "admin-reviews"], ["ตรวจการชำระเงิน", "admin-payments"], ["บัญชีรับเงิน", "admin-receiving-bank"], ["Leads", "admin-leads"], ["Settings", "admin-settings"],
];
const userNav: [string, Page][] = [
  ["ภาพรวม", "user-dashboard"], ["ประวัติตรวจสอบ", "user-checks"], ["รายงานของฉัน", "user-reports"], ["ข้อมูลบัญชี", "user-profile"],
  ["ตรวจข้อมูลก่อนโอน", "user-precheck"],
];

const inheritedPortalRole=createContext<string|null>(null);
export function PortalShell(props:Parameters<typeof PortalShellLayout>[0]){const inherited=useContext(inheritedPortalRole);return inherited===props.role?<>{props.children}</>:<PortalShellLayout {...props}/>;}
function PortalShellLayout({ role, page, go, children, phase1: explicitPhase1 }: { phase1?:boolean; role: "Merchant" | "Admin" | "User"; page: Page; go: Go; children: React.ReactNode }) {
  const {t:dashboardText}=useLocale();
  const [detectedPhase1,setDetectedPhase1]=useState<boolean|null>(null);
  useEffect(()=>{if(explicitPhase1!==undefined)return;let active=true;void api<{releaseMode?:string}>("/config").then(c=>{if(active)setDetectedPhase1(["PRELAUNCH","PHASE1","STAGING_INTERACTIVE","MEMBER_PREVIEW"].includes(c.releaseMode||""))}).catch(()=>{if(active)setDetectedPhase1(true)});return()=>{active=false}},[explicitPhase1]);
  const phase1=explicitPhase1??(detectedPhase1!==false);
  const allNav = role === "Merchant" ? ownerNav : role === "Admin" ? adminNav : userNav;
  const nav = role === "Admin" ? adminNav : role === "User" ? userNav : phase1 ? allNav.filter(([label,target])=>role==="Merchant"?["owner-dashboard","owner-villas","owner-add-villa","owner-package","owner-pending","owner-profile"].includes(target)&&label!=="การชำระเงิน":false) : allNav;
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const signOut = async () => {
    try { await logout(); navigate(role === "Admin" ? "admin-login" : "login"); }
    catch (error) { if (error instanceof ApiError && error.status === 401) navigate(role === "Admin" ? "admin-login" : "login"); else setLogoutError(error instanceof Error ? error.message : dashboardText("ออกจากระบบไม่สำเร็จ")); }
  };
  const navigate = (target: Page) => { setMenuOpen(false); go(target); };
  useEffect(() => { setMenuOpen(false); }, [page]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return <inheritedPortalRole.Provider value={role}><main className={`portal-page${role === "User" ? " portal-user" : role === "Merchant" ? " portal-merchant" : ""}`}>
    <aside className={`portal-side ${menuOpen ? "portal-menu-open" : ""}`}>
      <div className="portal-mobile-bar">
        <HomeLogoLink className="portal-brand" onNavigate={() => navigate("home")}>Villa<span>Check</span></HomeLogoLink>
        <button className="portal-menu-toggle" aria-expanded={menuOpen} aria-controls="portal-menu" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? dashboardText(translateSystem("ปิดเมนู"))+" ✕" : dashboardText(translateSystem("เมนู"))+" ☰"}</button>
      </div>
      <small>{dashboardText(role === "Merchant" ? translateSystem("พื้นที่ผู้ประกอบการ") : role==="Admin"?translateSystem("พื้นที่ผู้ดูแลระบบ"):translateSystem("พื้นที่ผู้ใช้งาน"))}</small><div className="portal-locale"><LanguageSwitcher/></div>
      <nav id="portal-menu" aria-label={`${dashboardText(translateSystem("เมนู"))} ${role === "Merchant" ? "Merchant" : role}`}>{nav.map(([label, target]) => <button key={`${target}:${label}`} aria-current={page === target ? "page" : undefined} className={page === target ? "active" : ""} onClick={() => navigate(target)}>{dashboardText(thaiUi(label))}</button>)}</nav>
      <button className="portal-logout" onClick={() => void signOut()}>{dashboardText(translateSystem("ออกจากระบบ"))}</button>{logoutError && <p role="alert">{logoutError}</p>}
    </aside>
    <section className="portal-content"><BusinessReadinessNotice/>{!phase1&&role==="Admin"&&<AdminApprovalNotice go={go}/>}{children}</section>
  </main></inheritedPortalRole.Provider>;
}

function PortalHead({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="portal-head"><div><span className="kicker">VILLACHECK PROTOTYPE</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{thaiUi(status)}</span>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

export function OwnerPages({ page, go, packageName, packageStatus, setPackageName, onPackageChange }: { page: Page; go: Go; packageName: string; packageStatus: string; setPackageName: (name: string) => void; onPackageChange: () => void }) {
  if (page === "owner-dashboard") return <PortalShell role="Merchant" page={page} go={go}>
    <PortalHead title="Merchant Dashboard" subtitle={translateSystem('ภาพรวม Sea Sky Pool Villa')} action={<button className="primary-button" onClick={() => go("owner-add-villa")}>+ Add Villa</button>} />
    <div className="package-strip"><span>{translateSystem("แพ็กเกจปัจจุบัน")}</span><strong>{packageName}</strong><StatusBadge status={packageStatus.includes("Pending") ? "Pending" : "Verified"} /><small>{packageStatus}</small><button onClick={() => go("owner-package")}>{translateSystem("เปลี่ยน Package")}</button></div>
    <div className="metric-grid"><Metric label="Villas" value="1" note="1 Verified" /><Metric label="QR Scans" value="248" note={translateSystem('+18% เดือนนี้')} /><Metric label="Checks" value="91" note="Success 88" /><Metric label="Reports" value="2" note="Pending 1" /></div>
    <div className="portal-grid"><ActionCard title={translateSystem("จัดการ Villa")} text={translateSystem('ดูรายละเอียด แก้ไข และสถานะ')} action={translateSystem('เปิด Villas')} onClick={() => go("owner-villas")} /><ActionCard title="Verification QR" text={translateSystem('เปิดหน้าสแกนและผลตรวจสอบ')} action={translateSystem('เปิด QR')} onClick={() => go("scan")} /><ActionCard title="Analytics" text={translateSystem('ดูสถิติการเข้าชม')} action={translateSystem('ดู Analytics')} onClick={() => go("owner-analytics")} /></div>
  </PortalShell>;

  if (page === "owner-villas") return <PortalShell role="Merchant" page={page} go={go}><PortalHead title="Villas" subtitle={translateSystem('จัดการที่พักทั้งหมด')} action={<button className="primary-button" onClick={() => go("owner-add-villa")}>+ Add Villa</button>} /><DataRow title="Sea Sky Pool Villa" detail="บางแสน, ชลบุรี" status="Verified" action={translateSystem('ดูรายละเอียด')} onClick={() => go("owner-villa-detail")} /></PortalShell>;
  if (page === "owner-villa-detail") return <PortalShell role="Merchant" page="owner-villas" go={go}><PortalHead title="Sea Sky Pool Villa" subtitle="Villa Detail · VC-TH-2025-01842" action={<button className="primary-button" onClick={() => go("owner-villa-edit")}>Edit</button>} /><DetailPanel /><button className="outline-button" onClick={() => go("verify")}>{translateSystem("เปิด Verification Page")}</button></PortalShell>;
  if (page === "owner-villa-edit") return <PortalShell role="Merchant" page="owner-villas" go={go}><PortalHead title="Edit Villa" subtitle={translateSystem('แก้ไขข้อมูลที่พัก')} /><VillaForm submitLabel={translateSystem("บันทึกการแก้ไข")} onSubmit={() => go("owner-villa-detail")} /></PortalShell>;
  if (page === "owner-add-villa") return <PortalShell role="Merchant" page={page} go={go}><PortalHead title="Add Villa" subtitle={translateSystem('กรอกข้อมูลที่พักเพื่อส่งตรวจสอบ')} /><VillaForm submitLabel="Preview" onSubmit={() => go("owner-preview")} /></PortalShell>;
  if (page === "owner-preview") return <PortalShell role="Merchant" page="owner-add-villa" go={go}><PortalHead title="Preview Villa" subtitle={translateSystem('ตรวจสอบข้อมูลก่อน Submit')} /><DetailPanel /><div className="button-row"><button className="outline-button" onClick={() => go("owner-add-villa")}>{translateSystem("กลับไปแก้ไข")}</button><button className="primary-button" onClick={() => go("owner-pending")}>Submit</button></div></PortalShell>;
  if (page === "owner-pending") return <PortalShell role="Merchant" page="owner-villas" go={go}><PortalHead title="Pending Review" subtitle={translateSystem('ส่งข้อมูลเข้าระบบสำเร็จ')} /><StatePanel status="Pending" title={translateSystem("กำลังรอ Admin ตรวจสอบ")} /><button className="primary-button" onClick={() => go("owner-villas")}>{translateSystem("กลับไปหน้า Villas")}</button></PortalShell>;
  if (page === "owner-analytics") return <PortalShell role="Merchant" page={page} go={go}><PortalHead title="Analytics" subtitle={translateSystem('ข้อมูลสาธิต 30 วันล่าสุด')} /><div className="metric-grid"><Metric label="Profile Views" value="1,248" note="+14%" /><Metric label="QR Scans" value="248" note="+18%" /><Metric label="Contact Clicks" value="93" note="+7%" /></div><div className="chart-demo">{[42,68,51,82,60,91,75].map((_, index) => <i key={index} className={`chart-bar-${index + 1}`} />)}</div></PortalShell>;
  if (page === "owner-reports") return <PortalShell role="Merchant" page={page} go={go}><PortalHead title="Reports" subtitle={translateSystem('รายการแจ้งปัญหาที่เกี่ยวข้องกับที่พัก')} /><DataRow title="REP-1048" detail="ผู้ใช้แจ้งข้อมูลบัญชีไม่ตรง" status="Pending" action={translateSystem('รับทราบ')} onClick={() => window.alert(translateSystem("บันทึกการรับทราบรายงานแล้ว"))} /><DataRow title="REP-1022" detail="ข้อมูลติดต่อได้รับการแก้ไขแล้ว" status="Verified" action={translateSystem('ดูรายละเอียด')} onClick={() => window.alert(translateSystem("รายงาน REP-1022: ดำเนินการสำเร็จ"))} /></PortalShell>;
  return <PortalShell role="Merchant" page="owner-package" go={go}><PortalHead title="Package" subtitle={translateSystem("แพ็กเกจปัจจุบัน: {v0} · {v1}", {v0: packageName, v1: packageStatus})} /><PackagePicker selected={packageName} onSelect={name => { setPackageName(name); onPackageChange(); window.alert(translateSystem("ส่งคำขอเปลี่ยนแพ็กเกจเป็น {v0} แล้ว", {v0: name})); }} /></PortalShell>;
}

function VillaForm({ submitLabel, onSubmit }: { submitLabel: string; onSubmit: () => void }) {
  const [name, setName] = useState("Sea Sky Pool Villa");
  const [province, setProvince] = useState("ชลบุรี");
  const [contact, setContact] = useState("08X-XXX-4289");
  return <div className="portal-form">
    <label><span>{translateSystem("ชื่อ Villa")}</span><input value={name} onChange={event => setName(event.target.value)} /></label>
    <label><span>{translateSystem("จังหวัด")}</span><select value={province} onChange={event => setProvince(event.target.value)}>{["ชลบุรี","ประจวบคีรีขันธ์","นครราชสีมา","ภูเก็ต","เชียงใหม่","กระบี่","สุราษฎร์ธานี"].map(item => <option key={item} value={item}>{translateSystem(item)}</option>)}</select></label>
    <label><span>Official Contact</span><input value={contact} onChange={event => setContact(event.target.value)} /></label>
    <label><span>{translateSystem("รายละเอียด")}</span><textarea defaultValue="พูลวิลล่าส่วนตัว พร้อมสระว่ายน้ำและพื้นที่สำหรับครอบครัว" /></label>
    <button className="primary-button" onClick={onSubmit} disabled={!name || !contact}>{submitLabel}</button>
  </div>;
}

function DetailPanel() {
  return <div className="detail-panel"><div><span>{translateSystem("ชื่อที่พัก")}</span><strong>Sea Sky Pool Villa</strong></div><div><span>{translateSystem("จังหวัด")}</span><strong>{translateSystem("ชลบุรี")}</strong></div><div><span>Official Contact</span><strong>08X-XXX-4289</strong></div><div><span>Status</span><StatusBadge status="Verified" /></div></div>;
}

function PackagePicker({ selected, onSelect }: { selected: string; onSelect: (name: string) => void }) {
  const {plans}=usePackages();
  return <div className="package-picker">{plans.map(p=>p.name).map(name => <button key={name} className={selected === name ? "active" : ""} onClick={() => onSelect(name)}><span>{name}</span><small>{selected === name ? translateSystem("แพ็กเกจปัจจุบัน") : translateSystem("เลือกแพ็กเกจ")}</small></button>)}</div>;
}

export function AdminPages({ page, go, villaStatus, setVillaStatus }: { page: Page; go: Go; villaStatus: Status; setVillaStatus: (status: Status) => void }) {
  if (page === "admin-dashboard") return <PortalShell role="Admin" page={page} go={go}><PortalHead title="Admin Dashboard" subtitle={translateSystem('ภาพรวมระบบ VillaCheck')} /><div className="metric-grid"><Metric label="Pending Villas" value="4" note={translateSystem('รอตรวจสอบ')} /><Metric label="Merchants" value="128" note="Active 123" /><Metric label="Checks" value="2,481" note={translateSystem('เดือนนี้')} /><Metric label="Reports" value="12" note="Open 3" /></div><ActionCard title="Pending Villa" text={translateSystem('Sea Sky Pool Villa รอการตรวจสอบ')} action="Review" onClick={() => go("admin-pending-villas")} /><StateGallery /></PortalShell>;
  const configs: Partial<Record<Page, [string,string]>> = {
    "admin-owners": ["Merchants", "บัญชีเจ้าของที่พักและสถานะการใช้งาน"],
    "admin-villas": ["Villas", "รายการ Villa และสถานะล่าสุด"],
    "admin-checks": ["Checks", "ประวัติการตรวจสอบก่อนโอน"],
    "admin-reports": ["Reports", "รายงานปัญหาจากผู้ใช้งาน"],
    "admin-qr": ["QR", "QR Reference และสถานะ"],
    "admin-packages": ["Packages", "แพ็กเกจที่ Merchant ใช้งาน"],
  };
  const [title, subtitle] = (configs[page] ?? ["Admin", "จัดการระบบ"]).map(value=>translateSystem(value));
  return <PortalShell role="Admin" page={page} go={go}><PortalHead title={title} subtitle={subtitle} />
    {page === "admin-owners" && <><DataRow title="Sea Sky Co., Ltd." detail="owner@villacheck.test" status="Verified" action={translateSystem('เปิด Merchant')} onClick={() => window.alert("Merchant: Sea Sky Co., Ltd.")} /><DataRow title="North Stay Group" detail="สถานะถูกระงับชั่วคราว" status="Suspended" action={translateSystem('ตรวจสอบ')} onClick={() => window.alert(translateSystem("บัญชี Suspended"))} /></>}
    {page === "admin-villas" && <DataRow title="Sea Sky Pool Villa" detail="VC-TH-2025-01842" status={villaStatus} action="Review" onClick={() => go("admin-pending-villas")} />}
    {page === "admin-checks" && <DataRow title="CHK-2081" detail="Sea Sky Pool Villa · Success" status="Verified" action={translateSystem('ดู Check')} onClick={() => window.alert("CHK-2081 · Verification Success · Sea Sky Pool Villa")} />}
    {page === "admin-reports" && <DataRow title="REP-1048" detail="ข้อมูลบัญชีไม่ตรง" status="Pending" action={translateSystem('เปิด Report')} onClick={() => window.alert(translateSystem("REP-1048 · อยู่ระหว่างตรวจสอบข้อมูลบัญชี"))} />}
    {page === "admin-qr" && <><DataRow title="VC-TH-2025-01842" detail="Sea Sky Pool Villa" status="Verified" action="Verification Page" onClick={() => go("verify")} /><DataRow title="VC-TH-2024-00991" detail="QR หมดอายุ" status="Expired" action={translateSystem('ดูรายละเอียด')} onClick={() => window.alert(translateSystem("QR นี้หมดอายุแล้ว"))} /></>}
    {page === "admin-packages" && <PackagePicker selected="Trust Pro" onSelect={name => window.alert(translateSystem("เปิดรายละเอียด {v0}", {v0: name}))} />}
  </PortalShell>;
}

function StateGallery() {
  const [state, setState] = useState("Loading");
  const states = ["Loading","Empty","Success","Error","Pending","Verified","Rejected","Suspended","Expired"];
  return <div className="state-gallery"><strong>Interaction States</strong><div>{states.map(item => <button key={item} className={state === item ? "active" : ""} onClick={() => setState(item)}>{item}</button>)}</div><p>{state === "Loading" ? translateSystem("กำลังโหลดข้อมูล...") : state === "Empty" ? translateSystem("ยังไม่มีข้อมูลในรายการนี้") : translateSystem("สถานะ {v0}", {v0: state})}</p></div>;
}

export function UserPages({ page, go, reports, selectedReference }: { page: Page; go: Go; reports: UserReport[]; selectedReference?: string }) {
  if (page === "user-dashboard") return <PortalShell role="User" page={page} go={go}><PortalHead title="User Dashboard" subtitle={translateSystem('ตรวจสอบที่พักก่อนโอนอย่างมั่นใจ')} action={<button className="primary-button" onClick={() => go("user-precheck")}>Check Before Transfer</button>} /><div className="metric-grid"><Metric label="Checks" value="3" note="Verified 2" /><Metric label="Reports" value={String(reports.length)} note={translateSystem('กำลังดำเนินการ')} /></div><div className="portal-grid"><ActionCard title="Checks" text={translateSystem('ดูประวัติการตรวจสอบ')} action={translateSystem('เปิด Checks')} onClick={() => go("user-checks")} /><ActionCard title={translateSystem("Report ของฉัน")} text={translateSystem('ติดตามรายงานปัญหา')} action={translateSystem('เปิด Report')} onClick={() => go("user-reports")} /></div></PortalShell>;
  if (page === "user-checks") return <PortalShell role="User" page={page} go={go}><PortalHead title="Checks" subtitle={translateSystem('ประวัติการตรวจสอบก่อนโอน')} /><DataRow title="CHK-2081" detail="Sea Sky Pool Villa · 20 มิ.ย. 2568" status="Verified" action="Check Detail" onClick={() => go("user-check-detail")} /></PortalShell>;
  if (page === "user-check-detail") return <PortalShell role="User" page="user-checks" go={go}><PortalHead title="Check Detail" subtitle="Reference CHK-2081" /><StatePanel status="Verified" title="VillaCheck VERIFIED" /><DetailPanel /><button className="outline-button" onClick={() => go("detail")}>{translateSystem("ดู Trust Profile")}</button></PortalShell>;
  if (page === "user-reports") return <PortalShell role="User" page={page} go={go}><PortalHead title={translateSystem("Report ของฉัน")} subtitle={translateSystem('รายงานที่ผูกกับบัญชี User ของคุณ')} action={<button className="primary-button" onClick={() => go("villa-report")}>{translateSystem("+ แจ้งปัญหา")}</button>} />{reports.length ? reports.map(report => <DataRow key={report.reference} title={report.reference} detail={`${report.villa} · ${report.type}`} status="Pending" action="Report Detail" onClick={() => go("user-report-detail", report.reference)} />) : <StatePanel status="Pending" title={translateSystem("ยังไม่มี Report")} />}</PortalShell>;
  if (page === "user-report-detail") return <PortalShell role="User" page="user-reports" go={go}><PortalHead title="Report Detail" subtitle={`Reference ${reports.find(report => report.reference === selectedReference)?.reference ?? reports[0]?.reference ?? "RPT-1042"}`} /><StatePanel status="Pending" title={translateSystem("ทีมงานกำลังตรวจสอบ")} /><p className="portal-note">{translateSystem("ระบบได้รับข้อมูลแล้ว และจะแจ้งผลเมื่อดำเนินการเสร็จสิ้น")}</p><button className="outline-button" onClick={() => go("user-reports")}>{translateSystem("กลับไป Report ของฉัน")}</button></PortalShell>;
  if (page === "user-check-success") return <PortalShell role="User" page="user-precheck" go={go}><PortalHead title={translateSystem("สร้างรายการตรวจสอบสำเร็จ")} subtitle={translateSystem('บันทึกข้อมูลเรียบร้อยแล้ว')} /><StatePanel status="Verified" title="CHK-2081" /><button className="primary-button" onClick={() => go("user-check-detail")}>{translateSystem("ดู Check Detail")}</button></PortalShell>;
  return <PortalShell role="User" page="user-precheck" go={go}><PortalHead title="Check Before Transfer" subtitle={translateSystem('กรอกข้อมูลก่อนโอนเพื่อสร้างรายการตรวจสอบ')} /><PrecheckForm onSubmit={() => go("user-check-success")} /></PortalShell>;
}

function PrecheckForm({ onSubmit }: { onSubmit: () => void }) {
  const [villa, setVilla] = useState("");
  const [account, setAccount] = useState("");
  const [contact, setContact] = useState("");
  return <div className="portal-form"><label><span>{translateSystem("ชื่อ Villa")}</span><input value={villa} onChange={event => setVilla(event.target.value)} placeholder={translateSystem("ชื่อที่พัก")} /></label><label><span>{translateSystem("เลขบัญชีที่ได้รับ")}</span><input value={account} onChange={event => setAccount(event.target.value)} placeholder="XXX-X-XXXXX-X" /></label><label><span>{translateSystem("ช่องทางติดต่อ")}</span><input value={contact} onChange={event => setContact(event.target.value)} placeholder={translateSystem("เบอร์โทรหรือ LINE")} /></label><button className="primary-button" disabled={!villa || !account || !contact} onClick={onSubmit}>Submit</button></div>;
}

function ActionCard({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) {
  return <article className="action-card"><h3>{title}</h3><p>{text}</p><button className="text-button" onClick={onClick}>{action} →</button></article>;
}

function DataRow({ title, detail, status, action, onClick }: { title: string; detail: string; status: Status; action: string; onClick: () => void }) {
  return <div className="data-row"><div><strong>{title}</strong><span>{detail}</span></div><StatusBadge status={status} /><button className="outline-button" onClick={onClick}>{action}</button></div>;
}

function StatePanel({ status, title }: { status: Status; title: string }) {
  return <div className="state-panel"><StatusBadge status={status} /><h2>{title}</h2><p>{translateSystem("สถานะล่าสุดจากระบบ Prototype ของ VillaCheck")}</p></div>;
}
