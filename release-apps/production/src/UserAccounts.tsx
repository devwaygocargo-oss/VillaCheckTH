import AccountPrivacy from "./AccountPrivacy"
import AccountSecurity from "./AccountSecurity"
import {BusinessWriteFieldset} from './BusinessReadiness';
import PasswordRegistration from "./PasswordRegistration"
import {useCopy} from "./cms";
import SocialLogin from "./SocialLogin";
import HomeLogoLink from "./HomeLogoLink";
import { useEffect, useState } from "react";
import { api, currentAccount, ApiError } from "./api";
import { PortalShell, type Page } from "./prototype";
import type { Account } from "./merchantStore";

export { SocialLogin };

export function UserRegistration({ go, reference }: { go: (page: Page, item?: string) => void; reference: string }) {
  const t=useCopy();
  return <main className="auth-page"><div className="auth-card"><HomeLogoLink className="flow-brand" onNavigate={()=>go("home")}>Villa<span>Check</span></HomeLogoLink><button className="text-button" onClick={() => go("login", reference)}>← เข้าสู่ระบบ</button><span className="kicker">VILLACHECK / USER ACCOUNT</span><h1>{t("registration.userTitle")}</h1><p>{t("registration.userDescription")}</p><SocialLogin reference={reference} /><PasswordRegistration accountType="user" onRegistered={()=>go(reference?"verify":"user-dashboard",reference)}/></div></main>;
}

type Member = { id: string; name: string; email: string; created: string; lastLogin: string | null; providers: string[] };
const timestamp = (value: string | null) => value ? new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "ยังไม่เข้าใช้";
export function AdminUsers({ go }: { go: (page: Page) => void }) {
  const [users, setUsers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void currentAccount().then(user => { if (user.role !== "admin") throw Error("เฉพาะ Admin สามารถดูข้อมูล User ได้"); return api<{ users: Member[] }>("/admin/users"); }).then(v => { if (!cancelled) setUsers(v.users); }).catch(error => { if (!cancelled) setError(error.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const visible = users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()));
  return <PortalShell role="Admin" page="admin-users" go={go}><div className="portal-head"><div><span className="kicker">MEMBER MANAGEMENT</span><h1>ข้อมูล User</h1><p>สมาชิก {users.length} บัญชี · ข้อมูลจาก Backend</p></div></div><div className="merchant-toolbar"><input aria-label="ค้นหา User" placeholder="ค้นหาชื่อหรืออีเมล…" value={search} onChange={e => setSearch(e.target.value)} /></div>{error && <p role="alert">{error}</p>}{loading ? <p>กำลังโหลดข้อมูล…</p> : <div className="user-table-wrap"><table className="user-table"><thead><tr><th>สมาชิก</th><th>ช่องทางสมัคร</th><th>วันที่สมัคร</th><th>เข้าใช้ล่าสุด</th></tr></thead><tbody>{visible.map(user => <tr key={user.id}><td data-label="สมาชิก"><strong>{user.name}</strong><small>{user.email}</small></td><td data-label="ช่องทางสมัคร">{user.providers.length ? user.providers.map(p => p === "google" ? "Google" : p === "line" ? "LINE" : "Facebook").join(", ") : "อีเมล / รหัสผ่าน"}</td><td data-label="วันที่สมัคร">{timestamp(user.created)}</td><td data-label="เข้าใช้ล่าสุด">{timestamp(user.lastLogin)}</td></tr>)}</tbody></table>{!visible.length && <p className="merchant-empty">ไม่พบสมาชิก</p>}</div>}</PortalShell>;
}

export function MemberDashboard({ go }: { go: (page: Page) => void }) {
  const [user, setUser] = useState<Account | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let cancelled = false; void currentAccount().then(value => { if (!cancelled) { if (value.role !== "user") go("login"); else setUser(value); } }).catch(error => { if (!cancelled) setError(error.message); }); return () => { cancelled = true; }; }, []);
  return <PortalShell role="User" page="user-dashboard" go={go}><div className="portal-head"><div><span className="kicker">VILLACHECK / MEMBER</span><h1>{user ? `สวัสดี ${user.name}` : "บัญชี User"}</h1><p>{user?.email}</p></div></div>{error ? <div className="merchant-panel"><p role="alert">{error}</p><button className="primary-button" onClick={() => go("login")}>เข้าสู่ระบบ</button></div> : <div className="merchant-panel"><h2>ตรวจสอบที่พักก่อนโอน</h2><p>สแกน QR ของที่พักเพื่อดูข้อมูลที่ผ่านการตรวจสอบ และกรอกข้อมูลที่ได้รับเพื่อตรวจว่าตรงกับทะเบียนหรือไม่</p><button className="primary-button" onClick={() => go("scan")}>สแกน QR ที่พัก →</button></div>}</PortalShell>;
}


export function UserProfile({go}:{go:(page:Page)=>void}) {
 const [readOnly,setReadOnly]=useState(false);
 const [profile,setProfile]=useState({name:"",email:"",phone:"",address:""}),[ready,setReady]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{let active=true;void Promise.all([currentAccount(),api<{profile:typeof profile;readOnly?:boolean}>("/user/profile")]).then(([user,data])=>{if(user.role!=="user")throw Error("หน้านี้สำหรับสมาชิกผู้ใช้งาน");return data}).then(data=>{if(active){setProfile(data.profile);setReadOnly(data.readOnly===true);setReady(true)}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 return <PortalShell role="User" page="user-profile" go={go}><h1>ข้อมูลบัญชี</h1>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{readOnly&&<p role="status">ยังไม่เปิดการบันทึกข้อมูลในขณะรอการตั้งค่าที่จำเป็น</p>}{loading?<p role="status">กำลังโหลดข้อมูล…</p>:!ready?<button className="primary-button" onClick={()=>go("login")}>เข้าสู่ระบบ</button>:<BusinessWriteFieldset><form className="portal-form merchant-panel" onSubmit={async e=>{e.preventDefault();if(readOnly)return;setBusy(true);setError("");setNotice("");try{await currentAccount();const saved=await api<{profile:typeof profile}>("/user/profile",{name:profile.name,phone:profile.phone,address:profile.address});setProfile(saved.profile);setNotice("บันทึกข้อมูลบัญชีแล้ว")}catch(e){if(e instanceof ApiError&&e.status===401){setReady(false);setProfile({name:"",email:"",phone:"",address:""});setError("การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง")}else setError(e instanceof Error?e.message:"บันทึกไม่สำเร็จ")}finally{setBusy(false)}}}>
 <label>ชื่อ-นามสกุล<input readOnly={readOnly} required maxLength={200} value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><label>อีเมล<input type="email" value={profile.email} readOnly/></label><label>เบอร์โทร<input readOnly={readOnly} type="tel" maxLength={25} value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})}/></label><label>ที่อยู่<textarea readOnly={readOnly} maxLength={1000} value={profile.address} onChange={e=>setProfile({...profile,address:e.target.value})}/></label><button className="primary-button" disabled={busy||readOnly} type="submit">{busy?"กำลังบันทึก…":"บันทึกข้อมูล"}</button></form></BusinessWriteFieldset>}{ready&&<><AccountSecurity onSignedOut={()=>go("login")}/><SocialLogin variant="stacked" accountType="user" linking/><AccountPrivacy/></>}</PortalShell>
}
