import {t as translateSystem} from "./locale"
import {t} from "./locale"
import {createContext,useContext,useEffect,useState} from "react";
import {api} from "./api";
const Readiness=createContext<boolean|null>(null);
const RegistrationReady=createContext(false);
export function BusinessReadinessProvider({children}:{children:React.ReactNode}) {
 const [enabled,setEnabled]=useState<boolean|null>(null),[registration,setRegistration]=useState(false);
 useEffect(()=>{let active=true;void api<{businessFeaturesEnabled?:boolean;phoneRegistrationEnabled?:boolean;otp?:{email:boolean}}>("/config").then(c=>{if(active){setEnabled(c.businessFeaturesEnabled!==false);setRegistration(c.phoneRegistrationEnabled===true)}}).catch(()=>{if(active)setEnabled(false)});return()=>{active=false}},[]);
 return <Readiness.Provider value={enabled}><RegistrationReady.Provider value={registration}>{children}</RegistrationReady.Provider></Readiness.Provider>;
}
export function useBusinessWritesEnabled(){return useContext(Readiness)===true;}
export function BusinessReadinessNotice(){const enabled=useContext(Readiness);return enabled===false?<p className="merchant-demo" role="status">{translateSystem("รอการตั้งค่าที่จำเป็น เปิดให้อ่านข้อมูลก่อน ยังไม่เปิดการบันทึกหรือทำรายการ")}</p>:null;}
export function BusinessWriteFieldset({children}:{children:React.ReactNode}) {const enabled=useContext(Readiness);return enabled===true?<>{children}</>:<fieldset disabled className="business-write-fieldset" style={{border:0,margin:0,padding:0,minWidth:0}} aria-label={enabled===null?translateSystem("กำลังตรวจสอบความพร้อม"):translateSystem("การบันทึกยังไม่เปิดใช้งาน")}>{enabled===false&&<p role="status">{translateSystem("รอการตั้งค่าที่จำเป็น ยังไม่เปิดการบันทึกหรือทำรายการ")}</p>}{children}</fieldset>}

export function RegistrationWriteFieldset({children}:{children:React.ReactNode}){const enabled=useContext(RegistrationReady);return enabled?<>{children}</>:<fieldset disabled className="business-write-fieldset" style={{border:0,margin:0,padding:0,minWidth:0}}><p role="status">{translateSystem("ยังไม่เปิดการยืนยันสมัครด้วย OTP กรุณาใช้บัญชีเดิมที่ได้รับสิทธิ์")}</p>{children}</fieldset>}
