import { useEffect,useState } from "react";
import { api,currentAccount } from "./api";
import { PortalShell,type Page } from "./prototype";
import OtpLogin from "./OtpLogin";
import SocialLogin from "./SocialLogin";
import {oauthErrors} from "./authMessages";
type Profile={businessName:string;contactName:string;phone:string;address:string;email:string;loginPhone?:string};
export default function MerchantProfile({page,go}:{page:Page;go:(page:Page)=>void}) {
 const oauthError=new URLSearchParams(window.location.hash.slice(1)).get('oauth_error');
 const [form,setForm]=useState<Profile>({businessName:"",contactName:"",phone:"",address:"",email:""}),[error,setError]=useState(oauthError?oauthErrors[oauthError]||"เชื่อมบัญชีไม่สำเร็จ":""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{void currentAccount().then(()=>api<Profile>("/merchant/profile")).then(setForm).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 const emailPending=form.email.endsWith('@phone.villacheck.invalid');
 return <PortalShell role="Merchant" page={page} go={go}><h1>ข้อมูล Merchant</h1><form className="portal-form merchant-panel" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api("/merchant/profile",form);go("owner-add-villa");}catch(e){setError(e instanceof Error?e.message:"บันทึกไม่สำเร็จ");}finally{setBusy(false);}}}>{(["businessName","contactName","phone","address"] as const).map(k=><label key={k}>{({businessName:"ชื่อธุรกิจ",contactName:"ชื่อผู้ติดต่อ",phone:"เบอร์โทร",address:"ที่อยู่"})[k]}<input required value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<p>อีเมลบัญชี: {emailPending?'ยังไม่ได้ยืนยันอีเมล':form.email}</p>{emailPending&&<p role="status">กรุณายืนยันอีเมลในส่วนช่องทางเข้าสู่ระบบด้านล่าง ก่อนบันทึกข้อมูล Merchant</p>}{error&&<p role="alert">{error}</p>}<button disabled={busy||loading||emailPending} className="primary-button">บันทึกและเพิ่ม Villa</button></form>
 <section className="merchant-panel merchant-auth-settings"><h2>ช่องทางเข้าสู่ระบบ Merchant</h2><p>เบอร์เข้าสู่ระบบที่ยืนยันแล้ว: {form.loginPhone||'ยังไม่ได้เชื่อม'}</p><p>ยืนยันเพื่อเพิ่มหรือเปลี่ยนเบอร์เข้าสู่ระบบ หรือเปลี่ยนอีเมลบัญชี เบอร์นี้แยกจากเบอร์ติดต่อธุรกิจด้านบน</p><OtpLogin accountType="merchant" purpose="link_identity" onAuthenticated={()=>{void api<Profile>('/merchant/profile').then(profile=>{setForm(previous=>({...previous,email:profile.email,loginPhone:profile.loginPhone}));setMessage('ยืนยันช่องทางเข้าสู่ระบบแล้ว');}).catch(e=>setError(e.message));}}/>{message&&<p role="status">{message}</p>}<SocialLogin variant="stacked" accountType="merchant" linking/></section></PortalShell>;
}
