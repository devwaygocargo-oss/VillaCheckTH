import {t as translateSystem} from "./locale"
import {t} from "./locale"
import {useEffect,useState} from 'react'
import {api} from './api'

export default function PasswordRecovery(){
 const [available,setAvailable]=useState(false),[open,setOpen]=useState(false),[email,setEmail]=useState(''),[challenge,setChallenge]=useState(''),[code,setCode]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
 useEffect(()=>{let active=true;void api<{passwordRecoveryAvailable?:boolean;releaseMode?:string}>('/config').then(c=>{if(active)setAvailable(c.passwordRecoveryAvailable===true||!['PRELAUNCH','PHASE1','MEMBER_PREVIEW','STAGING_INTERACTIVE'].includes(c.releaseMode||''))}).catch(()=>{});return()=>{active=false}},[])
 if(!available)return null
 return <section aria-label={translateSystem("กู้คืนบัญชี")}><button type="button" className="login-merchant" aria-expanded={open} onClick={()=>setOpen(!open)}>{translateSystem("ลืมรหัสผ่าน / เข้าใช้เบอร์เดิมไม่ได้")}</button>{open&&<form className="portal-form" onSubmit={async e=>{
  e.preventDefault();if(busy)return;setError('');setBusy(true)
  try{
   if(!challenge){const result=await api<{challengeId:string;message:string}>('/auth/recovery/request',{email});setChallenge(result.challengeId);setMessage(result.message)}
   else{if(password!==confirm)throw Error('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');await api('/auth/recovery/verify',{challengeId:challenge,code,newPassword:password});setChallenge('');setCode('');setPassword('');setConfirm('');setMessage(translateSystem("เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่ อุปกรณ์เดิมทุกเครื่องถูกออกจากระบบ"))}
  }catch(err){setError(err instanceof Error?err.message:translateSystem("กู้คืนบัญชีไม่สำเร็จ"))}
  finally{setBusy(false)}
 }}><p>{translateSystem("สำหรับ User และ Merchant ที่ยังเข้าถึงอีเมลบัญชีได้ การกู้คืน Admin ต้องผ่านขั้นตอนผู้ดูแล ไม่สามารถเปลี่ยนอีเมลหรือปลดระงับบัญชีด้วยวิธีนี้")}</p>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 {!challenge?<label>{translateSystem("อีเมลบัญชี")}<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>:<><label>{translateSystem("รหัสยืนยันจากอีเมล")}<input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></label><label>{translateSystem("รหัสผ่านใหม่")}<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>{translateSystem("ยืนยันรหัสผ่านใหม่")}<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label></>}
 <button className="primary-button" disabled={busy}>{busy?translateSystem("กำลังดำเนินการ…"):challenge?translateSystem("ยืนยันและตั้งรหัสผ่านใหม่"):translateSystem("ขอรหัสกู้คืนทางอีเมล")}</button>{challenge&&<button type="button" disabled={busy} onClick={()=>{setChallenge('');setCode('');setPassword('');setConfirm('');setMessage('')}}>{translateSystem("เริ่มคำขอใหม่")}</button>}
 </form>}</section>
}
