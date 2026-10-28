import {t as translateSystem} from "./locale"
import {t,localeTag} from "./locale"
import { useCms } from "./cms";
import { usePackages, billingLabel, billingValidityLabel, packageIntentKey } from "./packagePlans";
import { useEffect, useRef, useState } from "react";
import type { Store } from "./merchantStore";

export default function SubscriptionPanel({store,chosenPlan,setChosenPlan,busy,perform,onSubscribed}:{
 store:Store;chosenPlan:string;setChosenPlan:(id:string)=>void;busy:boolean;
 perform:(path:string,data:unknown,message:string)=>Promise<Store|null>;onSubscribed:()=>void;
}) {
 const {business}=useCms(),{plans,error}=usePackages(),initialized=useRef(false);
 const sub=store.subscription;
 const [couponCode,setCouponCode]=useState("");
 useEffect(()=>{
  if(!plans.length)return;
  if(!initialized.current){setChosenPlan(sub?.packageId||plans.find(p=>p.id===chosenPlan||p.name===chosenPlan)?.id||plans[0].id);initialized.current=true;}
  else if(!plans.some(p=>p.id===chosenPlan))setChosenPlan(sub?.packageId||plans[0].id);
 },[plans,sub?.packageId,chosenPlan,setChosenPlan]);
 const selected=plans.find(p=>p.id===chosenPlan),current=plans.find(p=>p.id===sub?.packageId);
 const unpaid=store.villas.some(v=>v.invoices.some(i=>i.scope==="merchant"&&i.status!=="paid"));
 const blocked=sub?.status==="SUSPENDED"||sub?.status==="CANCELLED";
 const approved=store.villas.find(v=>v.status==="approved"),renewalVilla=store.villas.find(v=>v.status==="approved"&&v.qr);
 const canReselect=Boolean(sub&&!sub.used&&!sub.payments&&!sub.expires&&!blocked&&!unpaid);
 const bankDownload=store.paymentBankQrImage.startsWith("/api/receiving-bank/qr/")?`${store.paymentBankQrImage}?download=1`:store.paymentBankQrImage;
 const same=selected?.id===sub?.packageId;
 const upgrade=Boolean(sub&&selected&&selected.amount>0&&selected.capacity>=(sub.capacity??Infinity)&&selected.sort_order>(current?.sort_order??Infinity));
 const expiredChange=Boolean(sub&&sub.status==="EXPIRED"&&selected&&selected.amount>0&&selected.capacity>=sub.used);
 const trialChange=Boolean(sub&&sub.amount===0&&sub.payments>0&&selected&&selected.amount>0&&selected.capacity>=sub.used);
 let reason="",action="";
 if(!selected)reason="กรุณาเลือกแพ็กเกจ";
 else if(blocked)reason="แพ็กเกจถูกระงับหรือยกเลิก กรุณาติดต่อ Admin";
 else if(unpaid)reason="มีใบแจ้งชำระค้าง กรุณาชำระหรือแนบสลิปในรายการด้านล่างก่อนเลือกซื้อแพ็กเกจใหม่";
 else if(!sub||canReselect)action="subscribe";
 else if(same&&selected.amount===0)reason="แพ็กเกจทดลองใช้ได้ครั้งเดียว กรุณาเลือกแพ็กเกจที่มีค่าใช้จ่ายสำหรับต่ออายุ";
 else if(same&&renewalVilla)action="renew";
 else if((trialChange||expiredChange)&&renewalVilla)action="renew";
 else if(upgrade&&approved)action="upgrade";
 else if(!approved)reason="กรุณาส่ง Villa และรอ Admin อนุมัติก่อนสร้างใบแจ้งชำระ";
 else if(selected.capacity<sub.used)reason=`แพ็กเกจนี้รองรับ ${selected.capacity} Villa แต่มีกำลังใช้อยู่ ${sub.used} Villa`;
 else reason="แพ็กเกจปัจจุบันยังใช้งานอยู่ เลือกต่ออายุแพ็กเกจเดิมหรืออัปเกรดได้ การเปลี่ยนเป็นระดับต่ำกว่าทำได้เมื่อแพ็กเกจหมดอายุและจำนวน Villa อยู่ในสิทธิ์";
 const confirm=async()=>{
  if(!selected||!action||busy)return;
  if(action==="subscribe"){
   if(await perform("/subscription",{packageId:selected.id,couponCode},"เลือกแพ็กเกจแล้ว กรุณาเพิ่ม Villa และส่งเอกสารให้ Admin ตรวจ")){sessionStorage.removeItem(packageIntentKey);onSubscribed();}
  }else if(action==="upgrade")await perform("/subscription/upgrade",{packageId:selected.id,couponCode},"สร้างใบแจ้งชำระแพ็กเกจที่เลือกแล้ว รอชำระและ Admin ยืนยันสลิป");
  else if(renewalVilla)await perform(`/villas/${renewalVilla.id}/renew`,{packageId:selected.id,couponCode},"สร้างใบแจ้งชำระสำหรับแพ็กเกจที่เลือกแล้ว");
 };
 if(store.freePeriod)return <section className="merchant-panel"><h2>{translateSystem("เร็ว ๆ นี้")}</h2><p>{translateSystem("ยังไม่เปิดให้เลือกแพ็กเกจ")}</p></section>;
 return <section className="merchant-panel subscription-panel">
  <h2>{translateSystem("เลือกแพ็กเกจ")}</h2>{error&&<p role="alert">{error}</p>}
  {sub&&<div className="subscription-current"><p><strong>{translateSystem("แพ็กเกจปัจจุบัน:")}{" "}{sub.name}</strong> {" "}{translateSystem("· ใช้สิทธิ์")}{" "}{sub.used}/{sub.capacity} Villa</p><p>{translateSystem("สถานะ")}{" "}{sub.status} {" "}{translateSystem("· ใช้งานถึง")}{" "}{sub.expires?new Date(sub.expires).toLocaleDateString(localeTag(),{timeZone:"Asia/Bangkok"}):translateSystem("รอเปิดสิทธิ์หลังอนุมัติและชำระเงิน")}</p></div>}
  <p>{translateSystem("เลือกแพ็กเกจเพื่อดูราคาและสิทธิ์ จากนั้นกดยืนยันด้านล่าง การเลือกอย่างเดียวยังไม่เปลี่ยนสิทธิ์หรือเรียกเก็บเงิน")}</p>
  <div className="subscription-options" role="group" aria-label={translateSystem("แพ็กเกจที่เลือกได้")}>{plans.map(p=><button type="button" key={p.id} className={chosenPlan===p.id?"active":""} aria-pressed={chosenPlan===p.id} disabled={busy} onClick={()=>setChosenPlan(p.id)}><strong>{p.name}</strong><span>{p.amount?translateSystem("฿{v0}/{v1}", {v0: (p.amount/100).toLocaleString("th-TH"), v1: billingLabel(p.billingCycle)}):translateSystem("ทดลองฟรี {v0} เดือน", {v0: p.trialMonths})}</span><small>{translateSystem("รองรับ")}{" "}{p.capacity} Villa</small>{p.id===sub?.packageId&&<small>{translateSystem("แพ็กเกจปัจจุบัน")}</small>}</button>)}</div>
  {selected&&<section className="subscription-selection" aria-label={translateSystem("รายละเอียดแพ็กเกจที่เลือก")}><h3>{translateSystem("แพ็กเกจที่เลือก:")}{" "}{selected.name}</h3><p>{selected.description}</p><p>{selected.amount?translateSystem("ราคา ฿{v0} ต่อ{v1}", {v0: (selected.amount/100).toLocaleString("th-TH"), v1: billingLabel(selected.billingCycle)}):translateSystem("ทดลองฟรี {v0} เดือน", {v0: selected.trialMonths})} · {selected.capacity} Villa</p>{selected.amount>0&&<p>{billingValidityLabel(selected.billingCycle,business)}</p>}{!!selected.features.length&&<ul>{selected.features.map((feature,index)=><li key={index}>{feature}</li>)}</ul>}</section>}
  <label>{translateSystem("รหัสคูปอง (ถ้ามี)")}<input maxLength={32} value={couponCode} onChange={e=>setCouponCode(e.target.value.toUpperCase())}/></label><p>{translateSystem("ตรวจช่วงเวลาและจำนวนสิทธิ์เมื่อสร้างใบแจ้งชำระ ส่วนลดใช้ครั้งเดียวต่อบัญชี ยอดสุดท้ายแสดงในใบแจ้งชำระก่อนโอน")}</p>{sub&&!unpaid&&<button disabled={busy} onClick={()=>void perform("/subscription/coupon",{couponCode},"บันทึกคูปองสำหรับรายการใหม่แล้ว")}>{translateSystem("บันทึกหรือล้างคูปองก่อนสร้างใบแจ้งชำระ")}</button>}
  {reason&&<p role="status">{reason}</p>}
  <button className="primary-button subscription-confirm" disabled={busy||!action} onClick={()=>void confirm()}>{busy?translateSystem("กำลังดำเนินการ…"):action==="subscribe"?translateSystem("ยืนยันแพ็กเกจและเพิ่ม Villa"):action==="upgrade"?translateSystem("ยืนยันแพ็กเกจและสร้างใบแจ้งชำระ"):action==="renew"?translateSystem("ยืนยันแพ็กเกจสำหรับต่ออายุ"):translateSystem("ยืนยันแพ็กเกจที่เลือก")}</button>
  <section className="bank-payment-details merchant-panel" aria-label={translateSystem("บัญชีและ QR สำหรับชำระเงิน")}><div className="button-row"><h3>{translateSystem("บัญชีและ QR สำหรับชำระเงินจาก Admin")}</h3><button className="outline-button" disabled={busy} onClick={()=>void perform("/state",undefined,"โหลดข้อมูลรับชำระจาก Admin ล่าสุดแล้ว")}>{translateSystem("โหลดข้อมูลบัญชีและ QR ล่าสุด")}</button></div><p className="payment-instructions">{store.paymentInstructions}</p>
   {!store.demoMode&&store.paymentConfigured&&<p><a href={`data:text/plain;charset=utf-8,${encodeURIComponent(`VillaCheck\n${store.paymentInstructions}`)}`} download="villacheck-payment-account.txt">{translateSystem("ดาวน์โหลดรายละเอียดบัญชีรับชำระ")}</a></p>}
   {!store.demoMode&&store.paymentBankQrImage?<><img src={store.paymentBankQrImage} alt={translateSystem("QR บัญชีรับชำระปัจจุบันจาก Admin")} width="240" height="240" style={{maxWidth:"100%",objectFit:"contain"}}/><div className="button-row"><a className="outline-button" href={store.paymentBankQrImage} target="_blank" rel="noopener noreferrer">{translateSystem("เปิด QR ขนาดเต็ม")}</a><a className="outline-button" href={bankDownload} download="villacheck-bank-qr.png">{translateSystem("ดาวน์โหลด QR รับชำระ (PNG)")}</a></div></>:<p>{store.demoMode?translateSystem("โหมด DEMO ไม่แสดง QR โอนเงินจริง ให้ใช้สลิป dummy เพื่อทดสอบการตรวจของ Admin"):translateSystem("Admin ยังไม่ได้ตั้งค่า QR รับเงิน กรุณาติดต่อทีมงานก่อนโอน")}</p>}
   <p>{translateSystem("ข้อมูลนี้เป็นบัญชีปัจจุบันสำหรับรายการใหม่ กรุณาชำระตามยอด บัญชี และ QR ในใบแจ้งชำระของคุณ หากใบเดิมระบุบัญชีอื่นให้ใช้บัญชีในใบเดิม")}</p>
  </section>
 </section>;
}
