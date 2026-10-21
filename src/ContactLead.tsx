import {useCopy} from "./cms";
import { useState } from "react";
import { api } from "./api";
export default function ContactLead() {
 const t=useCopy();
 const [form,setForm]=useState({name:"",email:"",phone:"",type:"USER"}),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 return <form className="portal-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api("/leads",form);setMessage("บันทึกข้อมูลให้ทีมงานติดต่อกลับแล้ว");}catch(e){setMessage(e instanceof Error?e.message:"ส่งไม่สำเร็จ");}finally{setBusy(false);}}}><h2>{t("contact.title")}</h2><label>{t("contact.type")}<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="USER">{t("contact.user")}</option><option value="MERCHANT">{t("contact.merchant")}</option></select></label>{(["name","email","phone"] as const).map(k=><label key={k}>{({name:t("contact.name"),email:t("contact.email"),phone:t("contact.phone")})[k]}<input required={k!=="phone"} type={k==="email"?"email":"text"} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<button disabled={busy} className="primary-button">{t("contact.submit")}</button>{message&&<p role="status">{message}</p>}</form>;
}
