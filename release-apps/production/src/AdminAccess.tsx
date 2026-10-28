import { useEffect, useState, type ReactNode } from "react";
import { currentAccount } from "./api";
import type { Page } from "./prototype";

export default function AdminAccess({go,children}:{go:(page:Page)=>void;children:ReactNode}) {
  const [allowed,setAllowed]=useState(false);
  useEffect(()=>{let active=true;void currentAccount().then(account=>{
    if(!active)return;
    if(account.role==="admin")setAllowed(true);else go("admin-login");
  }).catch(()=>{if(active)go("admin-login");});return()=>{active=false;};},[]);
  return allowed?<>{children}</>:<main className="login-screen"><p role="status">กำลังตรวจสอบสิทธิ์ Admin…</p></main>;
}
