import { useEffect, useState } from "react";
import { api } from "./api";
import type { Store } from "./merchantStore";
import type { Page } from "./prototype";

export default function AdminApprovalNotice({go}:{go:(page:Page,item?:string)=>void}) {
  const [pending,setPending]=useState<Store["villas"]>([]);
  const [error,setError]=useState("");
  const [notifications,setNotifications]=useState<{id:string;type:string;result:string;createdAt:string;status:string}[]>([]);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    let active=true,loading=false;
    const refresh=async()=>{if(loading)return;loading=true;try{
      const [state,outbox]=await Promise.all([api<Store>("/state"),api<{notifications:{id:string;type:string;result:string;createdAt:string;status:string}[]}>("/admin/owner-notifications")]);
      if(active){setPending(state.villas.filter(v=>v.status==="pending"));setNotifications(outbox.notifications);setLoaded(true);setError("");}
    }catch{if(active)setError("โหลดรายการรออนุมัติไม่สำเร็จ");}finally{loading=false;}};
    void refresh();const timer=window.setInterval(()=>void refresh(),10000);
    return()=>{active=false;window.clearInterval(timer);};
  },[]);
  return <section className="merchant-panel admin-approval-notice" aria-label="รายการ Villa รออนุมัติ">
    <strong role="status">{loaded?`Villa รออนุมัติ ${pending.length} รายการ`:"กำลังโหลดรายการรออนุมัติ…"}</strong>
    {error&&<p role="alert">{error}</p>}
    {notifications.length>0&&<details><summary>บันทึกแจ้ง Owner {notifications.length} รายการ</summary><p>บันทึกในระบบแล้ว การส่งภายนอกรอตั้งค่าช่องทาง Owner</p>{notifications.slice(0,10).map(n=><p key={n.id}>{n.type} · {n.result} · {new Date(n.createdAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</p>)}</details>}
    {pending.length>0&&<><p>มีรายการใหม่หรือแก้ไขข้อมูลที่ต้องตรวจสอบก่อนอนุมัติ</p>
      <button className="primary-button" type="button" onClick={()=>go("admin-pending-villas")}>เปิดหน้ารายการ Villa รออนุมัติ</button>
    </>}
  </section>;
}
