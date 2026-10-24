import PasswordRegistration from "./PasswordRegistration"
import {useCopy} from "./cms";
import SocialLogin from "./SocialLogin";
import HomeLogoLink from "./HomeLogoLink";
import { useEffect, useState } from "react";
import { api, currentAccount } from "./api";
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
