import {t as translateSystem} from "./locale"
import {t,localeTag} from "./locale"
import StatusCornerRibbon from "./StatusCornerRibbon"
import DemoPhoto from "./DemoPhoto"
import {BusinessWriteFieldset} from './BusinessReadiness';
import OwnershipDocuments from "./OwnershipDocuments";
import { useEffect, useRef, useState } from "react";
import { api, currentAccount, ApiError } from "./api";
import { PortalShell, type Page } from "./prototype";
import type { MerchantVilla, Store } from "./merchantStore";

import VillaEntitlements from "./VillaEntitlements";
import { usePackages,type PackagePlan } from "./packagePlans";

function PendingVilla({villa,busy,onReview,plan,packageError,go}:{villa:MerchantVilla;busy:boolean;onReview:(villa:MerchantVilla,status:string,reason:string,level:string)=>Promise<void>;plan?:PackagePlan;packageError:string;go:(page:Page,item?:string)=>void}) {
  const [reason,setReason]=useState("");
  const [level,setLevel]=useState(villa.packageId==="basic"?"BASIC_CHECKED":"VERIFIED");
  const request=villa.reviewRequest;
  const dummy=/dummy|demo|sample/i.test(villa.document.name);
  return <BusinessWriteFieldset><article className="merchant-panel pending-villa" aria-label={translateSystem("รออนุมัติ {v0}", {v0: villa.name})}>
    <h2>{villa.name}</h2><OwnershipDocuments key={`ownership-${villa.id}`} villaId={villa.id} admin/><button type="button" className="outline-button" onClick={()=>go("admin-villa-page",villa.id)}>{translateSystem("จัดการหน้ารายละเอียด")}</button><p className="merchant-status">{villa.reviewRequest?.startedAt?translateSystem("อยู่ระหว่างการพิจารณา"):translateSystem("รอตรวจสอบ")}</p>{!villa.reviewRequest?.startedAt&&<button type="button" className="outline-button" disabled={busy} onClick={()=>void onReview(villa,"begin","",level)}>{translateSystem("เริ่มพิจารณา")}</button>}
    {villa.packageId==="basic"&&<p className="form-message">{translateSystem("Basic Verify ตรวจข้อมูลเบื้องต้น ไม่ต้องยืนยันเจ้าของบ้าน ไม่ต้องส่งภาพใบหน้าหรือทะเบียนบ้านสำหรับขั้นตอนยืนยันเจ้าของบ้าน")}</p>}
    <VillaEntitlements villa={villa} plan={plan} error={packageError} go={go}/>
    <p><strong>{translateSystem("สาเหตุที่รออนุมัติ:")}{" "}</strong>{request?.summary||translateSystem("รอตรวจเอกสารกรรมสิทธิ์และข้อมูล Villa")}</p>
    <p>{translateSystem("ส่งตรวจ:")}{" "}{request?.submittedAt?new Date(request.submittedAt).toLocaleString(localeTag(),{timeZone:"Asia/Bangkok"}):translateSystem("ไม่มีประวัติเวลาส่งตรวจเดิม")}{request?.submittedBy?translateSystem(" · ผู้ส่ง: {v0}", {v0: request.submittedBy}):""}</p>
    {!!request?.changes.length&&<div className="pending-change-table" role="region" aria-label={translateSystem("ตารางข้อมูลที่เปลี่ยน เลื่อนแนวนอนได้")} tabIndex={0}><table><caption>{translateSystem("ข้อมูลที่เปลี่ยนเพื่อให้ Admin ตรวจสอบ")}</caption><thead><tr><th>{translateSystem("รายการ")}</th><th>{translateSystem("ก่อนแก้ไข")}</th><th>{translateSystem("ข้อมูลที่ส่งใหม่")}</th></tr></thead><tbody>{request.changes.map(change=><tr key={change.field}><th>{change.label}</th><td>{change.before||translateSystem("ไม่ได้ระบุ")}</td><td>{change.after||translateSystem("ไม่ได้ระบุ")}</td></tr>)}</tbody></table></div>}
    <details open><summary>{translateSystem("ข้อมูล Villa ทั้งหมดสำหรับ Admin")}</summary><dl className="pending-villa-fields">{[
      ["จังหวัด",villa.province],["Merchant",villa.merchant],["อีเมล",villa.email],["เบอร์โทร",villa.phone],["ธนาคาร",villa.bankName],["ชื่อบัญชี",villa.accountName],["เลขบัญชี",villa.accountNumber],["จำนวนผู้เข้าพักสูงสุด",villa.guestCapacity==null?translateSystem("ไม่ได้ระบุ"):translateSystem("{v0} คน", {v0: villa.guestCapacity})],["แพ็กเกจ",villa.package],["QR เดิม",villa.qr||translateSystem("ยังไม่มี QR")],
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||translateSystem("ไม่ได้ระบุ")}</dd></div>)}</dl></details>
    <div className="villa-image"><DemoPhoto className="pending-villa-photo" demo={villa.demoImage} src={villa.photoUrl} alt={translateSystem("รูป {v0}", {v0: villa.name})}/><StatusCornerRibbon villa={villa}/></div>
    <h3>{villa.packageId==="basic"?translateSystem("เอกสารเบื้องต้นที่แนบ"):translateSystem("เอกสารกรรมสิทธิ์ที่แนบ")}</h3><p>{villa.document.name}</p>
    {dummy&&<p className="form-message" role="note">{translateSystem("DUMMY / เอกสารจำลองสำหรับทดสอบเท่านั้น ไม่ใช่หลักฐานกรรมสิทธิ์จริง")}</p>}
    <div className="button-row"><a className="outline-button" href={`${villa.document.data}?preview=1`} target="_blank" rel="noreferrer">{translateSystem("เปิดดูเอกสารที่แนบ")}</a><a className="outline-button" href={villa.document.data} download={villa.document.name}>{translateSystem("ดาวน์โหลดเอกสาร")}</a></div>
    {villa.document.type.startsWith("image/")&&<img className="merchant-document" src={villa.document.data} alt={translateSystem("เอกสารกรรมสิทธิ์ {v0}", {v0: villa.name})}/>}
    {villa.document.type==="application/pdf"&&<details><summary>{translateSystem("แสดง PDF ที่แนบ")}</summary><iframe className="pending-document-preview" title={translateSystem("เอกสาร {v0}", {v0: villa.document.name})} src={`${villa.document.data}?preview=1`}/></details>}
    <div className="portal-form"><label>{translateSystem("ระดับที่ Admin ตรวจจริง")}<select value={level} onChange={e=>setLevel(e.target.value)}>{["REGISTERED","BASIC_CHECKED","VERIFIED","PREMIUM_VERIFIED"].map(x=><option key={x}>{x}</option>)}</select></label><label>{translateSystem("เหตุผลขอแก้ไขหรือไม่อนุมัติ")}<textarea value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <div className="button-row"><button type="button" className="primary-button" disabled={busy} onClick={()=>void onReview(villa,"approved",reason,level)}>{translateSystem("อนุมัติ Villa")}</button><button type="button" className="outline-button" disabled={busy} onClick={()=>void onReview(villa,"changes",reason,level)}>{translateSystem("ขอเอกสารเพิ่มเติม / แก้ไข")}</button><button type="button" className="danger-button" disabled={busy} onClick={()=>void onReview(villa,"rejected",reason,level)}>{translateSystem("ไม่อนุมัติ")}</button></div></div>
  </article></BusinessWriteFieldset>;
}

export default function AdminPendingVillas({go}:{go:(page:Page,item?:string)=>void}) {
  const {plans,error:packageError}=usePackages(true);
  const [query,setQuery]=useState("");
  const [villas,setVillas]=useState<MerchantVilla[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const working=useRef(false);
  const search=query.trim().toLocaleLowerCase();
  const visible=villas.filter(v=>[v.name,v.nameEn,v.province,v.merchant,v.email,v.qr,v.package,v.packageId].some(value=>value.toLocaleLowerCase().includes(search)));
  useEffect(()=>{
    let active=true,fetching=false;
    const load=async()=>{if(fetching||working.current)return;fetching=true;try{
      const state=await api<Store>("/state");if(active&&!working.current)setVillas(state.villas.filter(v=>v.status==="pending"));
    }catch(e){if(active){if(e instanceof ApiError&&e.status===401)go("admin-login");else setMessage(e instanceof Error?e.message:translateSystem("โหลดรายการไม่สำเร็จ"));}}
    finally{fetching=false;if(active)setLoading(false);}};
    void load();const timer=window.setInterval(()=>void load(),10000);return()=>{active=false;clearInterval(timer);};
  },[]);
  const review=async(villa:MerchantVilla,status:string,reason:string,level:string)=>{
    if(working.current)return;
    if(["changes","rejected"].includes(status)&&!reason.trim()){setMessage(translateSystem("กรุณาระบุเหตุผลขอแก้ไขหรือไม่อนุมัติ"));return;}
    working.current=true;setBusy(true);setMessage("");
    try{await currentAccount();const result=await api<{villas:MerchantVilla[]}>(`/villas/${villa.id}/review`,{status,reason,verificationLevel:level,expectedReviewId:villa.reviewRequest?.id??null});
      setVillas(result.villas.filter(v=>v.status==="pending"));setMessage(status==="approved"?translateSystem("อนุมัติ {v0} แล้ว", {v0: villa.name}):translateSystem("บันทึกผลตรวจสอบ {v0} แล้ว", {v0: villa.name}));
    }catch(e){setMessage(e instanceof Error?e.message:translateSystem("บันทึกผลตรวจสอบไม่สำเร็จ"));}
    finally{working.current=false;setBusy(false);}
  };
  return <PortalShell role="Admin" page="admin-pending-villas" go={go}><div className="portal-head"><div><h1>{translateSystem("Villa รออนุมัติ")}</h1><p>{translateSystem("ตรวจเหตุผล ข้อมูลก่อนและหลังแก้ไข และเอกสารประกอบก่อนอนุมัติ")}</p></div><button className="outline-button" onClick={()=>go("admin-approved-villas")}>{translateSystem("ดู Villa ที่อนุมัติแล้ว")}</button></div>
    <section className="merchant-panel"><p>{translateSystem("Basic Verify ไม่ต้องยืนยันเจ้าของบ้าน ส่วนแพ็กเกจ 1,990 ขึ้นไปตรวจหลักฐานเจ้าของบ้านในหน้านี้ เมื่อ Villa ผ่านอนุมัติและมีแพ็กเกจที่ใช้งานอยู่")}</p><div className="button-row"><button type="button" onClick={()=>document.getElementById("pending-villa-review")?.scrollIntoView({behavior:"smooth"})}>{translateSystem("รายการ Villa รออนุมัติ")}</button><button type="button" onClick={()=>document.getElementById("owner-verification-review")?.scrollIntoView({behavior:"smooth"})}>{translateSystem("ตรวจยืนยันเจ้าของบ้าน · 1,990 ขึ้นไป")}</button></div></section>
    <section id="pending-villa-review" aria-label={translateSystem("รายการ Villa รออนุมัติ")}>
    <label className="pending-villa-search">{translateSystem("ค้นหา Villa / Merchant / แพ็กเกจ")}<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={translateSystem("ชื่อที่พัก จังหวัด หรือแพ็กเกจ")}/></label>
    {message&&<p role="status" className="form-message">{message}</p>}
    <p role="status">{loading?translateSystem("กำลังโหลดรายการ…"):translateSystem("รออนุมัติ {v0} รายการ · แสดง {v1} รายการ", {v0: villas.length, v1: visible.length})}</p>
    {!loading&&!visible.length&&<section className="merchant-panel">{search?translateSystem("ไม่พบ Villa ที่ตรงกับการค้นหา"):translateSystem("ไม่มี Villa รออนุมัติ")}</section>}
    {visible.map(villa=><PendingVilla key={`${villa.id}:${villa.reviewRequest?.id||"legacy"}`} villa={villa} busy={busy} onReview={review} plan={plans.find(p=>p.id===villa.packageId)} packageError={packageError} go={go}/>)}
    </section>
    <div id="owner-verification-review"><p>{translateSystem("ตรวจเอกสารที่พักรายรายการด้านบน การยืนยันเจ้าของบ้านแบบอื่นยังไม่เปิดในขอบเขต Staging นี้")}</p></div>
  </PortalShell>;
}
