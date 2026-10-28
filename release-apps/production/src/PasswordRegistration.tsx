import {RegistrationWriteFieldset} from './BusinessReadiness';
import {useState} from "react"
import {api,currentAccount} from "./api"
import {useCopy} from "./cms"
import type {Account} from "./merchantStore"
export default function PasswordRegistration({accountType,onRegistered}:{accountType:"user"|"merchant";onRegistered:(account:Account)=>void}) {
 const t=useCopy(),[form,setForm]=useState({name:"",businessNameEn:"",email:"",phone:"",password:""}),[challenge,setChallenge]=useState<{challengeId:string;expiresAt:string}|null>(null),[code,setCode]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false)
 return <RegistrationWriteFieldset><form className="form-stack" onSubmit={async event=>{
  event.preventDefault();if(busy)return;setBusy(true);setError("")
  try {
   if(!challenge){const value=await api<{challengeId:string;expiresAt:string}>(accountType==="merchant"?"/auth/register-phone":"/auth/register-user-phone",form);setChallenge(value);setForm(previous=>({...previous,password:""}));}
   else {await api("/auth/registration/verify",{challengeId:challenge.challengeId,code});onRegistered(await currentAccount());}
  }catch(error){setError(error instanceof Error?error.message:"สมัครไม่สำเร็จ")}finally{setBusy(false)}
 }}>
 {!challenge?<>
  <label><span>{accountType==="merchant"?t("registration.businessTh"):t("registration.name")}</span><input required maxLength={200} autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
  {accountType==="merchant"&&<label><span>{t("registration.businessEn")}</span><input required maxLength={200} value={form.businessNameEn} onChange={e=>setForm({...form,businessNameEn:e.target.value})}/></label>}
  <label><span>{t("registration.email")}</span><input required type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
  <label><span>{t("registration.password")}</span><input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
  <label><span>หมายเลขโทรศัพท์รับ OTP</span><input required type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><p>ยืนยันเบอร์โทรศัพท์ด้วย OTP ก่อนสร้างบัญชีและเริ่มใช้งาน การยืนยันเบอร์ไม่ได้ยืนยันความเป็นเจ้าของอีเมล</p>
 </>:<>
  <p role="status">ส่งรหัสยืนยันไปยัง {form.phone} แล้ว ใช้ได้ถึง {new Date(challenge.expiresAt).toLocaleTimeString("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit"})}</p>
  <label><span>รหัส OTP</span><input required aria-label="รหัส OTP ยืนยันการสมัคร" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/></label>
  <button type="button" disabled={busy} onClick={()=>{setChallenge(null);setCode("");setError("")}}>แก้ข้อมูล / ขอรหัสใหม่</button>
 </>}
 {error&&<p role="alert">{error}</p>}
 <button className="primary-button" type="submit" disabled={busy}>{busy?"กำลังดำเนินการ…":challenge?"ยืนยัน OTP และสร้างบัญชี":"รับ OTP เพื่อยืนยันการสมัคร"}</button>
 </form></RegistrationWriteFieldset>
}
