import { useEffect, useState } from "react";
import { api } from "./api";
import type { Store } from "./merchantStore";
import type { Page } from "./prototype";

export default function AdminApprovalNotice({go}:{go:(page:Page,item?:string)=>void}) {
  const [pending,setPending]=useState<Store["villas"]>([]);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true,loading=false;
    const refresh=async()=>{if(loading)return;loading=true;try{
      const state=await api<Store>("/state");
      if(active){setPending(state.villas.filter(v=>v.status==="pending"));setError("");}
    }catch{if(active)setError("โหลดรายการรออนุมัติไม่สำเร็จ");}finally{loading=false;}};
    void refresh();const timer=window.setInterval(()=>void refresh(),10000);
    return()=>{active=false;window.clearInterval(timer);};
  },[]);
  return <section className="merchant-panel admin-approval-notice" aria-label="รายการ Villa รออนุมัติ">
    <strong role="status">Villa รออนุมัติ {pending.length} รายการ</strong>
    {error&&<p role="alert">{error}</p>}
    {pending.length>0&&<><p>มีรายการใหม่หรือแก้ไขข้อมูลที่ต้องตรวจสอบก่อนอนุมัติ</p>
      <div className="button-row">{pending.slice(0,5).map(v=><button key={v.id} type="button" className="outline-button" onClick={()=>go("admin-review",v.id)}>ตรวจสอบ {v.name}</button>)}</div>
      <button className="text-button" type="button" onClick={()=>go("admin-villas")}>ดูรายการ Villa ทั้งหมด</button>
    </>}
  </section>;
}
