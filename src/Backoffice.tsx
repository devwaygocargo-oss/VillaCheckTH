import {t as translateSystem} from "./locale"
import {localeTag} from "./locale"
import PackageComingSoon from './PackageComingSoon'
import DocumentManagement from './DocumentManagement'
import {t,formatDate,useLocale} from './locale'
import {onPublicVillaRefresh} from './publicVillaRefresh'
import StatusCornerRibbon from "./StatusCornerRibbon"
import DemoPhoto from "./DemoPhoto"
import {BusinessWriteFieldset} from './BusinessReadiness';
import OwnershipDocuments from "./OwnershipDocuments";
import { villaStatusBadge } from "./villaStatus";
import OmiseCheckout from "./OmiseCheckout"
import {lastAdminPage} from "./navigation";
import PropertyDetails,{type Details} from "./PropertyDetails";
import {useCopy} from "./cms";
import OwnerVerification from "./OwnerVerification";
import HomeLogoLink from "./HomeLogoLink";
import PropertyMedia from "./PropertyMedia";
import SocialMaterials from "./SocialMaterials";
import Advertising from "./Advertising";
import Reviews from "./Reviews";
import PaymentQr from "./PaymentQr";
import VillaPackagePanel from "./VillaPackagePanel";
import { useEffect, useRef, useState } from "react"
import { PortalShell, type Page } from "./prototype"
import type { Document, MerchantVilla, Store, Invoice } from "./merchantStore"
import { api, currentAccount, ApiError } from "./api"

const date=(value:string)=>value?formatDate(value,{day:'numeric',month:'short',year:'numeric'}):translateSystem('ยังไม่เปิดใช้งาน')
function status(v: MerchantVilla) {
  if (v.qrStatus === "EXPIRED") return "QR หมดอายุ"
  if (v.status === "pending") return villaStatusBadge(v).label
  if (v.status === "changes") return villaStatusBadge(v).label
  if (v.status === "rejected") return villaStatusBadge(v).label
  if (["SUSPENDED","INACTIVE"].includes(v.qrStatus))return "QR ถูกระงับหรือปิดใช้งาน"
  if (!v.qr) return "อนุมัติแล้ว · QR ยังไม่เปิดใช้งาน"
  return v.trialUnlimited ? "QR ใช้งานได้ · Basic Verify · สิทธิ์โปรโมชั่น" : new Date(v.expires) <= new Date() ? "QR หมดอายุ" : "QR ใช้งานได้"
}
const approvalStatus = (value: MerchantVilla["status"]) => t(({pending:"รออนุมัติ",approved:"อนุมัติแล้ว",changes:"รอการแก้ไข",rejected:"ไม่อนุมัติ"})[value]);
export function VillaQr({ villa, admin = false }: { villa: Pick<MerchantVilla,"name"|"qr"|"qrStatus"|"verificationLevel"|"trialUnlimited"|"expires">; admin?: boolean }) {
  const url = `${window.location.origin}/#page=verify&item=${encodeURIComponent(villa.qr)}`
  const qrRef = useRef<HTMLDivElement>(null)
  const [downloadUrl, setDownloadUrl] = useState("")
  useEffect(() => {
    let cancelled = false
    let objectUrl = ""
    setDownloadUrl("")
    void import("@zxing/browser").then(({ BrowserQRCodeSvgWriter }) => {
      if (cancelled || !qrRef.current) return
      const svg = new BrowserQRCodeSvgWriter().write(url, 220, 220)
      svg.setAttribute("role", "img")
      svg.setAttribute("aria-label", `QR ของ ${villa.name}`)
      qrRef.current.replaceChildren(svg)
      objectUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }))
      setDownloadUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, villa.name])
  return (
    <div className="merchant-qr">
      <div ref={qrRef} />
      <strong>{villa.qr}</strong><p>{villa.qrStatus} · {villa.verificationLevel}</p>
      <small>{villa.expires ? translateSystem("หมดอายุ {v0}", {v0: date(villa.expires)}) : villa.trialUnlimited ? translateSystem("Basic Verify · สิทธิ์โปรโมชั่นเดิมยังคงอยู่") : translateSystem("ยังไม่ได้เปิดสิทธิ์")}</small>
      <a href={admin?`/admin#${new URLSearchParams({page:"admin-verify",item:villa.qr})}`:url}>{translateSystem("เปิดหน้าตรวจสอบ ↗")}</a>
      {downloadUrl && <a className="outline-button" href={downloadUrl} download={`VillaCheck-${villa.qr}.svg`}>{translateSystem("ดาวน์โหลด QR (SVG)")}</a>}
    </div>
  )
}

function VillaPhotoInput({url,photo,onChange}:{url:string;photo:Document|null;onChange:(value:Document|null)=>void}){
 const [error,setError]=useState("");
 const inputRef=useRef<HTMLInputElement>(null);
 return <div><label>{translateSystem("อัปโหลด / เปลี่ยนรูป Villa (JPG, PNG ไม่เกิน 2 MB)")}<input ref={inputRef} style={{display:"none"}} type="file" accept="image/jpeg,image/png" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;setError("");if(!["image/jpeg","image/png"].includes(f.type)||f.size>2*1024*1024){setError(translateSystem("เลือกรูป JPG หรือ PNG ไม่เกิน 2 MB"));return;}try{const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(f)});onChange({name:f.name,type:f.type,data});}catch{setError(translateSystem("อ่านรูปไม่สำเร็จ"))}}}/></label><div className="button-row"><button type="button" className="outline-button" onClick={()=>inputRef.current?.click()}>{translateSystem("เพิ่มรูปปก")}</button><span>{photo?.name||"JPG / PNG"}</span></div>{(photo?.data||url)&&<img src={photo?.data||url} alt={translateSystem("รูป Villa ที่เลือก")} style={{width:"100%",maxHeight:300,objectFit:"cover",borderRadius:12}}/>}{photo&&<button type="button" onClick={()=>onChange(null)}>{translateSystem("ยกเลิกรูปที่เลือก")}</button>}{error&&<p role="alert">{error}</p>}</div>
}

export default function Backoffice({
  page,
  go,
  initialPackage = "Basic Verify",
  initialItem = "",
}: {
  page: Page
  go: (page: Page, item?: string) => void
  initialItem?: string
  initialPackage?: string
}) {
  useLocale()
  const admin = page.startsWith("admin-")
  const [store, setStore] = useState<Store | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const createAttempt=useRef<{payload:string;requestKey:string}|null>(null)
  const [selected, setSelected] = useState(initialItem)
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [upload, setUpload] = useState<Document | null>(null)
  const [uploading, setUploading] = useState(false)
  const [mailOpen, setMailOpen] = useState("")
  const [extraTools,setExtraTools]=useState(false)
  const [form, setForm] = useState({
    name: "", nameEn: "", photoTakenAt: "",
    province: "",
    merchant: "",
    email: "",
    guestCapacity: "", photoUrl: "", phone: "", bankName: "", accountName: "", accountNumber: "",
    package: "",
  })
  useEffect(() => {
    setMessage("")
    if(page === "owner-villas"){setFilter("all");setSearch("");}
  }, [page])
  useEffect(() => {
    setLoading(true)
    setDisplayName("")
    setStore(null)
    setSelected("")
    let cancelled = false
    let fetching = false
    const load = async () => {
      if (fetching || busyRef.current) return
      fetching = true
      try {
        const [user,next] = await Promise.all([currentAccount(),api<Store>("/state")])
        if (user.role !== (admin ? "admin" : "merchant")) {
          if (!cancelled)
            go(
              user.role === "admin"
                ? "admin-dashboard"
                : user.role === "merchant"
                  ? "owner-dashboard"
                  : "user-dashboard",
            )
          return
        }
        if (!cancelled) setDisplayName(user.name.trim() || user.email.split("@")[0] || "เจ้าของที่พัก")
        if(!admin && !next.villas.length && ["owner-add-villa","owner-onboarding-villa"].includes(page)) {
          const profile=await api<{businessName:string;businessNameEn:string}>("/merchant/profile")
          if(!profile.businessName || !profile.businessNameEn) { if(!cancelled)go("owner-information");return; }
        }
        const attempt=new URLSearchParams(window.location.search).get("paymentAttempt")
        if(attempt && !admin) {
          try { await api(`/payments/attempt?id=${encodeURIComponent(attempt)}`) }
          catch(e) { if(!cancelled)setMessage(e instanceof Error ? e.message : translateSystem("Payment QR ไม่พร้อมใช้งาน")) }
        }
        if (!cancelled && !busyRef.current) setStore(next)
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 401) { if(page === "owner-package")sessionStorage.setItem("villacheck-merchant-return","owner-package"); go(admin ? "admin-login" : "owner-auth"); }
          else
            setMessage(
              error instanceof Error ? error.message : translateSystem("โหลดข้อมูลไม่สำเร็จ"),
            )
        }
      } finally {
        fetching = false
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 10000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [admin])
  const perform = async (path: string, data: unknown, success: string) => {
    if (busyRef.current) return null
    busyRef.current = true
    setBusy(true)
    try {
      const next = await api<Store>(path, data)
      setStore(next)
      setMessage(success)
      return next
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { if(page === "owner-package")sessionStorage.setItem("villacheck-merchant-return","owner-package"); go(admin ? "admin-login" : "owner-auth"); }
      setMessage(error instanceof Error ? error.message : translateSystem("ดำเนินการไม่สำเร็จ"))
      return null
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const readFile = async (file?: File) => {
    setUpload(null)
    if (!file) return
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setMessage(translateSystem("กรุณาเลือก PDF, JPG หรือ PNG ขนาดไม่เกิน 2 MB"))
      return
    }
    setUploading(true)
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setUpload({ name: file.name, data, type: file.type })
      setMessage("")
    } catch {
      setMessage(translateSystem("อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่"))
    } finally {
      setUploading(false)
    }
  }
  const [photo,setPhoto]=useState<Document|null>(null);
  useEffect(()=>setPhoto(null),[selected,page]);
  const [draftRevision,setDraftRevision]=useState(0);
  const [draftBusy,setDraftBusy]=useState(false);
  const [draftLoading,setDraftLoading]=useState(false);
  const initializedEdit = useRef("");
  useEffect(()=>{
    if(!store?.user.id||!["owner-add-villa","owner-onboarding-villa"].includes(page))return;
    setSelected("");setUpload(null);setPhoto(null);
    const initial={name:"",nameEn:"",province:"",merchant:store?.user.name||"",email:store?.user.email||"",guestCapacity:"",photoUrl:"",photoTakenAt:"",phone:"",bankName:"",accountName:"",accountNumber:""};
    setForm(current=>({...current,...initial}));setDraftRevision(0);
    let active=true;setDraftLoading(true);
    void api<{draft:{fields:Partial<typeof form>;revision:number}|null}>("/merchant/villa-draft").then(data=>{if(!active)return;setDraftRevision(data.draft?.revision??0);if(data.draft)setForm(current=>Object.entries(initial).every(([key,value])=>current[key as keyof typeof current]===value)?{...current,...data.draft!.fields}:current)}).catch(error=>{if(active)setMessage(error instanceof Error?error.message:translateSystem("โหลดฉบับร่างไม่สำเร็จ"))}).finally(()=>{if(active)setDraftLoading(false)});
    return()=>{active=false};
  },[page,store?.user.id]);
  useEffect(()=>{
    if(page !== "owner-villa-edit") initializedEdit.current = "";
    const v=store?.villas.find(v=>v.id===initialItem);
    if(!v)return;
    if(page === "owner-villa-edit" && initializedEdit.current === v.id) return;
    if(page === "owner-villa-edit") initializedEdit.current = v.id;
    setSelected(v.id);
    setForm(current=>({...current,name:v.name,nameEn:v.nameEn || "",photoTakenAt:v.photoTakenAt || "",province:v.province,merchant:v.merchant,email:v.email,guestCapacity:v.guestCapacity == null ? "" : String(v.guestCapacity),photoUrl:v.photoUrl||"",phone:v.phone,bankName:v.bankName,accountName:v.accountName,accountNumber:v.accountNumber,package:v.packageId}));
  },[initialItem,store,page]);
  useEffect(()=>{if(!admin&&!store?.freePeriod&&store?.villas.length&&["owner-add-villa","owner-onboarding-villa"].includes(page)){const existing=store.villas.find(v=>v.id===initialItem)||store.villas[0];go("owner-villa-edit",existing.id);}},[page,store,admin,initialItem]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if(!store?.freePeriod&&store?.villas.length){go("owner-villa-edit",store.villas[0].id);return;}
    if (!upload) {
      setMessage(translateSystem("กรุณาแนบเอกสารแสดงกรรมสิทธิ์ Villa ก่อนส่งตรวจสอบ"))
      return
    }
    const payload={...form,draftRevision,packageId:store?.subscription?.packageId,document:upload,photo};
    const encoded=JSON.stringify(payload);
    if(createAttempt.current?.payload!==encoded)createAttempt.current={payload:encoded,requestKey:crypto.randomUUID()};
    const next = await perform(
      "/villas",
      {...payload,requestKey:createAttempt.current.requestKey},
      "ส่ง Villa ให้ Admin ตรวจสอบแล้ว",
    )
    if (next) {
      createAttempt.current=null;
      setSelected(next.createdId || "")
      setPhoto(null)
      setUpload(null)
      setForm({
        name: "", nameEn:"", photoTakenAt:"",
        province: "",
        merchant: "",
        email: "",
        guestCapacity: "", photoUrl: "", phone: "", bankName: "", accountName: "", accountNumber: "",
        package: form.package,
      })
      go("owner-villas")
    }
  }
  if (loading || !store)
    return (
      <PortalShell role={admin ? "Admin" : "Merchant"} page={page} go={go}>
        <h1>{loading ? translateSystem("กำลังโหลดข้อมูล") : translateSystem("โหลดข้อมูลไม่สำเร็จ")}</h1>
        <p role="alert">{message}</p>
        <button
          className="outline-button"
          onClick={() => window.location.reload()}
        >
          {translateSystem("ลองใหม่")}</button>
      </PortalShell>
    )
  const phase1=["PRELAUNCH","PHASE1","STAGING_INTERACTIVE","MEMBER_PREVIEW"].includes(store.releaseMode||"")
  const active = store.villas.find((v) => v.id === selected)
  const adding = page === "owner-add-villa" || page === "owner-onboarding-villa"
  const billing = page === "owner-package" || page === "admin-payments"
  const dashboard = page.endsWith("dashboard")
  const editing = page === "owner-villa-edit"
  const detailPage = page === "owner-villa-detail"
  const list = store.villas.filter(
    (v) =>
      (v.name + v.merchant + v.email)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" || (billing ? v.invoices.some(i=>i.paymentStatus===filter) : v.status === filter)),
  )
  const showDetails = (v: MerchantVilla, edit=false) => {
    setSelected(v.id)
    setForm({...form,name:v.name,nameEn:v.nameEn || "",photoTakenAt:v.photoTakenAt || "",province:v.province,merchant:v.merchant,email:v.email,guestCapacity:v.guestCapacity == null ? "" : String(v.guestCapacity),photoUrl:v.photoUrl||"",phone:v.phone,bankName:v.bankName,accountName:v.accountName,accountNumber:v.accountNumber,package:v.packageId})
    setUpload(null)
    go(edit ? "owner-villa-edit" : "owner-villa-detail",v.id)
  }
  const freePeriodBanner=!admin&&store.freePeriod&&<p className="free-period-banner" role="status">{store.freePeriod.state==="ACTIVE"?translateSystem("ใช้งานฟรี สิ้นสุดวันที่ {v0}", {v0: date(store.freePeriod.endsAt)}):translateSystem("ช่วงใช้ฟรีสิ้นสุดแล้ว")} {" "}{translateSystem("· เพิ่มที่พักได้ไม่จำกัดระหว่างช่วงใช้ฟรี")}</p>;
  // Package availability is a page presentation decision; billing data/APIs remain intact.
  if(!admin&&page==='owner-package')return <PortalShell phase1={phase1} role="Merchant" page={page} go={go}><PackageComingSoon/></PortalShell>
  if(!admin&&page==='owner-pending')return <PortalShell phase1={phase1} role="Merchant" page={page} go={go}>{freePeriodBanner}<DocumentManagement villas={store.villas}/></PortalShell>
  const paymentVilla = page === "owner-package" && initialItem ? store.villas.find(v=>v.invoices.some(i=>i.id===initialItem)) : undefined
  const paymentInvoice = paymentVilla?.invoices.find(i=>i.id===initialItem)
  if (!phase1 && paymentInvoice && paymentVilla) return <PortalShell role="Merchant" page={page} go={go}>
    <button type="button" className="text-button" onClick={()=>go("owner-package")}>{translateSystem("← กลับไปเลือกแพ็กเกจ")}</button>
    <h1>{translateSystem("ชำระเงินแพ็กเกจ")}</h1><p>{paymentVilla.name} · {paymentInvoice.packageName} {" "}{translateSystem("· รวมภาษี")}</p>
    {message&&<p role="status">{message}</p>}
    <PaymentPanel key={paymentInvoice.id} invoice={paymentInvoice} admin={false} instructions={paymentInvoice.paymentInstructions ?? store.paymentInstructions} configured={store.paymentConfigured} demo={store.demoMode} busy={busy} perform={perform}/>
  </PortalShell>
  return (
    <PortalShell phase1={phase1} role={admin ? "Admin" : "Merchant"} page={page} go={go}>
      {page === "owner-dashboard" && displayName && <p className="user-greeting">{translateSystem("สวัสดี")}{" "}{displayName}</p>}
      {freePeriodBanner}
      <div className="portal-head">
        <div>
          <span className="kicker">
            {admin ? "OPERATIONS / VILLACHECK" : translateSystem("ดูแลที่พักของคุณ")}
          </span>
          <h1>
            {adding
              ? translateSystem("เพิ่มที่พัก")
              : billing
                  ? phase1 ? translateSystem("ข้อมูลแพ็กเกจและโปรโมชั่น") : translateSystem("แพ็กเกจและการชำระเงิน")
                  : page === "admin-owners"
                    ? "Merchants"
                    : page === "admin-qr"
                      ? translateSystem("ทะเบียน QR")
                      : dashboard
                        ? admin ? translateSystem("ภาพรวมผู้ดูแลระบบ") : translateSystem("ภาพรวมที่พัก")
                        : translateSystem("ที่พักของคุณ")}
          </h1>
          <p>{!admin ? translateSystem("จัดการข้อมูลที่พักและติดตามผลการตรวจสอบ") : phase1 ? translateSystem("ข้อมูลที่พักและ QR ที่ผ่านการอนุมัติ · ยังไม่เปิดสิทธิ์ใหม่หรือการต่ออายุ") : translateSystem("ข้อมูลที่พักและ QR ในระบบ")}</p>
        </div>
        {!admin && !adding && page!=="owner-package" && page!=="owner-pending" && (
          <button
            className="primary-button"
            disabled={Boolean(store.freePeriod&&store.freePeriod.state!=="ACTIVE")}
            onClick={() => go("owner-add-villa")}
          >
            {translateSystem("+ เพิ่มที่พัก")}</button>
        )}
      </div>
      <div className="merchant-demo">
        {!admin&&store.freePeriod ? translateSystem("ช่วงใช้ฟรีรับสิทธิ์ Online Verify เพิ่มที่พักได้ไม่จำกัด โดยแต่ละที่พักต้องผ่านการตรวจสอบก่อนเผยแพร่") : !admin&&dashboard ? translateSystem("เพิ่มที่พัก แนบเอกสาร และติดตามผลการตรวจสอบได้ในที่เดียว") : phase1 ? translateSystem("การส่งข้อมูลไม่ใช่การเปิดสิทธิ์ใหม่ · แสดงราคาและส่วนลดที่ยืนยันแล้ว โดยยังไม่กำหนดรอบบิลหรือเงื่อนไขต่ออายุ") : translateSystem("แพ็กเกจคิดต่อที่พัก ต่อเดือน รวมภาษี · แต่ละที่พักต้องผ่าน Admin อนุมัติ · Basic Verify ราคาปกติ 990 บาท ช่วงโปรโมชั่นลด 100%")}
      </div>

      {!admin && (billing || (adding && !store.subscription)) && <VillaPackagePanel store={store} busy={busy} perform={perform} onAdd={()=>go("owner-add-villa")} onPayment={invoiceId=>go("owner-package",invoiceId)}/>}
      {!phase1 && !store.freePeriod && billing && <section className="merchant-panel" id="package-payments"><h2>{admin ? translateSystem("ตรวจสอบการชำระเงิน") : translateSystem("การชำระแพ็กเกจต่อที่พัก")}</h2><p>{translateSystem("แต่ละใบแจ้งชำระระบุที่พักและแพ็กเกจของตัวเอง ราคาต่อเดือนรวมภาษี")}</p>{!store.villas.some(v => v.invoices.length > 0) && <p>{translateSystem("ยังไม่มีใบแจ้งชำระ")}</p>}{[...new Map(store.villas.flatMap(v => v.invoices).map(invoice => [invoice.id, invoice])).values()].map(invoice => <PaymentPanel key={invoice.id} invoice={invoice} admin={admin} instructions={store.demoMode ? store.paymentInstructions : (invoice.paymentInstructions ?? store.paymentInstructions)} configured={store.paymentConfigured}
                      demo={store.demoMode} busy={busy} perform={perform} />)}</section>}
      {message && (
        <div className="form-message" role="status">
          {message}
        </div>
      )}
      {!phase1 && !admin && dashboard && <details className="merchant-panel" onToggle={e=>setExtraTools(e.currentTarget.open)}><summary>{translateSystem("เครื่องมือเพิ่มเติม")}</summary>{extraTools&&<><OwnerVerification/><Reviews mode="merchant"/><Advertising merchant/></>}</details>}
      {dashboard && (
        <>
          <div className="metric-grid">
            {[
              ["ที่พักทั้งหมด", store.villas.length],
              [
                "รอตรวจเอกสาร",
                store.villas.filter((v) => v.status === "pending").length,
              ],
              [
                "QR ใช้งานได้",
                store.villas.filter(
                  (v) => v.qrStatus === "ACTIVE",
                ).length,
              ],
              [
                admin ? translateSystem("รอชำระเงิน") : translateSystem("ต้องแก้ไข"),
                store.villas.filter((v) => admin ? v.paymentPending : v.status==="changes").length,
              ],
            ].map(([label, count]) => (
              <div className="metric-card" key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
                <small>{translateSystem("อัปเดตจากรายการในระบบ")}</small>
              </div>
            ))}
          </div>
          {!phase1&&admin&&<section className="merchant-panel"><h2>{translateSystem("งานดูแลหน้าบ้าน")}</h2><p>{translateSystem("ตรวจข้อมูลและสิทธิ์ให้ครบก่อนแสดงต่อผู้ค้นหาที่พัก")}</p><div className="button-row">{([["admin-cms","เนื้อหาเว็บไซต์ / ข่าวสาร"],["admin-pending-villas","ตรวจที่พัก"],["admin-owner-verification","ยืนยันเจ้าของบ้าน"],["admin-reviews","กลั่นกรองรีวิว"],["admin-advertising","โฆษณา / ไฟล์ Social"],["admin-subscriptions","สิทธิ์รายที่พัก"],["admin-users","บัญชี User"],["admin-owners","บัญชี Merchant"]] as [Page,string][]).map(([target,label])=><button key={target} onClick={()=>go(target)}>{label}</button>)}</div></section>}
          <div className="merchant-steps">
            {[
              phase1 ? translateSystem("01 ส่งข้อมูลที่พักเพื่อรอตรวจสอบ") : translateSystem("01 สมัครและเพิ่มที่พัก"),
              "02 ส่งเอกสารให้ทีมตรวจสอบ",
              "03 ทีมอนุมัติตามเกณฑ์",
              phase1 ? translateSystem("04 เปิดสิทธิ์ใหม่เมื่อเงื่อนไขได้รับการยืนยัน") : translateSystem("04 แต่ละที่พักมี QR แยกกัน"),
            ].map((step) => (
              <span key={step}>{step}</span>
            ))}
          </div>
        </>
      )}
      {adding ? (
        <BusinessWriteFieldset><form className="portal-form merchant-panel" onSubmit={submit}>
          <h2>{translateSystem("ข้อมูลที่พักและผู้ประกอบการ")}</h2>
          <p>{translateSystem("กรอกชื่อที่พักทั้งภาษาไทยและภาษาอังกฤษ เพื่อให้ลูกค้าค้นหาได้จากทั้งสองชื่อ ใช้ชื่อเดียวกับป้ายที่พักและช่องทางทางการ")}</p>
          <div className="merchant-form-grid">
            {([
              ["name", "ชื่อที่พักภาษาไทย"],
              ["nameEn", "ชื่อที่พักภาษาอังกฤษ"],
              ["province", "จังหวัด"],
              ["merchant", "ชื่อผู้ประกอบการ / บริษัท"],
              ["email", "อีเมลติดต่อ"],
              ["phone", "เบอร์ติดต่อที่พัก"],
              ["bankName", "ธนาคารรับเงิน"],
              ["accountName", "ชื่อบัญชีรับเงิน"],
              ["accountNumber", "เลขที่บัญชีรับเงิน"],
            ] as const).map(([key, label]) => (
              <label key={key}>
                <span>{label}{["name","nameEn","province","merchant","email"].includes(key)?" *":""}</span>
                <input
                  required={["name","nameEn","province","merchant","email"].includes(key)}
                  type={key === "email" ? "email" : "text"}
                  placeholder={key === "name" ? translateSystem("เช่น บ้านริมทะเล พัทยา") : key === "nameEn" ? translateSystem("เช่น Seaside Pattaya Villa") : undefined}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <label><span>{translateSystem("จำนวนผู้พักสูงสุด")}</span><input type="number" min="1" max="1000" step="1" value={form.guestCapacity} onChange={e=>setForm({...form,guestCapacity:e.target.value})}/></label><VillaPhotoInput url={form.photoUrl} photo={photo} onChange={setPhoto}/>{(form.photoUrl||photo)&&<button type="button" className="outline-button" onClick={()=>{setPhoto(null);setForm(current=>({...current,photoUrl:""}))}}>{translateSystem("นำรูปปกออกจากข้อมูลที่ส่งตรวจ")}</button>}<label>{translateSystem("วันที่ถ่ายภาพ (หากทราบ)")}<input type="date" value={form.photoTakenAt} onChange={e=>setForm({...form,photoTakenAt:e.target.value})}/></label>
          <label className="merchant-upload">
            <strong>{translateSystem("แนบหลักฐานการเป็นเจ้าของ Villa *")}</strong>
            <span>
              {translateSystem("เช่น โฉนด หรือเอกสารแสดงกรรมสิทธิ์ · PDF, JPG, PNG ไม่เกิน 2 MB")}</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
            <small>
              {uploading ? translateSystem("กำลังอ่านเอกสาร…") : upload?.name || translateSystem("ยังไม่ได้แนบเอกสาร")}
            </small>
          </label>
          <p>{phase1 ? translateSystem("ข้อมูลจะเข้าคิวรอตรวจสอบ ยังไม่เปิดสิทธิ์ใหม่หรือส่งอีเมลเรียกเก็บเงิน") : store.paymentAccessMode==="DISABLED"?translateSystem("Admin จะตรวจเอกสารก่อนอนุมัติ · ช่วงนี้ยังไม่มีการเรียกเก็บเงิน"):translateSystem("Admin จะตรวจเอกสารก่อนอนุมัติ จากนั้นแจ้งให้ชำระแพ็กเกจทางอีเมล")}</p>
          <button type="button" className="outline-button" disabled={draftLoading||draftBusy||busy} onClick={async()=>{setDraftBusy(true);try{const fields={name:form.name,nameEn:form.nameEn,province:form.province,merchant:form.merchant,email:form.email,phone:form.phone,guestCapacity:form.guestCapacity};const saved=await api<{draft:{revision:number}}>("/merchant/villa-draft",{fields,expectedRevision:draftRevision});setDraftRevision(saved.draft.revision);setMessage(translateSystem("บันทึกฉบับร่างส่วนตัวแล้ว ยังไม่ส่งให้ Admin ตรวจสอบ · รูปภาพและเอกสารต้องเลือกใหม่ก่อนส่งจริง"))}catch(error){setMessage(error instanceof Error?error.message:translateSystem("บันทึกฉบับร่างไม่สำเร็จ"))}finally{setDraftBusy(false)}}}>{translateSystem("บันทึกฉบับร่าง")}</button>
          <button
            type="submit"
            className="primary-button"
            disabled={uploading || busy || draftLoading || draftBusy || Boolean(store.freePeriod&&store.freePeriod.state!=="ACTIVE")}
          >
            {translateSystem("ส่งตรวจสอบ")}</button>
        </form></BusinessWriteFieldset>
      ) : (
        <>
          {!billing && !editing && !detailPage && <>
          {page === "owner-villas" && <p role="status">{translateSystem("ที่พักของคุณทั้งหมด")}{" "}{store.villas.length} {" "}{translateSystem("รายการ · แสดง")}{" "}{list.length} {" "}{translateSystem("รายการ")}</p>}
          <div className="merchant-toolbar">
            <input
              aria-label={translateSystem("ค้นหาที่พักหรือผู้ประกอบการ")}
              placeholder={translateSystem("ค้นหาชื่อที่พักหรือผู้ประกอบการ…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label={translateSystem("กรองสถานะ")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">{translateSystem("ทุกสถานะ")}</option>
              {billing && ["WAITING_FOR_SLIP","PENDING_REVIEW","VERIFIED","REJECTED"].map(s=><option key={s} value={s}>{s}</option>)}
              {!billing&&<option value="pending">{translateSystem("รอตรวจสอบ")}</option>}
              {!billing&&<option value="approved">{translateSystem("อนุมัติแล้ว")}</option>}
              {!billing&&<option value="changes">{translateSystem("ต้องแก้ไข")}</option>}
              {!billing&&<option value="rejected">{translateSystem("ไม่อนุมัติ")}</option>}
            </select>
          </div>
          {!list.length && (
            <div className="merchant-empty">
              <span>◇</span>
              <h2>
                {store.villas.length ? translateSystem("ไม่พบรายการที่ค้นหา") : translateSystem("เริ่มต้นจาก Villa แรก")}
              </h2>
              <p>
                {admin
                  ? translateSystem("รายการที่ Merchant ส่งพร้อมเอกสารจะปรากฏที่นี่")
                  : translateSystem("เพิ่มที่พักและแนบหลักฐานกรรมสิทธิ์เพื่อเริ่มรับการตรวจสอบ")}
              </p>
              {!admin && (
          <button
            className="primary-button"
            disabled={false}
            onClick={() => go("owner-add-villa")}
                >
                  {translateSystem("+ เพิ่มที่พัก")}</button>
              )}
            </div>
          )}
          <div className="merchant-list">
            {list.map((v) => (
              <article className="merchant-panel merchant-villa" key={v.id} onClick={e=>{if(!(e.target as HTMLElement).closest("button,a,input,select,textarea,label"))showDetails(v);}}>
                <div className="merchant-cover"><button type="button" className="merchant-cover-link" aria-label={translateSystem("ดูรายละเอียดที่พัก {v0}", {v0: v.name})} onClick={()=>showDetails(v)}><DemoPhoto demo={v.demoImage} src={v.photoUrl} alt={v.name} loading="lazy" /></button><StatusCornerRibbon villa={v}/></div>
                <div className="merchant-villa-top">
                  <div>
                    <small>
                      {v.province} {" "}{translateSystem("· ผู้ประกอบการ")}{" "}{v.merchant}
                    </small>
                    <h2><button className="villa-title-link" onClick={()=>showDetails(v)}>{v.name}</button></h2>
                    <p>{v.email}</p>
                  </div>
                  {v.premiumBanner&&<span className="merchant-status">Premium Verified</span>}
                  {admin&&<span className={`merchant-status ${v.status}`}>{villaStatusBadge(v).label}</span>}
                </div>
                <div className="merchant-villa-meta">
                  <span>
                    {translateSystem("แพ็กเกจ")}<strong>{v.package}</strong>
                  </span>
                  <span>{translateSystem("จำนวนผู้เข้าพักสูงสุด")}<strong>{v.guestCapacity == null ? translateSystem("ไม่ได้ระบุ") : translateSystem("{v0} คน", {v0: v.guestCapacity})}</strong></span>
                  <span>
                    {translateSystem("วันหมดอายุ")}<strong>{date(v.expires)}</strong>
                  </span>
                </div>
                {v.reason && (
                  <p className="merchant-reason">{translateSystem("เหตุผลจาก Admin:")}{" "}{v.reason}</p>
                )}
                <div className="button-row">
                  {admin ? <>
                    <a className="outline-button" href={`${v.document.data}?preview=1`} target="_blank" rel="noreferrer">{translateSystem("เปิดเอกสารที่แนบ")}</a>
                    {v.status === "pending" && <button className="primary-button" onClick={()=>go("admin-pending-villas")}>{translateSystem("เปิดคิว Villa รออนุมัติ")}</button>}
                    {v.status === "approved" && <button className="primary-button" onClick={()=>go("admin-approved-villas")}>{translateSystem("ดู Villa ที่อนุมัติแล้ว")}</button>}
                  </> : <button
                    className="outline-button"
                    onClick={() => showDetails(v)}
                  >
                    {translateSystem("ดูรายละเอียดที่พัก")}</button>}
                  {!admin&&<button className="primary-button" onClick={()=>showDetails(v,true)}>{translateSystem("แก้ไขที่พัก")}</button>}
                </div>
                {admin && v.status === "approved" &&
                  v.invoices.map((invoice) => (
                    <PaymentPanel
                      key={invoice.id}
                      invoice={invoice}
                      admin={admin}
                      instructions={store.demoMode ? store.paymentInstructions : (invoice.paymentInstructions ?? store.paymentInstructions)}
                      configured={store.paymentConfigured}
                      demo={store.demoMode}
                      busy={busy}
                      perform={perform}
                    />
                  ))}
              </article>
            ))}
          </div>
          </>}
          {active &&
            (page === "owner-villa-detail" ||
              page === "owner-villa-edit") && (
              <section className="merchant-panel merchant-detail">{!admin&&active.reason&&<p className="merchant-reason" role="alert">{translateSystem("เหตุผลจาก Admin:")}{" "}{active.reason}</p>}
                {!admin&&<div className="button-row"><button className="outline-button" onClick={()=>go("owner-villas")}>{translateSystem("กลับรายการที่พัก")}</button>{!editing&&<button className="primary-button" onClick={()=>showDetails(active,true)}>{translateSystem("แก้ไขที่พัก")}</button>}</div>}
                {!admin&&editing&&<BusinessWriteFieldset><form className="portal-form" onSubmit={async e=>{
                  e.preventDefault();
                  if(busyRef.current)return;
                  busyRef.current=true;setBusy(true);setMessage("");
                  try{
                    await api(`/merchant/villas/${active.id}`,{...form,photo});
                    setPhoto(null);
                    setMessage(translateSystem("บันทึกสำเร็จ · รออนุมัติจาก Admin โดยคง QR เดิม"));
                    try{
                      const next=await api<Store>("/state");
                      setStore(next);
                      const saved=next.villas.find(v=>v.id===active.id);
                      if(saved)setForm(current=>({...current,photoUrl:saved.photoUrl||""}));
                    }
                    catch{setMessage(translateSystem("บันทึกและส่งตรวจใหม่สำเร็จแล้ว แต่โหลดสถานะล่าสุดไม่สำเร็จ กรุณารีเฟรชหน้า"));}
                  }catch(error){
                    if(error instanceof ApiError && error.status===401)go(admin ? "admin-login" : "owner-auth");
                    setMessage(error instanceof Error?error.message:translateSystem("บันทึกไม่สำเร็จ กรุณาลองใหม่"));
                  }finally{busyRef.current=false;setBusy(false);}
                }}><h2>{translateSystem("แก้ไขข้อมูล Villa")}</h2><p role="status" className="merchant-status">{translateSystem("สถานะ:")}{" "}{status(active)}</p><label><span>{translateSystem("จำนวนผู้พักสูงสุด")}</span><input type="number" min="1" max="1000" step="1" value={form.guestCapacity} onChange={e=>setForm({...form,guestCapacity:e.target.value})}/></label><VillaPhotoInput url={form.photoUrl} photo={photo} onChange={setPhoto}/>{(form.photoUrl||photo)&&<button type="button" className="outline-button" onClick={()=>{setPhoto(null);setForm(current=>({...current,photoUrl:""}))}}>{translateSystem("นำรูปปกออกจากข้อมูลที่ส่งตรวจ")}</button>}<label>{translateSystem("วันที่ถ่ายภาพ (หากทราบ)")}<input type="date" value={form.photoTakenAt} onChange={e=>setForm({...form,photoTakenAt:e.target.value})}/></label><p>{translateSystem("การแก้ข้อมูลจะส่งให้ Admin ตรวจใหม่ และออก QR ใหม่หลังอนุมัติ")}</p>{(["name","nameEn","province","merchant","phone","bankName","accountName","accountNumber"] as const).map(k=><label key={k}>{({name:"ชื่อที่พักภาษาไทย",nameEn:"ชื่อที่พักภาษาอังกฤษ",province:"จังหวัด",merchant:"ชื่อผู้ประกอบการ",phone:"เบอร์ติดต่อ",bankName:"ธนาคาร",accountName:"ชื่อบัญชี",accountNumber:"เลขบัญชี"} as Record<string,string>)[k] || k}<input required={["name","nameEn","province","merchant"].includes(k)} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}{message&&<p role="status" aria-live="polite">{message}</p>}<button type="submit" disabled={busy} className="primary-button">{busy?translateSystem("กำลังบันทึกและส่งตรวจ…"):translateSystem("บันทึกและส่งตรวจใหม่")}</button></form></BusinessWriteFieldset>}
                {!editing&&<div className="villa-image"><DemoPhoto demo={active.demoImage} src={active.photoUrl} alt={active.name} style={{width:"100%",maxHeight:360,objectFit:"cover",borderRadius:12}}/><StatusCornerRibbon villa={active}/></div>}
                <OwnershipDocuments key={`ownership-${active.id}`} villaId={active.id} admin={admin} onChanged={()=>{void api<Store>("/state").then(setStore).catch(e=>setMessage(e.message));}}/><PropertyMedia key={`media-${active.id}`} villaId={active.id} mode={admin?"admin":"merchant"} onChanged={()=>{void api<Store>("/state").then(setStore).catch(e=>setMessage(e.message));}}/>
                {!phase1&&!admin&&!editing&&<><OwnerVerification key={`owner-${active.id}`} villaId={active.id}/><SocialMaterials key={`social-${active.id}`} villaId={active.id}/></>}
                <h2>{translateSystem("เอกสารกรรมสิทธิ์ ·")}{" "}{active.name}</h2>
                <p>{active.document.name}</p>
                <div className="merchant-villa-meta">
                  <span>{translateSystem("เบอร์โทรทางการ")}<strong>{active.phone || translateSystem("ยังไม่ได้ระบุ")}</strong></span>
                  <span>{translateSystem("บัญชีรับเงิน")}<strong>{active.bankName || translateSystem("ยังไม่ได้ระบุ")} · {active.accountNumber || "—"}</strong></span>
                  <span>{translateSystem("ชื่อบัญชี")}<strong>{active.accountName || translateSystem("ยังไม่ได้ระบุ")}</strong></span>
                </div>
                <a
                  className="outline-button"
                  href={active.document.data}
                  download={active.document.name}
                >
                  {translateSystem("ดาวน์โหลดเอกสาร")}</a>
                {active.document.type.startsWith("image/") && (
                  <img
                    className="merchant-document"
                    src={active.document.data}
                    alt={translateSystem("เอกสารกรรมสิทธิ์ Villa")}
                  />
                )}
                {!admin && ["changes", "rejected"].includes(active.status) && (
                  <div className="portal-form">
                    <label>
                      <span>{translateSystem("แนบเอกสารใหม่เพื่อส่งตรวจอีกครั้ง")}</span>
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={(e) => void readFile(e.target.files?.[0])}
                      />
                    </label>
                    <button
                      disabled={!upload || uploading || busy}
                      className="primary-button"
                      onClick={async () => {
                        if (
                          upload &&
                          (await perform(
                            `/villas/${active.id}/resubmit`,
                            { document: upload },
                            "ส่งเอกสารใหม่ให้ Admin ตรวจสอบแล้ว",
                          ))
                        )
                          setPhoto(null)
      setUpload(null)
                      }}
                    >
                      {translateSystem("ส่งตรวจสอบอีกครั้ง")}</button>
                  </div>
                )}
                {!editing && active.qr && <VillaQr villa={active} admin={admin} />}
              </section>
            )}
          {!phase1 && (admin || billing) && (
            <section className="merchant-panel merchant-mail">
              <h2>
                {translateSystem("ประวัติการส่งอีเมล")}{" "}<small>{store.mails.length} {" "}{translateSystem("รายการ")}</small>
              </h2>
              <p>
                {store.demoMode ? translateSystem("DEMO · อีเมลถูกบันทึกให้ตรวจดูในระบบ ไม่ส่งผ่าน SMTP จริง") : store.smtpConfigured
                  ? translateSystem("ส่งผ่าน SMTP อัตโนมัติ มีการลองใหม่เมื่อส่งไม่สำเร็จ")
                  : translateSystem("ยังไม่ได้ตั้งค่า SMTP · อีเมลเก็บในคิวและจะส่งเมื่อเชื่อมบริการแล้ว")}
              </p>
              {!store.mails.length && <p>{translateSystem("ยังไม่มีอีเมลแจ้งชำระเงิน")}</p>}
              {store.mails.map((mail) => (
                <div key={mail.id}>
                  <button
                    className="merchant-mail-row"
                    onClick={() =>
                      setMailOpen(mailOpen === mail.id ? "" : mail.id)
                    }
                  >
                    <span>
                      <strong>{mail.subject}</strong>
                      <small>
                        {translateSystem("ถึง")}{" "}{mail.to} · {date(mail.created)} ·{" "}
                        {mail.status === "sent"
                          ? translateSystem("ส่งแล้ว")
                          : mail.status === "demo" ? translateSystem("DEMO · เก็บอีเมล ไม่ส่งจริง")
                          : mail.status === "waiting_config"
                            ? translateSystem("รอตั้งค่า SMTP")
                            : mail.status === "failed"
                              ? translateSystem("ส่งไม่สำเร็จ")
                              : translateSystem("กำลังรอส่ง")}
                      </small>
                    </span>
                    <span>{translateSystem("ดูอีเมล ↗")}</span>
                  </button>
                  {mailOpen === mail.id && (
                    <div>
                      <pre>{mail.body}</pre>
                      {mail.error && <p>{mail.error}</p>}
                      {admin && mail.status === "failed" && (
                        <button
                          disabled={busy}
                          className="outline-button"
                          onClick={() =>
                            void perform(
                              `/mails/${mail.id}/retry`,
                              {},
                              "นำอีเมลเข้าคิวส่งใหม่แล้ว",
                            )
                          }
                        >
                          {translateSystem("ลองส่งอีกครั้ง")}</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </PortalShell>
  )
}

export function MerchantVerification({
  reference,
  go,
  adminView = false,preview=false,
}: {
  reference: string
  go: (page: Page, item?: string) => void
  adminView?: boolean
  preview?: boolean
}) {
  const t=useCopy();
  const [villa, setVilla] = useState<{
    name: string
    nameEn?: string
    villaId?: string
    propertyDetails?: Details|null
    trialUnlimited?: boolean
    basicVerificationNotice?: string | null
    ownerVerificationRequired?: boolean
    ownerVerification?: {status:string;reviewedAt:string;method:string} | null
    photoUploadedAt?: string | null
    photoTakenAt?: string | null
    photoReviewedAt?: string | null
    province: string
    demoImage?:boolean
    photoUrl: string
    verificationLevel: string
    premiumBanner: boolean
    qrStatus: string
    merchantName: string
    expires: string
    valid: boolean
    locked: boolean
    viewerRole?: string
    phone?: string
    bankName?: string
    accountName?: string
    accountNumber?: string
  } | null>(null)
  const [publicRevision,setPublicRevision]=useState(0)
  useEffect(()=>adminView?undefined:onPublicVillaRefresh(()=>setPublicRevision(value=>value+1)),[adminView])
  const activityLogged = useRef("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setVilla(null)
    setError("")
    void api<{ villaId?:string; propertyDetails?:Details|null; nameEn?: string; basicVerificationNotice?: string | null; ownerVerificationRequired?: boolean; ownerVerification?: {status:string;reviewedAt:string;method:string} | null; trialUnlimited?: boolean; photoUploadedAt?: string | null; photoTakenAt?: string | null; photoReviewedAt?: string | null; qr?:string; demoImage?:boolean; photoUrl: string; verificationLevel: string; premiumBanner: boolean; qrStatus: string; merchantName: string; name: string; province: string; expires: string; valid: boolean; locked: boolean; viewerRole?: string; phone?: string; bankName?: string; accountName?: string; accountNumber?: string }>(
      `${adminView?"/admin/qr-verification":"/public/qr"}/${encodeURIComponent(reference)}`,
    )
      .then((value) => {
        if (!cancelled) {
          setVilla(value)
          if(!adminView&&!preview&&value.qr&&value.qr!==reference){
            window.history.replaceState(null,"","/#"+new URLSearchParams({page:"verify",item:value.qr}));window.dispatchEvent(new PopStateEvent("popstate"));return
          }
          if(preview || value.viewerRole==="admin")return
          const activityKey=reference+":"+value.locked
          if(activityLogged.current===activityKey)return
          activityLogged.current=activityKey
          // Protected Stage: no public analytics writes.
        }
      })
      .catch((error) => {
        if (!cancelled) {
          if(adminView && error instanceof ApiError && error.status===401)go("admin-login");
          setError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reference,adminView,publicRevision])
  const isAdmin = adminView || villa?.viewerRole === "admin";
  const [returning,setReturning]=useState(false);
  const backToAccount=async()=>{
    if(returning)return;
    setReturning(true);
    try{
      const account=await currentAccount();
      if(account.role==="admin"){const previous=lastAdminPage();go(previous.page,previous.item)}
      else go(account.role==="merchant"?"owner-dashboard":"user-dashboard");
    }catch(error){
      if(error instanceof ApiError&&error.status===401)go("home");
      else setError(error instanceof Error?error.message:translateSystem("กลับหน้าบัญชีไม่สำเร็จ กรุณาลองใหม่"));
    }finally{setReturning(false);}
  };
  return (
    <main className="page-bg">
      <div className="container"><HomeLogoLink className="logo-button" onNavigate={()=>go("home")}>VillaCheck</HomeLogoLink></div>
      <div className="container merchant-verification merchant-panel">
        <span className="kicker">{isAdmin?"VILLACHECK / ADMIN PROPERTY DETAILS":"VILLACHECK / PROPERTY DETAILS"}</span>
        <h1>
          {loading ? translateSystem("กำลังโหลดรายละเอียดที่พัก…") : villa?.name || (villa?translateSystem("ข้อมูลที่พักอยู่ระหว่างตรวจสอบ"):translateSystem("ไม่พบรายละเอียดที่พัก"))}
        </h1>
        {error && <p role="alert">{error}</p>}
        {villa && (
          <>
            <div className="property-detail-intro"><p>{villa.nameEn}</p><p>{villa.province} · {villa.merchantName}</p><DemoPhoto className="property-detail-cover" demo={villa.demoImage} src={villa.photoUrl} alt={villa.name}/>{villa.propertyDetails?<PropertyDetails details={villa.propertyDetails}/>:<p role="status">{translateSystem("ยังไม่มีข้อมูลรายละเอียดที่พัก")}</p>}<h2>{translateSystem("ข้อมูลและสถานะของที่พัก")}</h2></div>
            <span className="merchant-status">
              {villa.valid
                ? translateSystem("QR ใช้งานได้ · Admin อนุมัติแล้ว")
                : ({EXPIRED:"QR หมดอายุ",SUSPENDED:"QR ถูกระงับ",INACTIVE:"QR ปิดใช้งาน",PENDING:"QR อยู่ระหว่างรออนุมัติ"} as Record<string,string>)[villa.qrStatus] || translateSystem("QR ไม่พร้อมใช้งาน")}
            </span>
            {villa.ownerVerificationRequired && !villa.ownerVerification && <p className="verification-reminder">{translateSystem("ยังไม่ผ่านการยืนยันเจ้าของบ้านด้วยใบหน้าและทะเบียนบ้าน")}</p>}
            {villa.ownerVerification && <p className="merchant-status">{translateSystem("ยืนยันเจ้าของบ้านแล้ว ·")}{" "}{villa.ownerVerification.method} · {date(villa.ownerVerification.reviewedAt)}</p>}
            {villa.basicVerificationNotice && <p className="verification-reminder">{villa.basicVerificationNotice}</p>}
            <p>{villa.nameEn}</p><p>{translateSystem("อัปเดตรูปภาพล่าสุดเมื่อ")}{" "}{villa.photoUploadedAt ? date(villa.photoUploadedAt) : translateSystem("ไม่ระบุ")}</p>{villa.photoUrl && <p>{translateSystem("วันที่อัปโหลด:")}{" "}{villa.photoUploadedAt ? date(villa.photoUploadedAt) : translateSystem("ไม่ระบุ")} {" "}{translateSystem("· วันที่ถ่าย:")}{" "}{villa.photoTakenAt ? date(villa.photoTakenAt) : translateSystem("ไม่ระบุ")}{villa.photoReviewedAt && <> {" "}{translateSystem("· วันที่ทีมตรวจสื่อ:")}{" "}{date(villa.photoReviewedAt)}</>}</p>}<p>{villa.province} · {villa.merchantName} · {villa.verificationLevel} · {villa.qrStatus}</p>
            {villa.premiumBanner && <p className="merchant-status">{translateSystem("✦ Premium Verified · เอกสารผ่านและ Subscription ใช้งานได้")}</p>}
            {villa.name&&<a href={`https://www.google.com/maps/search/?${new URLSearchParams({api:"1",query:`${villa.name} ${villa.province}`})}`} target="_blank" rel="noopener noreferrer">{t("profile.map")}</a>}
            <p>{translateSystem("วันหมดอายุ:")}{" "}{villa.expires ? date(villa.expires) : villa.trialUnlimited ? translateSystem("ยังไม่มีวันสิ้นสุดที่ยืนยัน · Basic โปรโมชั่น") : date(villa.expires)}</p>
            {!isAdmin&&<button onClick={()=>go("villa-report",reference)}>{t("profile.report")}</button>}
            <section className={`verification-contact ${villa.locked ? "locked" : ""}`}>
              <div className="verification-contact-head"><h2>{t("profile.contacts")}</h2><span>{isAdmin?translateSystem("ข้อมูลเต็มสำหรับ Admin"):villa.locked ? translateSystem("ข้อมูลส่วนบุคคลถูกปกปิด") : translateSystem("ข้อมูลทะเบียน")}</span></div>
              <dl>
                <div><dt>{t("profile.phone")}</dt><dd>{villa.locked ? "•••-•••-••••" : villa.phone || translateSystem("ยังไม่ได้ระบุ")}</dd></div>
                <div><dt>{t("profile.bank")}</dt><dd>{villa.bankName || translateSystem("ยังไม่ได้ระบุ")}</dd></div>
                <div><dt>{t("profile.bankName")}</dt><dd>{villa.locked ? translateSystem("ข้อมูลถูกปกปิด") : villa.accountName || translateSystem("ยังไม่ได้ระบุ")}</dd></div>
                <div><dt>{t("profile.bankNumber")}</dt><dd>{villa.locked ? "•••-•-•••••-•" : villa.accountNumber || translateSystem("ยังไม่ได้ระบุ")}</dd></div>
              </dl>
              {villa.locked && !isAdmin ? <div className="verification-login"><p>{translateSystem("กรอกเลขบัญชีหรือเบอร์ที่ได้รับในหน้าตรวจข้อมูลก่อนโอน ระบบจะแจ้งว่าตรงกับทะเบียนหรือไม่ โดยไม่เปิดเผยข้อมูลเต็ม")}</p><div className="button-row"><button className="primary-button" onClick={() => go(villa.viewerRole === "user"?"user-precheck":"login", reference)}>{villa.viewerRole === "user"?translateSystem("ตรวจข้อมูลก่อนโอน"):translateSystem("เข้าสู่ระบบเพื่อตรวจข้อมูล")}</button><button className="outline-button" onClick={() => go("user-registration", reference)}>{translateSystem("สมัครสมาชิก User")}</button></div></div> : <p className="verification-reminder">{isAdmin?translateSystem("ข้อมูลทะเบียนสำหรับผู้ดูแลระบบ"):t("profile.contactReminder")}</p>}
            </section>
          </>
        )}
        {villa?.name && <>{isAdmin&&villa.villaId&&villa.ownerVerificationRequired&&<OwnerVerification admin villaId={villa.villaId}/>}<PropertyMedia key={`media-${reference}`} qr={reference} villaId={villa.villaId} mode={isAdmin?"admin":"public"}/><Reviews qr={reference} mode={isAdmin?"admin":"public"}/></>}
        <p>QR Reference: {reference}</p>
        <button className="outline-button" disabled={returning} onClick={()=>void backToAccount()}>
          {returning?translateSystem("กำลังกลับหน้าบัญชี…"):isAdmin?translateSystem("กลับหน้าก่อนหน้า Admin"):villa?.viewerRole==="merchant"?translateSystem("กลับหน้าหลัก Merchant"):villa?.viewerRole==="user"?translateSystem("กลับหน้าหลัก User"):translateSystem("กลับหน้าหลัก")}
        </button>
      </div>
    </main>
  )
}

type Perform = (
  path: string,
  data: unknown,
  message: string,
) => Promise<Store | null>
function PaymentPanel({
  invoice,
  admin,
  instructions,
  configured,
  demo,
  busy,
  perform,
}: {
  invoice: Invoice
  admin: boolean
  instructions: string
  configured: boolean
  demo: boolean
  busy: boolean
  perform: Perform
}) {
  const [file, setFile] = useState<Document | null>(null)
  const [reference, setReference] = useState("")
  const [bankTransaction, setBankTransaction] = useState(invoice.reference)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [reading, setReading] = useState(false)
  if(invoice.gateway === "OMISE")return <OmiseCheckout key={invoice.id} invoice={invoice} admin={admin}/>
  if(invoice.paymentAccessMode==="DISABLED"||invoice.paymentAccessMode==="OMISE_TEST")return <section className="payment-panel"><strong>{translateSystem("ประวัติใบแจ้งชำระ ฿")}{invoice.amount.toLocaleString(localeTag())}</strong><p>{translateSystem("ปิดรับชำระ manual รายการเดิมเก็บไว้สำหรับตรวจสอบ กรุณาติดต่อผู้ดูแลหากเคยโอนแล้ว")}</p></section>
  const selectProof = (selected?: File) => {
    setFile(null)
    setError("")
    if (!selected) return
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(selected.type) ||
      selected.size > 2 * 1024 * 1024
    ) {
      setError(translateSystem("ใช้ PDF, JPG, PNG ไม่เกิน 2 MB"))
      return
    }
    setReading(true)
    const reader = new FileReader()
    reader.onload = () => {
      setFile({
        name: selected.name,
        type: selected.type,
        data: String(reader.result),
      })
      setReading(false)
    }
    reader.onerror = () => {
      setError(translateSystem("อ่านไฟล์ไม่สำเร็จ"))
      setReading(false)
    }
    reader.readAsDataURL(selected)
  }
  return (
    <div className="payment-panel">
      <strong>
        {translateSystem("ใบแจ้งชำระ")}{invoice.scope === "merchant" ? translateSystem("แพ็กเกจ Merchant") : " Villa"} {" "}{translateSystem("฿")}{invoice.amount.toLocaleString(localeTag())} {" "}{translateSystem("· อายุ QR")}{" "}
        {invoice.months} {" "}{translateSystem("เดือน")}</strong>
      <small>{invoice.id} · {invoice.packageName} {" "}{translateSystem("· สร้าง")}{" "}{date(invoice.created)}</small>
      <p>Payment: {invoice.paymentStatus} · QR: {invoice.paymentQr?.status||translateSystem("ไม่มี QR")} {" "}{translateSystem("· หมดอายุ")}{" "}{date(invoice.paymentQr?.expiresAt||"")}</p>
      {invoice.proof&&<p>{translateSystem("อัปเดตหลักฐาน")}{" "}{new Date(invoice.updatedAt).toLocaleString(localeTag())}</p>}
          <h3>{translateSystem("บัญชีธนาคารรับชำระที่ Admin ตั้งไว้")}</h3><p className="payment-instructions">{instructions}</p>
          <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(`VillaCheck · ${invoice.id}\n${invoice.packageName} · THB ${invoice.amount}\n${instructions}`)}`} download={`payment-${invoice.id}.txt`}>{translateSystem("ดาวน์โหลดรายละเอียดบัญชีและยอดชำระ")}</a>
          {!demo && invoice.bankQrImage && <section className="bank-payment-details"><h3>{translateSystem("QR โอนเงินเข้าบัญชีรับชำระ")}</h3><img src={invoice.bankQrImage} alt={translateSystem("QR บัญชีรับชำระของ VillaCheck")} style={{width:240,maxWidth:"100%",objectFit:"contain"}}/><p>{translateSystem("ตรวจชื่อผู้รับและยอดตามใบแจ้งชำระก่อนยืนยันโอน จากนั้นแนบสลิปเพื่อให้ Admin ตรวจ")}</p><a href={invoice.bankQrImage} target="_blank" rel="noopener noreferrer" download>{translateSystem("เปิด / ดาวน์โหลด QR รับชำระ")}</a></section>}
      {!admin && invoice.status === "pending" && <PaymentQr paymentId={invoice.id} initial={invoice.paymentQr} />}
      <p>
        {invoice.status === "paid"
          ? translateSystem("ยืนยันชำระแล้ว {v0}", {v0: date(invoice.paidAt || "")})
          : invoice.paymentStatus === "REJECTED" ? translateSystem("สลิปถูกปฏิเสธ กรุณาแนบใหม่")
          : invoice.status === "submitted"
            ? translateSystem("แนบสลิปแล้ว รอ Admin ตรวจยืนยัน")
            : translateSystem("รอชำระเงินและแนบสลิป")}
      </p>
      {invoice.reason && <p>{translateSystem("เหตุผลจาก Admin:")}{" "}{invoice.reason}</p>}
      {demo && invoice.status === "pending" && !admin && <div className="merchant-panel"><strong>{translateSystem("DEMO · ไม่มีการโอนเงินจริง")}</strong><p>{translateSystem("สร้างสลิปและส่งเข้าคิวให้ Admin ตรวจ Manual")}</p><button disabled={busy} onClick={async()=>{try{const slip=await api<{reference:string;document:Document}>(`/payments/${invoice.id}/demo-slip`,{});await perform(`/invoices/${invoice.id}/proof`,slip,"ส่งสลิป dummy ให้ Admin ตรวจแล้ว");}catch(e){setError(e instanceof Error?e.message:translateSystem("สร้างสลิปไม่สำเร็จ"))}}}>{translateSystem("สร้างและแนบสลิป dummy")}</button>{error&&<p role="alert">{error}</p>}</div>}
      {invoice.status === "pending" && !admin && (
        <div className="portal-form">

          {!demo&&invoice.paymentInstructions===null&&<p className="form-message">{translateSystem("ใบแจ้งชำระนี้สร้างก่อนระบบบันทึกข้อมูลบัญชี ณ ตอนสร้าง โปรดยืนยันข้อมูลรับชำระกับทีมงานก่อนโอน")}</p>}
          {(
            <>
              <label>
                <span>{translateSystem("เลขอ้างอิงการโอน")}</span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
              <label>
                <span>{translateSystem("หลักฐานการชำระเงิน (ไม่เกิน 2 MB)")}</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => selectProof(e.target.files?.[0])}
                />
              </label>
              <button
                disabled={busy || reading || !file || !reference.trim()}
                className="primary-button"
                onClick={() =>
                  void perform(
                    `/invoices/${invoice.id}/proof`,
                    { document: file, reference },
                    "ส่งหลักฐานชำระเงินให้ Admin แล้ว",
                  )
                }
              >
                {translateSystem("ส่งหลักฐานการชำระ")}</button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      {invoice.proof && admin && (
        <a href={invoice.proof.data} className="outline-button" download>
          {translateSystem("ดาวน์โหลดสลิป ·")}{" "}{invoice.proof.name}
        </a>
      )}
      {invoice.status === "submitted" && admin && (
        <div className="portal-form">
          <p>{translateSystem("เลขอ้างอิง:")}{" "}{invoice.reference} {" "}{translateSystem("· ตรวจยอดเข้าบัญชีก่อนยืนยัน")}</p>
          <label><span>{translateSystem("เลขธุรกรรมธนาคารที่ตรวจสอบแล้ว")}</span><input value={bankTransaction} onChange={e => setBankTransaction(e.target.value)} /></label>
          <label>
            <span>{translateSystem("เหตุผลหากไม่ผ่าน")}</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="button-row">
            <button
              disabled={busy}
              className="primary-button"
              onClick={() =>
                void perform(
                  `/invoices/${invoice.id}/confirm`,
                  { externalTransactionId: bankTransaction },
                  "บันทึกรับชำระแล้ว Villa รอ Admin ตรวจสอบและอนุมัติ",
                )
              }
            >
              {translateSystem("ยืนยันได้รับชำระ (รออนุมัติ Villa)")}</button>
            <button
              disabled={busy || !reason.trim()}
              className="outline-button"
              onClick={() =>
                void perform(
                  `/invoices/${invoice.id}/reject`,
                  { reason },
                  "ส่งกลับให้ Merchant แนบสลิปใหม่แล้ว",
                )
              }
            >
              {translateSystem("ไม่ผ่าน / แนบสลิปใหม่")}</button>
          </div>
        </div>
      )}
    </div>
  )
}
