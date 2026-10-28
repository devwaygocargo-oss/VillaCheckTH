import {t as translateSystem} from "./locale"
import {useEffect,useState} from 'react'
import {api,currentAccount} from './api'
import {t,useLocale} from './locale'
import type {Account} from './merchantStore'
type Channel='sms'|'email'
export default function OtpLogin({onAuthenticated,accountType='user',purpose='login',initialChannel='sms',showChannelTabs=true}:{onAuthenticated:(account:Account)=>void;accountType?:'user'|'merchant';purpose?:'login'|'register'|'link_identity';initialChannel?:Channel;showChannelTabs?:boolean}){
 useLocale()
 const[scoped,setScoped]=useState(false),[channel,setChannel]=useState<Channel>(initialChannel),[destination,setDestination]=useState(''),[code,setCode]=useState(''),[challenge,setChallenge]=useState(''),[expires,setExpires]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now()),[ready,setReady]=useState(false),[channels,setChannels]=useState({email:false,sms:false})
 useEffect(()=>{let active=true;void api<{otp?:typeof channels;scopedPhoneRegistration?:boolean}>('/config').then(v=>{if(active){setChannels(v.otp||{email:false,sms:false});setScoped(v.scopedPhoneRegistration===true)}}).catch(()=>{if(active)setError(translateSystem('ตรวจช่องทาง OTP ไม่สำเร็จ กรุณาลองใหม่'))}).finally(()=>{if(active)setReady(true)});return()=>{active=false}},[])
 useEffect(()=>{const tick=()=>setNow(Date.now());const timer=window.setInterval(tick,1000);return()=>clearInterval(timer)},[])
 const seconds=Math.max(0,Math.ceil((retryAt-now)/1000)),remaining=expires?Math.max(0,Math.ceil((Date.parse(expires)-now)/1000)):0
 const reset=()=>{setChallenge('');setCode('');setExpires('');setError('')}
 const choose=(next:Channel)=>{if(busy)return;setChannel(next);setDestination('');reset()}
 const request=async()=>{if(busy||seconds>0)return;if(!channels[channel]){setError(t('otp.unavailable.'+channel));return}if(channel==='sms'&&!/^(?:0[689]\d{8}|\+66[689]\d{8})$/.test(destination.replace(/[ ()-]/g,''))){setError(t('otp.invalidPhone'));return}setBusy(true);setError('');try{if(purpose==='link_identity')await currentAccount();const result=await api<{challengeId:string;expiresAt:string;resendAfter:number}>('/auth/otp/request',{channel,destination,accountType,purpose});setChallenge(result.challengeId);setExpires(result.expiresAt);setCode('');setRetryAt(Date.now()+result.resendAfter*1000);setNow(Date.now())}catch(e){setError(e instanceof Error?e.message:t('otp.requestFailed'))}finally{setBusy(false)}}
 const verify=async()=>{if(busy||!challenge||remaining===0)return;setBusy(true);setError('');try{if(purpose==='link_identity')await currentAccount();await api('/auth/otp/verify',{challengeId:challenge,code});onAuthenticated(await currentAccount());if(purpose==='link_identity'){reset();setDestination('')}}catch(e){setError(e instanceof Error?e.message:t('otp.verifyFailed'))}finally{setBusy(false)}}
 if(scoped&&purpose==='register')return null
 return <div className="login-otp">{showChannelTabs&&<div className="login-channel-tabs" role="group" aria-label={t('otp.method')}>{(['sms','email'] as const).map(c=><button key={c} type="button" aria-pressed={channel===c} disabled={busy} onClick={()=>choose(c)}>{t(c==='sms'?'เบอร์โทรศัพท์ OTP':'อีเมล OTP')}</button>)}</div>}<form className="login-email-form" onSubmit={e=>{e.preventDefault();void(challenge?verify():request())}}>
 <label className="login-field"><span>{t(channel==='sms'?'TH +66':'อีเมล')}</span><input aria-label={t(channel==='sms'?'เบอร์โทรศัพท์':'อีเมลรับ OTP')} required type={channel==='sms'?'tel':'email'} autoComplete={channel==='sms'?'tel':'email'} readOnly={Boolean(challenge)} value={destination} onChange={e=>setDestination(e.target.value)} placeholder={t(channel==='sms'?'หมายเลขโทรศัพท์':'อีเมลของคุณ')}/></label>
 {purpose==='login'&&<p className="login-otp-note">{t('otp.loginPolicy')}</p>}
 {challenge&&<><p className="login-otp-note" role="status">{t('otp.sent',{destination})} · {remaining?t('otp.expiry',{seconds:remaining}):t('otp.expired')}</p><label className="login-field"><span>{translateSystem('รหัส OTP')}</span><input aria-label={translateSystem('รหัส OTP')} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} onPaste={e=>{e.preventDefault();setCode(e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6))}} placeholder={t('otp.code')} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label></>}
 {error&&<p className="login-error" role="alert">{error}</p>}{ready&&!channels[channel]&&<p className="login-otp-note" role="status">{t('otp.unavailable.'+channel)}</p>}
 {!ready&&<p role="status">{t('otp.loading')}</p>}
 <button className="login-submit" disabled={busy||!ready||(!challenge&&!channels[channel])||Boolean(challenge&&remaining===0)}>{busy?translateSystem('กำลังดำเนินการ…'):challenge?t(purpose==='link_identity'?'otp.link':purpose==='register'?'otp.register':'otp.verify'):t('otp.request')}</button>
 {challenge&&<div className="login-otp-actions"><button type="button" disabled={busy||seconds>0||!channels[channel]} onClick={()=>void request()}>{seconds?t('otp.resend',{seconds}):translateSystem('ส่ง OTP ใหม่')}</button><button type="button" disabled={busy} onClick={reset}>{t(channel==='sms'?'otp.changePhone':'otp.changeEmail')}</button></div>}
 </form></div>
}
