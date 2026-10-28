import {t as translateSystem} from "./locale"
import {t,localeTag} from "./locale"
import {BusinessWriteFieldset} from './BusinessReadiness';
import AdminChangeApprovals from "./AdminChangeApprovals";
import { useEffect, useRef, useState } from "react";
import { api, currentAccount } from "./api";
import { PortalShell, type Page } from "./prototype";

type Fields={accountType:"savings"|"current"|"other";bankName:string;accountName:string;accountNumber:string;promptpayType:"phone"|"taxId";promptpayId:string;instructions:string};
type Bank=Fields&{revision:number;qrImage:string;generatedAt:string;updatedAt:string};
type Notification={id:string;recipient:string;merchantName:string;subject:string;status:string;created:string;sentAt:string|null;error:string;attempts:number;bankRevision:number;invoiceId?:string;amount?:number;packageName?:string};
type Snapshot={bank:Bank|null;merchants:{id:string;name:string;business_name:string;email:string;invoiceId:string;amount:number;packageName:string}[];notifications:Notification[];demoMode:boolean;smtpConfigured:boolean};
const blank:Fields={accountType:"savings",bankName:"",accountName:"",accountNumber:"",promptpayType:"phone",promptpayId:"",instructions:""};
const fields=(bank:Bank|null):Fields=>bank?{accountType:bank.accountType||"savings",bankName:bank.bankName,accountName:bank.accountName,accountNumber:bank.accountNumber,promptpayType:bank.promptpayType,promptpayId:bank.promptpayId,instructions:bank.instructions}:{...blank};
const label:Record<string,string>={demo:"DEMO · ไม่ส่งอีเมลจริง",queued:"รอส่ง",sending:"กำลังส่ง",sent:"ส่งแล้ว",failed:"ส่งไม่สำเร็จ",cancelled:"ยกเลิกส่ง · รายการไม่ได้รอชำระแล้ว"};
export default function AdminReceivingBank({go}:{go:(page:Page)=>void}) {
  const [data,setData]=useState<Snapshot|null>(null),[form,setForm]=useState<Fields>(blank),[revision,setRevision]=useState(0);
  const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [search,setSearch]=useState(""),[selected,setSelected]=useState<string[]>([]),[subject,setSubject]=useState("VillaCheck: บัญชีและ QR สำหรับชำระแพ็กเกจ"),[emailMessage,setEmailMessage]=useState("กรุณาชำระแพ็กเกจตามใบแจ้งชำระของคุณ และแนบสลิปในระบบเพื่อให้ Admin ตรวจสอบ");
  const working=useRef(false),request=useRef<{fingerprint:string;id:string}|null>(null);
  const replace=(next:Snapshot)=>{setData(next);setForm(fields(next.bank));setRevision(next.bank?.revision||0);setConfirmed(false);};
  useEffect(()=>{
    let active=true;
    void currentAccount().then(()=>api<Snapshot>("/admin/receiving-bank")).then(next=>{if(active)replace(next);}).catch(e=>{if(active)setError(e.message);});
    const timer=window.setInterval(()=>{if(!working.current)void api<Snapshot>("/admin/receiving-bank").then(next=>{if(active)setData(next);}).catch(()=>{});},10000);
    return()=>{active=false;clearInterval(timer);};
  },[]);
  const dirty=JSON.stringify(form)!==JSON.stringify(fields(data?.bank||null))||revision!==(data?.bank?.revision||0);
  const change=<K extends keyof Fields>(key:K,value:Fields[K])=>{setForm(current=>({...current,[key]:value}));if(key!=="instructions")setConfirmed(false);};
  const visible=(data?.merchants||[]).filter(m=>`${m.name} ${m.business_name} ${m.email}`.toLowerCase().includes(search.toLowerCase()));
  const act=async(work:()=>Promise<void>)=>{if(working.current)return;working.current=true;setBusy(true);setError("");setMessage("");try{await work();}catch(e){setError(e instanceof Error?e.message:translateSystem("ดำเนินการไม่สำเร็จ"));}finally{working.current=false;setBusy(false);}};
  return <PortalShell role="Admin" page="admin-receiving-bank" go={go}>
    <div className="portal-head"><div><h1>{translateSystem("บัญชีรับเงินจาก Merchant")}</h1><p>{translateSystem("จัดการบัญชีรับชำระ และส่ง QR ระบุยอดตามแพ็กเกจให้ Merchant ที่รอชำระ")}</p></div><button disabled={busy} className="outline-button" onClick={()=>void act(async()=>{replace(await api<Snapshot>("/admin/receiving-bank"));setMessage(translateSystem("โหลดข้อมูลล่าสุดแล้ว"));})}>{translateSystem("โหลดข้อมูลล่าสุด")}</button></div>
    {error&&<p className="form-message" role="alert">{error}</p>}{message&&<p className="form-message" role="status">{message}</p>}
    {!data?<p role="status">{translateSystem("กำลังโหลดข้อมูลบัญชีรับเงิน…")}</p>:<>
      <AdminChangeApprovals kind="bank"/>
      <div className="receiving-bank-grid">
        <BusinessWriteFieldset><form className="merchant-panel portal-form" onSubmit={e=>{e.preventDefault();void act(async()=>{await api("/admin/change-approvals",{kind:"bank",payload:{...form,revision,confirmedBinding:confirmed}});setMessage(translateSystem("เสนอข้อมูลบัญชีแล้ว รอ Admin ผู้มีสิทธิ์อนุมัติ ข้อมูลรับเงินเดิมยังใช้ตามปกติ"));});}}>
          <h2>{translateSystem("ข้อมูลบัญชีรับเงิน")}</h2><p>{translateSystem("เตรียมช่องสำหรับบัญชีบริษัท VillaCheck และพร้อมเพย์ไว้แล้ว ระหว่างรอเปิดบัญชีใหม่ให้ใช้ข้อมูล Dummy สำหรับทดสอบเท่านั้น เมื่อได้รับข้อมูลจริงให้เสนอแก้ไขและรอผู้อนุมัติก่อนใช้งาน")}</p><label>{translateSystem("ประเภทบัญชี")}<select value={form.accountType} disabled={busy} onChange={e=>change("accountType",e.target.value as Fields["accountType"])}><option value="savings">{translateSystem("ออมทรัพย์")}</option><option value="current">{translateSystem("กระแสรายวัน")}</option><option value="other">{translateSystem("อื่น ๆ")}</option></select></label>
          <label>{translateSystem("ธนาคาร")}<input required maxLength={200} disabled={busy} value={form.bankName} onChange={e=>change("bankName",e.target.value)}/></label>
          <label>{translateSystem("ชื่อบัญชี")}<input required maxLength={200} disabled={busy} value={form.accountName} onChange={e=>change("accountName",e.target.value)}/></label>
          <label>{translateSystem("เลขบัญชีธนาคาร")}<input required inputMode="numeric" maxLength={30} disabled={busy} value={form.accountNumber} onChange={e=>change("accountNumber",e.target.value)}/></label>
          <label>{translateSystem("ประเภทพร้อมเพย์")}<select disabled={busy} value={form.promptpayType} onChange={e=>change("promptpayType",e.target.value as Fields["promptpayType"])}><option value="phone">{translateSystem("เบอร์โทรศัพท์")}</option><option value="taxId">{translateSystem("เลขประจำตัวผู้เสียภาษี / เลขประจำตัวประชาชน")}</option></select></label>
          <label>{translateSystem("หมายเลขพร้อมเพย์")}<input required inputMode="numeric" maxLength={30} disabled={busy} value={form.promptpayId} onChange={e=>change("promptpayId",e.target.value)}/></label>
          <p>{translateSystem("ใช้พร้อมเพย์ที่ผูกกับบัญชีข้างต้น เลขบัญชีธนาคารอย่างเดียวไม่ใช้แทนหมายเลขพร้อมเพย์")}</p>
          <label>{translateSystem("คำแนะนำการชำระเงิน")}<textarea maxLength={2000} disabled={busy} value={form.instructions} onChange={e=>change("instructions",e.target.value)}/></label>
          <label className="receiving-bank-choice"><input type="checkbox" required disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{translateSystem("ยืนยันว่าหมายเลขพร้อมเพย์ผูกกับบัญชีรับเงินนี้แล้ว")}</label>
          {dirty&&<p role="status">{translateSystem("มีข้อมูลที่ยังไม่ได้บันทึก Merchant ยังใช้ข้อมูลที่บันทึกล่าสุด")}</p>}
          <button className="primary-button" disabled={busy||!confirmed}>{translateSystem("เสนอข้อมูลบัญชีเพื่ออนุมัติ")}</button>
        </form></BusinessWriteFieldset>
        <section className="merchant-panel receiving-bank-preview"><h2>{translateSystem("QR รับเงินที่บันทึกแล้ว")}</h2>{data.bank?<>
          <img width="256" height="256" src={data.bank.qrImage} alt={translateSystem("QR พร้อมเพย์รับเงินจาก Merchant")}/>
          <p><strong>{data.bank.bankName}</strong><br/>{data.bank.accountName}<br/>{translateSystem("เลขบัญชี")}{" "}{data.bank.accountNumber}<br/>{translateSystem("พร้อมเพย์")}{" "}{data.bank.promptpayId}</p>
          <a className="outline-button" href={`${data.bank.qrImage}?download=1`} download="villacheck-bank-qr.png">{translateSystem("ดาวน์โหลด QR รับเงิน (PNG)")}</a>
          <p><a href={data.bank.qrImage} target="_blank" rel="noopener noreferrer">{translateSystem("เปิด QR ขนาดเต็มเพื่อบันทึกภาพ")}</a></p>
          <p>{translateSystem("บนมือถือสามารถเปิดภาพขนาดเต็ม แล้วกดค้างที่ภาพเพื่อบันทึก QR ได้")}</p>
          <p>{translateSystem("QR คงที่ ไม่กำหนดยอดและไม่มีวันหมดอายุ ใช้ QR เดิมเมื่อบันทึกรายละเอียดซ้ำ หากเปลี่ยนหมายเลขพร้อมเพย์ QR จะเปลี่ยนตามผู้รับเงินใหม่")}</p>
          <p>{translateSystem("Merchant ต้องระบุยอดตามใบแจ้งชำระและส่งสลิปให้คนตรวจ การสแกน QR ไม่เปิดสิทธิ์อัตโนมัติ")}</p>
          <small>{translateSystem("บัญชีรุ่น")}{" "}{data.bank.revision} {" "}{translateSystem("· อัปเดต")}{" "}{new Date(data.bank.updatedAt).toLocaleString(localeTag())}</small>
        </>:<p>{translateSystem("ยังไม่มี QR กรุณากรอกข้อมูลและบันทึกบัญชีรับเงินก่อน")}</p>}</section>
      </div>
      <section className="merchant-panel portal-form"><h2>{translateSystem("ส่ง QR ชำระแพ็กเกจทางอีเมล")}</h2><p>{translateSystem("แสดงเฉพาะ Merchant ที่ซื้อแพ็กเกจและมีใบแจ้งชำระรอชำระ ไม่รวมทดลองฟรี รายการชำระแล้ว และรายการส่งสลิปรอตรวจ QR ในอีเมลระบุยอดจากใบแจ้งชำระโดยใช้บัญชีรับเงินที่ผูกกับรายการนั้น")}</p>
        <p>{data.demoMode?translateSystem("โหมด DEMO บันทึกในประวัติเท่านั้น ไม่ส่งอีเมลจริง"):data.smtpConfigured?translateSystem("พร้อมส่งผ่าน SMTP โดยแนบ QR เป็นไฟล์ PNG"):translateSystem("ยังไม่ได้ตั้งค่า SMTP จึงยังส่งอีเมลจริงไม่ได้")}</p>
        <label>{translateSystem("ค้นหา Merchant")}<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={translateSystem("ชื่อธุรกิจ ชื่อ หรืออีเมล")}/></label>
        <fieldset disabled={busy} className="receiving-bank-recipients"><legend>{translateSystem("เลือก Merchant ที่ต้องการส่ง (สูงสุด 50 ราย)")}</legend>{visible.map(m=><label className="receiving-bank-choice" key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,m.id]:ids.filter(id=>id!==m.id))}/><span>{m.business_name||m.name}<small>{m.name} · {m.email}</small><small>{m.packageName} {" "}{translateSystem("· ฿")}{(m.amount/100).toLocaleString(localeTag(),{minimumFractionDigits:2})}</small><small>{translateSystem("ใบแจ้งชำระ:")}{" "}{m.invoiceId}</small></span></label>)}{!visible.length&&<p>{translateSystem("ไม่พบ Merchant ที่มีรายการซื้อแพ็กเกจรอชำระและมีอีเมลรับข้อความได้")}</p>}</fieldset>
        <p>{translateSystem("เลือก")}{" "}{selected.length} {" "}{translateSystem("ราย · ส่งแยกฉบับ ไม่เปิดเผยอีเมลผู้รับรายอื่น")}</p>
        <p>{translateSystem("QR ระบุยอดตามแพ็กเกจในใบแจ้งชำระ บัญชีรับเงินยึดตามใบนั้น แม้ Admin จะเปลี่ยนบัญชีสำหรับรายการใหม่แล้วก็ตาม")}</p>
        <label>{translateSystem("หัวข้ออีเมล")}<input maxLength={200} disabled={busy} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
        <label>{translateSystem("ข้อความถึง Merchant")}<textarea maxLength={4000} disabled={busy} value={emailMessage} onChange={e=>setEmailMessage(e.target.value)}/></label>
        {dirty&&<p>{translateSystem("กรุณาบันทึกหรือโหลดข้อมูลล่าสุดก่อนส่งอีเมล")}</p>}
        <button className="primary-button" disabled={busy||!data.bank||dirty||!selected.length||selected.length>50||!subject.trim()||(!data.demoMode&&!data.smtpConfigured)} onClick={()=>void act(async()=>{
          const payload={revision:data.bank!.revision,merchantIds:selected,invoiceIds:data.merchants.filter(m=>selected.includes(m.id)).map(m=>m.invoiceId),subject,message:emailMessage},fingerprint=JSON.stringify(payload);
          if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,id:crypto.randomUUID()};
          const next=await api<Snapshot>("/admin/receiving-bank/email",{...payload,requestId:request.current!.id});setData(next);request.current=null;setSelected([]);setMessage(next.demoMode?translateSystem("บันทึกอีเมล DEMO แล้ว ไม่มีการส่งอีเมลจริง"):translateSystem("เพิ่มอีเมลเข้าคิวแล้ว ตรวจผลส่งได้ในประวัติด้านล่าง"));
        })}>{translateSystem("ส่ง QR ตามยอดแพ็กเกจให้ Merchant ที่เลือก")}</button>
      </section>
      <section className="merchant-panel"><h2>{translateSystem("ประวัติการส่งรายละเอียดรับเงิน")}</h2>{!data.notifications.length&&<p>{translateSystem("ยังไม่มีประวัติการส่ง")}</p>}{data.notifications.map(mail=><article className="receiving-bank-mail" key={mail.id}><h3>{mail.merchantName}</h3><p>{mail.recipient} · {mail.subject}</p>{mail.invoiceId&&<p>{mail.packageName} {" "}{translateSystem("· ฿")}{((mail.amount||0)/100).toLocaleString(localeTag(),{minimumFractionDigits:2})} {" "}{translateSystem("· ใบแจ้งชำระ")}{" "}{mail.invoiceId}</p>}<p>{translateSystem(label[mail.status]||mail.status)} {" "}{translateSystem("· บัญชีรุ่น")}{" "}{mail.bankRevision} · {new Date(mail.created).toLocaleString(localeTag())}</p>{mail.error&&<p role="status">{mail.error}</p>}{mail.status==="failed"&&<button disabled={busy||!data.smtpConfigured} onClick={()=>void act(async()=>{setData(await api<Snapshot>(`/admin/receiving-bank/notifications/${mail.id}/retry`,{}));setMessage(translateSystem("เพิ่มอีเมลกลับเข้าคิวแล้ว"));})}>{translateSystem("ส่งอีเมลซ้ำ")}</button>}</article>)}</section>
    </>}
  </PortalShell>;
}
