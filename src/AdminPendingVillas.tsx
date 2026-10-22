import { useEffect, useRef, useState } from "react";
import { api, currentAccount, ApiError } from "./api";
import { PortalShell, type Page } from "./prototype";
import type { MerchantVilla, Store } from "./merchantStore";
import OwnerVerification from "./OwnerVerification";

function PendingVilla({villa,busy,onReview}:{villa:MerchantVilla;busy:boolean;onReview:(villa:MerchantVilla,status:string,reason:string,level:string)=>Promise<void>}) {
  const [reason,setReason]=useState("");
  const [level,setLevel]=useState(villa.packageId==="basic"?"BASIC_CHECKED":"VERIFIED");
  const request=villa.reviewRequest;
  const dummy=/dummy|demo|sample/i.test(villa.document.name);
  return <article className="merchant-panel pending-villa" aria-label={`รออนุมัติ ${villa.name}`}>
    <h2>{villa.name}</h2><p className="merchant-status">รออนุมัติ</p>
    {villa.packageId==="basic"&&<p className="form-message">Basic Verify ตรวจข้อมูลเบื้องต้น ไม่ต้องยืนยันเจ้าของบ้าน ไม่ต้องส่งภาพใบหน้าหรือทะเบียนบ้านสำหรับขั้นตอนยืนยันเจ้าของบ้าน</p>}
    <p><strong>สาเหตุที่รออนุมัติ: </strong>{request?.summary||"รอตรวจเอกสารกรรมสิทธิ์และข้อมูล Villa"}</p>
    <p>ส่งตรวจ: {request?.submittedAt?new Date(request.submittedAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}):"ไม่มีประวัติเวลาส่งตรวจเดิม"}{request?.submittedBy?` · ผู้ส่ง: ${request.submittedBy}`:""}</p>
    {!!request?.changes.length&&<div className="pending-change-table" role="region" aria-label="ตารางข้อมูลที่เปลี่ยน เลื่อนแนวนอนได้" tabIndex={0}><table><caption>ข้อมูลที่เปลี่ยนเพื่อให้ Admin ตรวจสอบ</caption><thead><tr><th>รายการ</th><th>ก่อนแก้ไข</th><th>ข้อมูลที่ส่งใหม่</th></tr></thead><tbody>{request.changes.map(change=><tr key={change.field}><th>{change.label}</th><td>{change.before||"ไม่ได้ระบุ"}</td><td>{change.after||"ไม่ได้ระบุ"}</td></tr>)}</tbody></table></div>}
    <details open><summary>ข้อมูล Villa ทั้งหมดสำหรับ Admin</summary><dl className="pending-villa-fields">{[
      ["จังหวัด",villa.province],["Merchant",villa.merchant],["อีเมล",villa.email],["เบอร์โทร",villa.phone],["ธนาคาร",villa.bankName],["ชื่อบัญชี",villa.accountName],["เลขบัญชี",villa.accountNumber],["จำนวนผู้เข้าพักสูงสุด",villa.guestCapacity==null?"ไม่ได้ระบุ":`${villa.guestCapacity} คน`],["แพ็กเกจ",villa.package],["QR เดิม",villa.qr||"ยังไม่มี QR"],
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||"ไม่ได้ระบุ"}</dd></div>)}</dl></details>
    {villa.photoUrl&&<img className="pending-villa-photo" src={villa.photoUrl} alt={`รูป ${villa.name}`}/>}
    <h3>{villa.packageId==="basic"?"เอกสารเบื้องต้นที่แนบ":"เอกสารกรรมสิทธิ์ที่แนบ"}</h3><p>{villa.document.name}</p>
    {dummy&&<p className="form-message" role="note">DUMMY / เอกสารจำลองสำหรับทดสอบเท่านั้น ไม่ใช่หลักฐานกรรมสิทธิ์จริง</p>}
    <div className="button-row"><a className="outline-button" href={`${villa.document.data}?preview=1`} target="_blank" rel="noreferrer">เปิดดูเอกสารที่แนบ</a><a className="outline-button" href={villa.document.data} download={villa.document.name}>ดาวน์โหลดเอกสาร</a></div>
    {villa.document.type.startsWith("image/")&&<img className="merchant-document" src={villa.document.data} alt={`เอกสารกรรมสิทธิ์ ${villa.name}`}/>}
    {villa.document.type==="application/pdf"&&<details><summary>แสดง PDF ที่แนบ</summary><iframe className="pending-document-preview" title={`เอกสาร ${villa.document.name}`} src={`${villa.document.data}?preview=1`}/></details>}
    <div className="portal-form"><label>ระดับที่ Admin ตรวจจริง<select value={level} onChange={e=>setLevel(e.target.value)}>{["REGISTERED","BASIC_CHECKED","VERIFIED","PREMIUM_VERIFIED"].map(x=><option key={x}>{x}</option>)}</select></label><label>เหตุผลขอแก้ไขหรือไม่อนุมัติ<textarea value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <div className="button-row"><button type="button" className="primary-button" disabled={busy} onClick={()=>void onReview(villa,"approved",reason,level)}>อนุมัติ Villa</button><button type="button" className="outline-button" disabled={busy} onClick={()=>void onReview(villa,"changes",reason,level)}>ขอเอกสารเพิ่มเติม / แก้ไข</button><button type="button" className="danger-button" disabled={busy} onClick={()=>void onReview(villa,"rejected",reason,level)}>ไม่อนุมัติ</button></div></div>
  </article>;
}

export default function AdminPendingVillas({go}:{go:(page:Page,item?:string)=>void}) {
  const [villas,setVillas]=useState<MerchantVilla[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const working=useRef(false);
  useEffect(()=>{
    let active=true,fetching=false;
    const load=async()=>{if(fetching||working.current)return;fetching=true;try{
      const state=await api<Store>("/state");if(active&&!working.current)setVillas(state.villas.filter(v=>v.status==="pending"));
    }catch(e){if(active){if(e instanceof ApiError&&e.status===401)go("admin-login");else setMessage(e instanceof Error?e.message:"โหลดรายการไม่สำเร็จ");}}
    finally{fetching=false;if(active)setLoading(false);}};
    void load();const timer=window.setInterval(()=>void load(),10000);return()=>{active=false;clearInterval(timer);};
  },[]);
  const review=async(villa:MerchantVilla,status:string,reason:string,level:string)=>{
    if(working.current)return;
    if(status!=="approved"&&!reason.trim()){setMessage("กรุณาระบุเหตุผลขอแก้ไขหรือไม่อนุมัติ");return;}
    working.current=true;setBusy(true);setMessage("");
    try{await currentAccount();await api(`/villas/${villa.id}/review`,{status,reason,verificationLevel:level,expectedReviewId:villa.reviewRequest?.id??null});
      setVillas(current=>current.filter(v=>v.id!==villa.id));setMessage(status==="approved"?`อนุมัติ ${villa.name} แล้ว`:`บันทึกผลตรวจสอบ ${villa.name} แล้ว`);
    }catch(e){setMessage(e instanceof Error?e.message:"บันทึกผลตรวจสอบไม่สำเร็จ");}
    finally{working.current=false;setBusy(false);}
  };
  return <PortalShell role="Admin" page="admin-pending-villas" go={go}><div className="portal-head"><div><h1>Villa รออนุมัติ</h1><p>ตรวจเหตุผล ข้อมูลก่อนและหลังแก้ไข และเอกสารประกอบก่อนอนุมัติ</p></div><button className="outline-button" onClick={()=>go("admin-approved-villas")}>ดู Villa ที่อนุมัติแล้ว</button></div>
    <section className="merchant-panel"><p>Basic Verify ไม่ต้องยืนยันเจ้าของบ้าน ส่วนแพ็กเกจ 1,990 ขึ้นไปตรวจหลักฐานเจ้าของบ้านในหน้านี้ เมื่อ Villa ผ่านอนุมัติและมีแพ็กเกจที่ใช้งานอยู่</p><div className="button-row"><button type="button" onClick={()=>document.getElementById("pending-villa-review")?.scrollIntoView({behavior:"smooth"})}>รายการ Villa รออนุมัติ</button><button type="button" onClick={()=>document.getElementById("owner-verification-review")?.scrollIntoView({behavior:"smooth"})}>ตรวจยืนยันเจ้าของบ้าน · 1,990 ขึ้นไป</button></div></section>
    <section id="pending-villa-review" aria-label="รายการ Villa รออนุมัติ">
    {message&&<p role="status" className="form-message">{message}</p>}
    <p role="status">{loading?"กำลังโหลดรายการ…":`รออนุมัติ ${villas.length} รายการ`}</p>
    {!loading&&!villas.length&&<section className="merchant-panel">ไม่มี Villa รออนุมัติ</section>}
    {villas.map(villa=><PendingVilla key={`${villa.id}:${villa.reviewRequest?.id||"legacy"}`} villa={villa} busy={busy} onReview={review}/>)}
    </section>
    <div id="owner-verification-review"><OwnerVerification admin/></div>
  </PortalShell>;
}
