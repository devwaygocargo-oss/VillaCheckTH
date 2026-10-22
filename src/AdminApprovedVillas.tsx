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
      catch(e){if(active){if(e instanceof ApiError&&e.status===401)go("admin-login");else setError(e instanceof Error?e.message:"โหลดรายการไม่สำเร็จ");}}
      finally{fetching=false;if(active)setLoading(false);}
    };
    void load();const timer=window.setInterval(()=>void load(),10000);
    return()=>{active=false;clearInterval(timer);};
  },[]);
  const search=query.trim().toLocaleLowerCase();
  const visible=villas.filter(v=>[v.name,v.nameEn,v.province,v.merchant,v.email,v.qr,v.package,v.packageId].some(value=>value.toLocaleLowerCase().includes(search)));
  return <PortalShell role="Admin" page="admin-approved-villas" go={go}>
    <div className="portal-head"><div><h1>Villa ที่อนุมัติแล้ว</h1><p>รายการที่ผ่านการตรวจจาก Admin ข้อมูลและสถานะจากระบบเดียวกับหน้าลูกค้า</p></div><button className="outline-button" onClick={()=>go("admin-pending-villas")}>ดู Villa รออนุมัติ</button></div>
    <section className="merchant-panel portal-form"><label>ค้นหา Villa ที่อนุมัติแล้ว<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ชื่อ Villa จังหวัด Merchant หรือ QR"/></label><p role="status">{loading?"กำลังโหลดรายการ…":`อนุมัติแล้ว ${villas.length} รายการ · แสดง ${visible.length} รายการ`}</p></section>
    {error&&<p role="alert" className="form-message">{error}</p>}
    {!loading&&!visible.length&&<section className="merchant-panel">{search?"ไม่พบ Villa ที่ตรงกับการค้นหา":"ยังไม่มี Villa ที่อนุมัติแล้ว"}</section>}
    {visible.map(villa=><article key={villa.id} className="merchant-panel approved-villa" aria-label={`อนุมัติแล้ว ${villa.name}`}>
      <h2>{villa.name}</h2><p className="merchant-status">อนุมัติแล้ว{ /dummy|demo|sample/i.test(`${villa.name} ${villa.merchant} ${villa.document.name}`) && " · DUMMY / ข้อมูลสาธิต ไม่ใช่ที่พักจริง"}</p>
      <p>{villa.province} · {villa.merchant} · {villa.package}</p>
      <VillaEntitlements villa={villa} plan={plans.find(p=>p.id===villa.packageId)} error={packageError} go={go}/>
      {["pro","premium"].includes(villa.packageId)&&<section className="approved-villa-social" aria-label={`ส่งสื่อโปรโมท ${villa.name}`}><h3>ส่งสื่อโปรโมททาง Social Media</h3><p>ให้เจ้าของที่พักส่ง{villa.packageId==="premium"?"รูปภาพและวิดีโอ":"รูปภาพ"}ผ่านข้อความ Facebook ของ VillaCheck เดือนละ 1 ครั้ง พร้อมชื่อที่พักและเดือนที่ต้องการโปรโมท</p><p>{villa.packageId==="premium"?"แพ็กเกจ 4,990: ภาพเดี่ยว 1 โพสต์ + วิดีโอ 1 ชิ้นต่อเดือน":"แพ็กเกจ 2,990: ภาพเดี่ยว 1 โพสต์ต่อเดือน"} · โปรโมทบนทุก Social Media ของ VillaCheck รวมงบโฆษณาตามสิทธิ์แพ็กเกจ</p>{site.facebook?<a className="outline-button" href={site.facebook} target="_blank" rel="noopener noreferrer">ส่งสื่อทาง Facebook ↗</a>:<p>ติดต่อทีม VillaCheck เพื่อขอช่องทางส่งสื่อทาง Facebook</p>}</section>}
      {villa.photoUrl&&<img className="pending-villa-photo" src={villa.photoUrl} alt={`รูป ${villa.name}`}/>}
      <details open><summary>ข้อมูล Villa สำหรับ Admin</summary><dl className="pending-villa-fields">{[
        ["Merchant",villa.merchant],["อีเมล",villa.email],["เบอร์โทร",villa.phone],["ธนาคาร",villa.bankName],["ชื่อบัญชี",villa.accountName],["เลขบัญชี",villa.accountNumber],["จำนวนผู้เข้าพักสูงสุด",villa.guestCapacity==null?"ไม่ได้ระบุ":`${villa.guestCapacity} คน`],["QR Reference",villa.qr||"ยังไม่มี QR"],
      ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||"ไม่ได้ระบุ"}</dd></div>)}</dl></details>
      <p>เอกสารที่แนบ: {villa.document.name}</p>
      <div className="button-row"><a className="outline-button" href={`${villa.document.data}?preview=1`} target="_blank" rel="noreferrer">เปิดดูเอกสารที่แนบ</a><a className="outline-button" href={villa.document.data} download={villa.document.name}>ดาวน์โหลดเอกสาร</a>{villa.qr&&<button className="primary-button" onClick={()=>go("admin-verify",villa.qr)}>ตรวจสอบ Villa และ QR</button>}</div>
    </article>)}
  </PortalShell>;
}
