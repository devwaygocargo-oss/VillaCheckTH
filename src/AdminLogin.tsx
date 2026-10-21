import HomeLogoLink from "./HomeLogoLink";
import { useState } from "react";
import { authenticateAdmin, logout } from "./api";
import type { Page } from "./prototype";

export default function AdminLogin({go}:{go:(page:Page)=>void}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  return <main className="login-screen"><div className="login-sheet">
    <HomeLogoLink className="login-brand" onNavigate={()=>go("home")}><strong>VillaCheck CMS</strong></HomeLogoLink>
    <h1 className="login-title">เข้าสู่ระบบ Admin</h1>
    <p className="login-account-note">สำหรับผู้ดูแลระบบ VillaCheck</p>
    <form className="login-email-form" onSubmit={async event=>{
      event.preventDefault();if(busy)return;setBusy(true);setError("");
      try {
        const account=await authenticateAdmin(email,password);
        if(account.role!=="admin"){await logout();setError("บัญชีนี้ไม่มีสิทธิ์ Admin");return;}
        go("admin-cms");
      }catch(e){setError(e instanceof Error?e.message:"เข้าสู่ระบบไม่สำเร็จ");}
      finally{setBusy(false);}
    }}>
      <label className="login-field"><span>อีเมล Admin</span><input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label className="login-field"><span>รหัสผ่าน</span><input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      {error&&<p role="alert" className="login-error">{error}</p>}
      <button type="submit" disabled={busy} className="login-submit">{busy?"กำลังเข้าสู่ระบบ…":"เข้าสู่ระบบ Admin"}</button>
    </form>
  </div></main>;
}
