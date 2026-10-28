import {t as translateSystem} from "./locale"
import {t} from "./locale"
import StatusCornerRibbon from "./StatusCornerRibbon"
import DemoPhoto from "./DemoPhoto"
import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { PortalShell, type Page } from "./prototype";
import type { MerchantVilla, Store } from "./merchantStore";
import { useCms } from "./cms";
import VillaEntitlements from "./VillaEntitlements";
import { usePackages } from "./packagePlans";

export default function AdminApprovedVillas({go}:{go:(page:Page,item?:string)=>void}) {
  const {site}=useCms();
  const {plans,error:packageError}=usePackages(true);
  const [villas,setVillas]=useState<MerchantVilla[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState("");
  useEffect(()=>{
    let active=true,fetching=false;
    const load=async()=>{
      if(fetching)return;fetching=true;
      try{const state=await api<Store>("/state");if(active){setVillas(state.villas.filter(v=>v.status==="approved"));setError("");}}
      catch(e){if(active){if(e instanceof ApiError&&e.status===401)go("admin-login");else setError(e instanceof Error?e.message:translateSystem("โหลดรายการไม่สำเร็จ"));}}
      finally{fetching=false;if(active)setLoading(false);}
    };
    void load();const timer=window.setInterval(()=>void load(),10000);
    return()=>{active=false;clearInterval(timer);};
  },[]);
  const search=query.trim().toLocaleLowerCase();
  const visible=villas.filter(v=>[v.name,v.nameEn,v.province,v.merchant,v.email,v.qr,v.package,v.packageId].some(value=>value.toLocaleLowerCase().includes(search)));
  return <PortalShell role="Admin" page="admin-approved-villas" go={go}>
    <div className="portal-head"><div><h1>{translateSystem("Villa ที่อนุมัติแล้ว")}</h1><p>{translateSystem("รายการที่ผ่านการตรวจจาก Admin ข้อมูลและสถานะจากระบบเดียวกับหน้าลูกค้า")}</p></div><button className="outline-button" onClick={()=>go("admin-pending-villas")}>{translateSystem("ดู Villa รออนุมัติ")}</button></div>
    <section className="merchant-panel portal-form"><label>{translateSystem("ค้นหา Villa ที่อนุมัติแล้ว")}<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={translateSystem("ชื่อ Villa จังหวัด Merchant หรือ QR")}/></label><p role="status">{loading?translateSystem("กำลังโหลดรายการ…"):translateSystem("อนุมัติแล้ว {v0} รายการ · แสดง {v1} รายการ", {v0: villas.length, v1: visible.length})}</p></section>
    {error&&<p role="alert" className="form-message">{error}</p>}
    {!loading&&!visible.length&&<section className="merchant-panel">{search?translateSystem("ไม่พบ Villa ที่ตรงกับการค้นหา"):translateSystem("ยังไม่มี Villa ที่อนุมัติแล้ว")}</section>}
    {visible.map(villa=><article key={villa.id} className="merchant-panel approved-villa" aria-label={translateSystem("อนุมัติแล้ว {v0}", {v0: villa.name})}>
      <h2>{villa.name}</h2><button type="button" className="outline-button" onClick={()=>go("admin-villa-page",villa.id)}>{translateSystem("จัดการหน้ารายละเอียด")}</button><p className="merchant-status">{translateSystem("อนุมัติแล้ว")}{ /dummy|demo|sample/i.test(`${villa.name} ${villa.merchant} ${villa.document.name}`) && " · DUMMY / ข้อมูลสาธิต ไม่ใช่ที่พักจริง"}</p>
      <p>{villa.province} · {villa.merchant} · {villa.package}</p>
      <VillaEntitlements villa={villa} plan={plans.find(p=>p.id===villa.packageId)} error={packageError} go={go}/>
      {["pro","premium"].includes(villa.packageId)&&<section className="approved-villa-social" aria-label={translateSystem("ส่งสื่อโปรโมท {v0}", {v0: villa.name})}><h3>{translateSystem("ส่งสื่อโปรโมททาง Social Media")}</h3><p>{translateSystem("ให้เจ้าของที่พักส่ง")}{villa.packageId==="premium"?translateSystem("รูปภาพและวิดีโอ"):translateSystem("รูปภาพ")}{translateSystem("ผ่านข้อความ Facebook ของ VillaCheck เดือนละ 1 ครั้ง พร้อมชื่อที่พักและเดือนที่ต้องการโปรโมท")}</p><p>{villa.packageId==="premium"?translateSystem("แพ็กเกจ 4,990: ภาพเดี่ยว 1 โพสต์ + วิดีโอ 1 ชิ้นต่อเดือน"):translateSystem("แพ็กเกจ 2,990: ภาพเดี่ยว 1 โพสต์ต่อเดือน")} {" "}{translateSystem("· โปรโมทบนทุก Social Media ของ VillaCheck รวมงบโฆษณาตามสิทธิ์แพ็กเกจ")}</p>{site.facebook?<a className="outline-button" href={site.facebook} target="_blank" rel="noopener noreferrer">{translateSystem("ส่งสื่อทาง Facebook ↗")}</a>:<p>{translateSystem("ติดต่อทีม VillaCheck เพื่อขอช่องทางส่งสื่อทาง Facebook")}</p>}</section>}
      <div className="villa-image"><DemoPhoto className="pending-villa-photo" demo={villa.demoImage} src={villa.photoUrl} alt={translateSystem("รูป {v0}", {v0: villa.name})}/><StatusCornerRibbon villa={villa}/></div>
      <details open><summary>{translateSystem("ข้อมูล Villa สำหรับ Admin")}</summary><dl className="pending-villa-fields">{[
        ["Merchant",villa.merchant],["อีเมล",villa.email],["เบอร์โทร",villa.phone],["ธนาคาร",villa.bankName],["ชื่อบัญชี",villa.accountName],["เลขบัญชี",villa.accountNumber],["จำนวนผู้เข้าพักสูงสุด",villa.guestCapacity==null?translateSystem("ไม่ได้ระบุ"):translateSystem("{v0} คน", {v0: villa.guestCapacity})],["QR Reference",villa.qr||translateSystem("ยังไม่มี QR")],
      ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||translateSystem("ไม่ได้ระบุ")}</dd></div>)}</dl></details>
      <p>{translateSystem("เอกสารที่แนบ:")}{" "}{villa.document.name}</p>
      <div className="button-row"><a className="outline-button" href={`${villa.document.data}?preview=1`} target="_blank" rel="noreferrer">{translateSystem("เปิดดูเอกสารที่แนบ")}</a><a className="outline-button" href={villa.document.data} download={villa.document.name}>{translateSystem("ดาวน์โหลดเอกสาร")}</a>{villa.qr&&<button className="primary-button" onClick={()=>go("admin-verify",villa.qr)}>{translateSystem("ตรวจสอบ Villa และ QR")}</button>}</div>
    </article>)}
  </PortalShell>;
}
