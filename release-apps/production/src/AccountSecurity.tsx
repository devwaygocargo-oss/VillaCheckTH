import {useEffect,useState} from 'react'
import {api,currentAccount} from './api'
type Purpose='link-provider'|'password'|'logout-all'
export default function AccountSecurity({onSignedOut}:{onSignedOut:()=>void}){
 const [available,setAvailable]=useState(false),[currentPassword,setCurrent]=useState(''),[newPassword,setNew]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[linkedProviders,setLinkedProviders]=useState<string[]>([]),[verifiedPurpose,setVerifiedPurpose]=useState<Purpose|null>(null),[verificationAction,setVerificationAction]=useState<'password'|'logout-all'>('password')
 useEffect(()=>{let active=true;void api<{accountSecurityAvailable?:boolean;releaseMode?:string}>('/config').then(c=>{if(active)setAvailable(c.accountSecurityAvailable===true||!['PRELAUNCH','PHASE1','MEMBER_PREVIEW','STAGING_INTERACTIVE'].includes(c.releaseMode||''))}).catch(()=>{});void api<{providers:string[];providerVerificationPurpose:Purpose|null}>('/auth/oauth/status').then(s=>{if(active){setLinkedProviders(s.providers);setVerifiedPurpose(s.providerVerificationPurpose);if(s.providerVerificationPurpose==='password'||s.providerVerificationPurpose==='logout-all')setVerificationAction(s.providerVerificationPurpose)}}).catch(()=>{});return()=>{active=false}},[])
 if(!available)return null
 async function verify(provider:string){if(busy)return;setBusy(true);setError('');setCurrent('');try{await currentAccount();const result=await api<{authorizeUrl:string}>(`/auth/oauth/${provider}/reauth`,{purpose:verificationAction});window.location.href=result.authorizeUrl}catch(e){setError(e instanceof Error?e.message:'ยืนยันบัญชีเดิมไม่สำเร็จ');setBusy(false)}}
 async function submit(action:'password'|'logout-all'){
  if(busy)return
  setError('')
  if(action==='password'&&newPassword!==confirm){setError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');return}
  const providerAuthorized=verifiedPurpose===action
  if(!providerAuthorized&&!currentPassword){setError('กรุณายืนยันด้วยรหัสผ่าน หรือยืนยันบัญชีผู้ให้บริการเดิมสำหรับรายการนี้ก่อน');return}
  setBusy(true)
  try{await currentAccount();await api('/auth/'+action,{...(providerAuthorized?{}:{currentPassword}),...(action==='password'?{newPassword}:{})});setCurrent('');setNew('');setConfirm('');setVerifiedPurpose(null);onSignedOut()}
  catch(e){setError(e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ')}
  finally{setBusy(false)}
 }
 return <section className="merchant-panel" aria-label="ความปลอดภัยบัญชี"><h2>ความปลอดภัยบัญชี</h2><p>ยืนยันด้วยรหัสผ่านปัจจุบัน หรือบัญชีผู้ให้บริการที่เชื่อมไว้ เมื่อสำเร็จอุปกรณ์ทุกเครื่องจะต้องเข้าสู่ระบบใหม่</p>{linkedProviders.length>0&&<section aria-label="ยืนยันผู้ให้บริการเพื่อความปลอดภัยบัญชี"><p>ยังไม่เคยตั้งรหัสผ่าน? ยืนยันบัญชีเดิมก่อนตั้งรหัสผ่านหรือออกจากทุกอุปกรณ์ได้ โดยไม่ต้องกรอกรหัสผ่านที่ยังไม่เคยตั้ง</p><label>รายการที่ต้องการยืนยัน<select aria-label="รายการยืนยันบัญชี" value={verificationAction} onChange={e=>setVerificationAction(e.target.value as 'password'|'logout-all')}><option value="password">ตั้งหรือเปลี่ยนรหัสผ่าน</option><option value="logout-all">ออกจากทุกอุปกรณ์</option></select></label><div>{linkedProviders.filter(p=>p==='google'||p==='line').map(provider=><button type="button" key={provider} disabled={busy} onClick={()=>void verify(provider)}>ยืนยันบัญชี {provider==='google'?'Google':'LINE'} เพื่อ{verificationAction==='password'?'จัดการรหัสผ่าน':'ออกจากทุกอุปกรณ์'}</button>)}</div><small>การยืนยันใช้ได้ครั้งเดียวภายใน 5 นาที เฉพาะรายการที่เลือก</small></section>}{verifiedPurpose&&verifiedPurpose!=='link-provider'&&<p role="status">ยืนยันสำหรับ{verifiedPurpose==='password'?'ตั้งหรือเปลี่ยนรหัสผ่าน':'ออกจากทุกอุปกรณ์'}แล้ว</p>}{error&&<p role="alert">{error}</p>}<form className="portal-form" onSubmit={e=>{e.preventDefault();void submit('password')}}>
 {verifiedPurpose!=='password'&&<label>รหัสผ่านปัจจุบัน<input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={e=>setCurrent(e.target.value)}/></label>}
 <label>รหัสผ่านใหม่<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={newPassword} onChange={e=>setNew(e.target.value)}/></label>
 <label>ยืนยันรหัสผ่านใหม่<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
 <button className="primary-button" disabled={busy}>{verifiedPurpose==='password'?'ตั้งหรือเปลี่ยนรหัสผ่านและออกจากทุกอุปกรณ์':'เปลี่ยนรหัสผ่านและออกจากทุกอุปกรณ์'}</button><button type="button" className="outline-button" disabled={busy||(!currentPassword&&verifiedPurpose!=='logout-all')} onClick={()=>void submit('logout-all')}>ออกจากระบบทุกอุปกรณ์</button>
 </form></section>
}
