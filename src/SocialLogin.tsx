import {useEffect,useState} from "react";
import {api,currentAccount} from "./api";
import {packageIntentKey} from "./packagePlans";
import AuthProviderIcon,{type AuthProvider} from "./AuthProviderIcon";
export default function SocialLogin({reference="",variant="default",accountType="user",linking=false}:{reference?:string;variant?:"default"|"stacked";accountType?:"user"|"merchant";linking?:boolean}) {
 const [providers,setProviders]=useState({google:false,facebook:false,line:false}),[oauthStatus,setOauthStatus]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{void api<{oauth:typeof providers;oauthStatus?:Record<string,string>}>("/config").then(v=>{setProviders(v.oauth);setOauthStatus(v.oauthStatus||{});}).catch(()=>setError("ตรวจช่องทางเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"));},[]);
 const returnTo=accountType==="merchant"?sessionStorage.getItem(packageIntentKey)?"#page=owner-information":"#page=owner-dashboard":reference?`#${new URLSearchParams({page:"verify",item:reference})}`:"#page=user-dashboard";
 const connect=async(provider:AuthProvider)=>{setBusy(true);setError("");try{if(linking){await currentAccount();const result=await api<{authorizeUrl:string}>(`/auth/oauth/${provider}/link`,{});window.location.href=result.authorizeUrl;}else window.location.href=`/api/auth/oauth/${provider}/start?${new URLSearchParams({returnTo})}`;}catch(e){setBusy(false);setError(e instanceof Error?e.message:"เชื่อมบัญชีไม่สำเร็จ");}};
 return <div className={`social-login ${variant==="stacked"?"login-social-stack":""}`}>
 {variant!=="stacked"&&<span>{linking?"เชื่อมบัญชีเข้าสู่ระบบ":`เข้าสู่ระบบ / สมัคร ${accountType==="merchant"?"Merchant":"User"} ด้วย`}</span>}
 <div>{(["facebook","google","line"] as const).map(provider=><button type="button" key={provider} disabled={busy||!providers[provider]} title={providers[provider]?undefined:provider==="facebook"&&oauthStatus.facebook==="pending_approval"?"Facebook ยังรออนุมัติจาก Meta":"ยังไม่ได้เปิดใช้งานบัญชีผู้ให้บริการ OAuth"} className={`oauth-button ${provider}`} onClick={()=>void connect(provider)}><span className="auth-provider-icon"><AuthProviderIcon provider={provider}/></span><span>{linking?"เชื่อมบัญชี ":variant==="stacked"?"ดำเนินการต่อด้วย ":""}{provider==="google"?"Google":provider==="facebook"?"Facebook":"LINE"}</span></button>)}</div>
 <p className="line-login-notice">VillaCheck ขอชื่อและอีเมลจากผู้ให้บริการเพื่อ{linking?"เชื่อมช่องทางเข้าสู่ระบบกับบัญชี Merchant นี้":`สร้างบัญชี ${accountType==="merchant"?"Merchant":"User"} และระบุบัญชีเมื่อเข้าสู่ระบบ`}</p>
 {error&&<p role="alert">{error}</p>}{(!providers.google||!providers.facebook||!providers.line)&&<small>ช่องทางที่ยังไม่ได้เชื่อมต่อจะแสดงเป็นปุ่มปิดใช้งาน</small>}
 </div>;
}
