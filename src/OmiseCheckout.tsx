import {useEffect,useRef,useState} from "react"
import {api,currentAccount,ApiError} from "./api"
import type {Invoice} from "./merchantStore"

type CheckoutConfig={mode:"TEST";enabled:boolean;statusAvailable?:boolean;publicKey:string|null;methods:string[];invoiceId:string;amount:number;currency:string;paid:boolean}
type Payment={status:string;authorizeUri?:string|null;qrImage?:string|null;approvalRequired?:boolean;expiresAt?:string|null}
type OmiseSdk={setPublicKey:(key:string)=>void;createSource:(method:string,data:{amount:number;currency:string;platform_type?:string},callback:(status:number,value:{id?:string;livemode?:boolean})=>void)=>void}
declare global {interface Window {Omise?:OmiseSdk}}
let sdkLoading:Promise<OmiseSdk>|null=null
async function loadOmise():Promise<OmiseSdk>{
 if(window.Omise)return window.Omise
 if(!sdkLoading)sdkLoading=new Promise<OmiseSdk>((resolve,reject)=>{
  const script=document.createElement("script");script.src="https://cdn.omise.co/omise.js";script.async=true
  const timer=setTimeout(()=>{script.remove();reject(Error("โหลด Omise ไม่สำเร็จ กรุณาลองใหม่"))},15000)
  script.onload=()=>{clearTimeout(timer);if(window.Omise)resolve(window.Omise);else reject(Error("Omise ยังไม่พร้อม"))}
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error("โหลด Omise ไม่สำเร็จ กรุณาตรวจเครือข่าย"))};document.head.appendChild(script)
 }).catch(error=>{sdkLoading=null;throw error})
 return sdkLoading
}
const labels:Record<string,string>={pending:"รอชำระ",successful:"รับชำระแล้ว รอ Admin อนุมัติ Villa",failed:"ชำระไม่สำเร็จ",expired:"รายการหมดอายุ",reversed:"กลับรายการ รอทีมกระทบยอด",UNKNOWN:"รอตรวจสอบรายการ ห้ามสร้างซ้ำ",CREATING:"กำลังสร้างรายการ กรุณาตรวจสถานะ",NO_PAYMENT_REQUIRED:"ยอดสุทธิ 0 บาท ไม่ต้องชำระ",SOURCE_REJECTED:"ข้อมูลวิธีชำระไม่ผ่านการตรวจ กรุณาติดต่อผู้ดูแล"}
function safeProviderUrl(value:string|undefined|null,kind:"authorize"|"qr"){
 if(!value)return null
 try{const url=new URL(value);const path=kind==="authorize"?/^\/payments\/paym_test_[a-z0-9]+\/authorize$/:/^\/charges\/chrg_test_[a-z0-9]+\/documents\/docu_test_[a-z0-9]+\/downloads\/[A-Za-z0-9]+$/
 return url.protocol==="https:"&&url.hostname==="api.omise.co"&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash&&path.test(url.pathname)?url.href:null}catch{return null}
}
export default function OmiseCheckout({invoice,admin=false}:{invoice:Invoice;admin?:boolean}){
 const [config,setConfig]=useState<CheckoutConfig|null>(null),[payment,setPayment]=useState<Payment|null>(null),[method,setMethod]=useState(""),[busy,setBusy]=useState(true),[error,setError]=useState("")
 const inFlight=useRef(false),epoch=useRef(0)
 const refresh=async()=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError("");const current=++epoch.current
  try{await currentAccount();const settings=await api<CheckoutConfig>(`/payments/${invoice.id}/checkout`);let result:Payment|null=null
   if(current===epoch.current)setConfig(settings)
   try{if(settings.enabled||settings.statusAvailable)result=await api<Payment>(`/payments/${invoice.id}/omise`)}catch(e){if(!(e instanceof ApiError&&e.status===404))throw e}
   if(current===epoch.current){setConfig(settings);setMethod(old=>settings.methods.includes(old)?old:settings.methods[0]||"");setPayment(result)}
  }catch(e){if(current===epoch.current){setError(e instanceof Error?e.message:"อ่านสถานะไม่สำเร็จ");setPayment({status:"UNKNOWN"})}}finally{if(current===epoch.current){setBusy(false);inFlight.current=false}}
 }
 useEffect(()=>{void refresh();return()=>{epoch.current++;inFlight.current=false}},[invoice.id])
 const start=async()=>{
  if(inFlight.current||!config?.enabled||!config.publicKey||payment||config.paid||config.amount<=0||admin)return
  inFlight.current=true;setBusy(true);setError("")
  try{
   if(!/^pkey_test_[A-Za-z0-9]+$/.test(config.publicKey))throw Error("รองรับเฉพาะ Omise Test key")
   const sdk=await loadOmise();sdk.setPublicKey(config.publicKey)
   const source=await new Promise<string>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error("สร้างวิธีชำระไม่สำเร็จ กรุณาตรวจสถานะก่อนลองใหม่")),15000)
    sdk.createSource(method,{amount:config.amount,currency:config.currency,...(method==="mobile_banking_scb"?{platform_type:"WEB"}:{})},(status,value)=>{clearTimeout(timer);if(status===200&&value.livemode===false&&/^src_test_[a-z0-9]+$/.test(value.id||""))resolve(value.id!);else reject(Error("สร้าง Omise Test source ไม่สำเร็จ"))})
   })
   // No client return/status fields are trusted; the backend binds invoice amount and return URI.
   const result=await api<Payment>(`/payments/${invoice.id}/omise`,{source});setPayment(result)
  }catch(e){setError(e instanceof Error?e.message:"เริ่มชำระไม่สำเร็จ");setPayment({status:"UNKNOWN"})}finally{inFlight.current=false;setBusy(false)}
 }
 const authorization=safeProviderUrl(payment?.authorizeUri,"authorize"),qr=safeProviderUrl(payment?.qrImage,"qr")
 return <section className="payment-panel" data-testid="omise-checkout"><h2>Omise Test Checkout</h2><strong>ใบแจ้งชำระ ฿{((config?.amount ?? invoice.amount*100)/100).toLocaleString("th-TH")} · {invoice.packageName}</strong><p>สำหรับทดสอบเท่านั้น ห้ามโอนเงินจริงหรือใช้แอปธนาคารจริงชำระ QR ทดสอบ</p>
 {busy&&<p role="status">กำลังตรวจสอบรายการ…</p>}{error&&<p role="alert">{error}</p>}
 <p data-testid="omise-status">สถานะ: {payment?labels[payment.status]||"รอตรวจสอบรายการ":config?.paid?"บันทึกชำระแล้ว กรุณาตรวจสถานะล่าสุด":"ยังไม่ได้เริ่มรายการ"}</p>
 {!busy&&config&&!config.enabled&&<p>ยังไม่เปิด Omise Test checkout กรุณาให้ผู้ดูแลตั้งค่า Test keys และวิธีชำระ</p>}
 {config?.amount===0&&<p>ยอดสุทธิ 0 บาท ไม่ต้องสร้างรายการชำระ</p>}
 {!admin&&config?.enabled&&config.amount>0&&!config.paid&&!payment&&<><label>วิธีชำระทดสอบ<select aria-label="วิธีชำระ Omise Test" disabled={busy} value={method} onChange={e=>setMethod(e.target.value)}>{config.methods.map(m=><option key={m} value={m}>{m==="promptpay"?"PromptPay Test QR":"SCB Mobile Banking Test"}</option>)}</select></label><button className="primary-button" type="button" disabled={busy||!method} onClick={()=>void start()}>เริ่มชำระทดสอบ</button></>}
 {authorization&&<p><a className="outline-button" data-testid="omise-redirect" href={authorization} rel="noreferrer">ไปหน้ายืนยัน Omise Test</a></p>}
 {qr&&<img src={qr} alt="QR จาก Omise Test เท่านั้น" width={256} height={256} referrerPolicy="no-referrer"/>}
 {payment?.expiresAt&&<p>หมดอายุ: {new Date(payment.expiresAt).toLocaleString("th-TH")}</p>}
 <button className="outline-button" type="button" disabled={busy} onClick={()=>void refresh()}>ตรวจสถานะล่าสุด</button><p>การกลับจากหน้าผู้ให้บริการไม่ยืนยันการชำระ ระบบตรวจสถานะจาก server และยังต้องให้ Admin อนุมัติ Villa แยกอีกขั้น</p>
 </section>
}
