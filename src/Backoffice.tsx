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

const date = (value: string) =>
  value
    ? new Date(value).toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "ยังไม่เปิดใช้งาน"
function status(v: MerchantVilla) {
  if (v.status === "pending") return "รออนุมัติจาก Admin"
  if (v.status === "changes") return "ต้องแก้ไขเอกสาร"
  if (v.status === "rejected") return "ไม่ผ่านการอนุมัติ"
  if (["SUSPENDED","INACTIVE"].includes(v.qrStatus))return "QR ถูกระงับหรือปิดใช้งาน"
  if (!v.qr) return "อนุมัติแล้ว · รอชำระเงิน"
  return v.trialUnlimited ? "QR ใช้งานได้ · Basic Verify · สิทธิ์โปรโมชั่น" : new Date(v.expires) <= new Date() ? "QR หมดอายุ" : "QR ใช้งานได้"
}
const approvalStatus = (value: MerchantVilla["status"]) => ({pending:"รออนุมัติ",approved:"อนุมัติแล้ว",changes:"ต้องแก้ไข",rejected:"ไม่อนุมัติ"})[value];
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
      <small>{villa.trialUnlimited ? "Basic Verify · สิทธิ์โปรโมชั่นเดิมยังคงอยู่" : `หมดอายุ ${date(villa.expires)}`}</small>
      <a href={admin?`/admin#${new URLSearchParams({page:"admin-verify",item:villa.qr})}`:url}>เปิดหน้าตรวจสอบ ↗</a>
      {downloadUrl && <a className="outline-button" href={downloadUrl} download={`VillaCheck-${villa.qr}.svg`}>ดาวน์โหลด QR (SVG)</a>}
    </div>
  )
}

function VillaPhotoInput({url,photo,onChange}:{url:string;photo:Document|null;onChange:(value:Document|null)=>void}){
 const [error,setError]=useState("");
 const inputRef=useRef<HTMLInputElement>(null);
 return <div><label>อัปโหลด / เปลี่ยนรูป Villa (JPG, PNG ไม่เกิน 2 MB)<input ref={inputRef} style={{display:"none"}} type="file" accept="image/jpeg,image/png" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;setError("");if(!["image/jpeg","image/png"].includes(f.type)||f.size>2*1024*1024){setError("เลือกรูป JPG หรือ PNG ไม่เกิน 2 MB");return;}try{const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(f)});onChange({name:f.name,type:f.type,data});}catch{setError("อ่านรูปไม่สำเร็จ")}}}/></label><div className="button-row"><button type="button" className="outline-button" onClick={()=>inputRef.current?.click()}>Browse</button><span>{photo?.name||"JPG / PNG"}</span></div>{(photo?.data||url)&&<img src={photo?.data||url} alt="รูป Villa ที่เลือก" style={{width:"100%",maxHeight:300,objectFit:"cover",borderRadius:12}}/>}{photo&&<button type="button" onClick={()=>onChange(null)}>ยกเลิกรูปที่เลือก</button>}{error&&<p role="alert">{error}</p>}</div>
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
  const admin = page.startsWith("admin-")
  const [store, setStore] = useState<Store | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [selected, setSelected] = useState(initialItem)
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [upload, setUpload] = useState<Document | null>(null)
  const [uploading, setUploading] = useState(false)
  const [mailOpen, setMailOpen] = useState("")
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
          catch(e) { if(!cancelled)setMessage(e instanceof Error ? e.message : "Payment QR ไม่พร้อมใช้งาน") }
        }
        if (!cancelled && !busyRef.current) setStore(next)
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 401) { if(page === "owner-package")sessionStorage.setItem("villacheck-merchant-return","owner-package"); go(admin ? "admin-login" : "owner-auth"); }
          else
            setMessage(
              error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ",
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
      setMessage(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ")
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
      setMessage("กรุณาเลือก PDF, JPG หรือ PNG ขนาดไม่เกิน 2 MB")
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
      setMessage("อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่")
    } finally {
      setUploading(false)
    }
  }
  const [photo,setPhoto]=useState<Document|null>(null);
  useEffect(()=>setPhoto(null),[selected,page]);
  const initializedEdit = useRef("");
  useEffect(()=>{
    if(page !== "owner-villa-edit") initializedEdit.current = "";
    const v=store?.villas.find(v=>v.id===initialItem);
    if(!v)return;
    if(page === "owner-villa-edit" && initializedEdit.current === v.id) return;
    if(page === "owner-villa-edit") initializedEdit.current = v.id;
    setSelected(v.id);
    setForm(current=>({...current,name:v.name,nameEn:v.nameEn || "",photoTakenAt:v.photoTakenAt || "",province:v.province,merchant:v.merchant,email:v.email,guestCapacity:v.guestCapacity == null ? "" : String(v.guestCapacity),photoUrl:v.photoUrl||"",phone:v.phone,bankName:v.bankName,accountName:v.accountName,accountNumber:v.accountNumber,package:v.packageId}));
  },[initialItem,store,page]);
  useEffect(()=>{if(!admin&&store?.villas.length&&["owner-add-villa","owner-onboarding-villa"].includes(page)){const existing=store.villas.find(v=>v.id===initialItem)||store.villas[0];go("owner-villa-edit",existing.id);}},[page,store,admin,initialItem]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if(store?.villas.length){go("owner-villa-edit",store.villas[0].id);return;}
    if (!upload) {
      setMessage("กรุณาแนบเอกสารแสดงกรรมสิทธิ์ Villa ก่อนส่งตรวจสอบ")
      return
    }
    const next = await perform(
      "/villas",
      {
        ...form,
        packageId: store?.subscription?.packageId,
        document: upload,
        photo,
      },
      "ส่ง Villa ให้ Admin ตรวจสอบแล้ว",
    )
    if (next) {
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
        <h1>{loading ? "กำลังโหลดข้อมูล" : "โหลดข้อมูลไม่สำเร็จ"}</h1>
        <p role="alert">{message}</p>
        <button
          className="outline-button"
          onClick={() => window.location.reload()}
        >
          ลองใหม่
        </button>
      </PortalShell>
    )
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
  const paymentVilla = page === "owner-package" && initialItem ? store.villas.find(v=>v.invoices.some(i=>i.id===initialItem)) : undefined
  const paymentInvoice = paymentVilla?.invoices.find(i=>i.id===initialItem)
  if (paymentInvoice && paymentVilla) return <PortalShell role="Merchant" page={page} go={go}>
    <button type="button" className="text-button" onClick={()=>go("owner-package")}>← กลับไปเลือกแพ็กเกจ</button>
    <h1>ชำระเงินแพ็กเกจ</h1><p>{paymentVilla.name} · {paymentInvoice.packageName} · รวมภาษี</p>
    {message&&<p role="status">{message}</p>}
    <PaymentPanel key={paymentInvoice.id} invoice={paymentInvoice} admin={false} instructions={paymentInvoice.paymentInstructions ?? store.paymentInstructions} configured={store.paymentConfigured} demo={store.demoMode} busy={busy} perform={perform}/>
  </PortalShell>
  return (
    <PortalShell role={admin ? "Admin" : "Merchant"} page={page} go={go}>
      {page === "owner-dashboard" && displayName && <p className="user-greeting">สวัสดีคุณ {displayName}</p>}
      <div className="portal-head">
        <div>
          <span className="kicker">
            {admin ? "OPERATIONS / VILLACHECK" : "YOUR PROPERTY, VERIFIED"}
          </span>
          <h1>
            {adding
              ? "เพิ่ม Villa"
              : billing
                  ? "แพ็กเกจและการชำระเงิน"
                  : page === "admin-owners"
                    ? "Merchants"
                    : page === "admin-qr"
                      ? "ทะเบียน QR"
                      : dashboard
                        ? admin ? "Admin Dashboard" : "Member Room"
                        : "Villa ของคุณ"}
          </h1>
          <p>1 Villa = 1 QR · อายุใช้งานตามแพ็กเกจและใบแจ้งชำระ · ต่ออายุใช้ QR เดิม</p>
        </div>
        {!admin && !adding && (
          <button
            className="primary-button"
            disabled={false}
            onClick={() => go("owner-add-villa")}
          >
            + เพิ่ม Villa
          </button>
        )}
      </div>
      <div className="merchant-demo">
        แพ็กเกจคิดต่อที่พัก ต่อเดือน รวมภาษี · แต่ละที่พักต้องผ่าน Admin อนุมัติ
        · Basic Verify ราคาปกติ 990 บาท ช่วงโปรโมชั่นลด 100%
      </div>

      {!admin && (billing || dashboard || (adding && !store.subscription)) && <VillaPackagePanel store={store} busy={busy} perform={perform} onAdd={()=>go("owner-add-villa")} onPayment={invoiceId=>go("owner-package",invoiceId)}/>}
      {billing && <section className="merchant-panel" id="package-payments"><h2>{admin ? "ตรวจสอบการชำระเงิน" : "การชำระแพ็กเกจต่อที่พัก"}</h2><p>แต่ละใบแจ้งชำระระบุที่พักและแพ็กเกจของตัวเอง ราคาต่อเดือนรวมภาษี</p>{!store.villas.some(v => v.invoices.length > 0) && <p>ยังไม่มีใบแจ้งชำระ</p>}{[...new Map(store.villas.flatMap(v => v.invoices).map(invoice => [invoice.id, invoice])).values()].map(invoice => <PaymentPanel key={invoice.id} invoice={invoice} admin={admin} instructions={store.demoMode ? store.paymentInstructions : (invoice.paymentInstructions ?? store.paymentInstructions)} configured={store.paymentConfigured}
                      demo={store.demoMode} busy={busy} perform={perform} />)}</section>}
      {message && (
        <div className="form-message" role="status">
          {message}
        </div>
      )}
      {!admin && dashboard && <><OwnerVerification/><Reviews mode="merchant"/><Advertising merchant/></>}
      {dashboard && (
        <>
          <div className="metric-grid">
            {[
              ["Villa ทั้งหมด", store.villas.length],
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
                "รอชำระเงิน",
                store.villas.filter((v) => v.paymentPending).length,
              ],
            ].map(([label, count]) => (
              <div className="metric-card" key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
                <small>อัปเดตจากรายการในระบบ</small>
              </div>
            ))}
          </div>
          {admin&&<section className="merchant-panel"><h2>งานดูแลหน้าบ้าน</h2><p>ตรวจข้อมูลและสิทธิ์ให้ครบก่อนแสดงต่อผู้ค้นหาที่พัก</p><div className="button-row">{([["admin-cms","เนื้อหาเว็บไซต์ / ข่าวสาร"],["admin-pending-villas","ตรวจที่พัก"],["admin-owner-verification","ยืนยันเจ้าของบ้าน"],["admin-reviews","กลั่นกรองรีวิว"],["admin-advertising","โฆษณา / ไฟล์ Social"],["admin-subscriptions","สิทธิ์รายที่พัก"],["admin-users","บัญชี User"],["admin-owners","บัญชี Merchant"]] as [Page,string][]).map(([target,label])=><button key={target} onClick={()=>go(target)}>{label}</button>)}</div></section>}
          <div className="merchant-steps">
            {[
              "01 สมัคร Merchant และเพิ่มที่พักฟรี",
              "02 ส่งเอกสารให้ทีมตรวจสอบ",
              "03 ทีมอนุมัติตามเกณฑ์",
              "04 1 Villa ได้ 1 QR แยกกัน",
            ].map((step) => (
              <span key={step}>{step}</span>
            ))}
          </div>
        </>
      )}
      {adding ? (
        <form className="portal-form merchant-panel" onSubmit={submit}>
          <h2>ข้อมูลที่พักและ Merchant</h2>
          <p>กรอกชื่อที่พักทั้งภาษาไทยและภาษาอังกฤษ เพื่อให้ลูกค้าค้นหาได้จากทั้งสองชื่อ ใช้ชื่อเดียวกับป้ายที่พักและช่องทางทางการ</p>
          <div className="merchant-form-grid">
            {([
              ["name", "ชื่อที่พักภาษาไทย"],
              ["nameEn", "ชื่อที่พักภาษาอังกฤษ"],
              ["province", "จังหวัด"],
              ["merchant", "ชื่อ Merchant / บริษัท"],
              ["email", "อีเมลรับแจ้งชำระเงิน"],
              ["photoUrl", "URL รูป Villa (HTTPS)"],
              ["phone", "เบอร์โทรทางการของ Villa"],
              ["bankName", "ธนาคารรับเงิน"],
              ["accountName", "ชื่อบัญชีรับเงิน"],
              ["accountNumber", "เลขที่บัญชีรับเงิน"],
            ] as const).map(([key, label]) => (
              <label key={key}>
                <span>{label} *</span>
                <input
                  required={key !== "photoUrl"}
                  type={key === "email" ? "email" : "text"}
                  placeholder={key === "name" ? "เช่น บ้านริมทะเล พัทยา" : key === "nameEn" ? "เช่น Seaside Pattaya Villa" : undefined}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <label><span>จำนวนผู้พักสูงสุด</span><input type="number" min="1" max="1000" step="1" value={form.guestCapacity} onChange={e=>setForm({...form,guestCapacity:e.target.value})}/></label><VillaPhotoInput url={form.photoUrl} photo={photo} onChange={setPhoto}/><label>วันที่ถ่ายภาพ (หากทราบ)<input type="date" value={form.photoTakenAt} onChange={e=>setForm({...form,photoTakenAt:e.target.value})}/></label>
          <label className="merchant-upload">
            <strong>แนบหลักฐานการเป็นเจ้าของ Villa *</strong>
            <span>
              เช่น โฉนด หรือเอกสารแสดงกรรมสิทธิ์ · PDF, JPG, PNG ไม่เกิน 2 MB
            </span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
            <small>
              {uploading ? "กำลังอ่านเอกสาร…" : upload?.name || "ยังไม่ได้แนบเอกสาร"}
            </small>
          </label>
          <p>Admin จะตรวจเอกสารก่อนอนุมัติ จากนั้นแจ้งให้ชำระแพ็กเกจทางอีเมล</p>
          <button
            type="submit"
            className="primary-button"
            disabled={uploading || busy}
          >
            ส่งให้ Admin ตรวจสอบ →
          </button>
        </form>
      ) : (
        <>
          {!billing && !editing && !detailPage && <>
          {page === "owner-villas" && <p role="status">Villa ของคุณทั้งหมด {store.villas.length} รายการ · แสดง {list.length} รายการ</p>}
          <div className="merchant-toolbar">
            <input
              aria-label="ค้นหา Villa หรือ Merchant"
              placeholder="ค้นหา Villa หรือ Merchant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="กรองสถานะ"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">ทุกสถานะ</option>
              {billing && ["WAITING_FOR_SLIP","PENDING_REVIEW","VERIFIED","REJECTED"].map(s=><option key={s} value={s}>{s}</option>)}
              {!billing&&<option value="pending">รอตรวจสอบ</option>}
              {!billing&&<option value="approved">อนุมัติแล้ว</option>}
              {!billing&&<option value="changes">ต้องแก้ไข</option>}
              {!billing&&<option value="rejected">ไม่อนุมัติ</option>}
            </select>
          </div>
          {!list.length && (
            <div className="merchant-empty">
              <span>◇</span>
              <h2>
                {store.villas.length ? "ไม่พบรายการที่ค้นหา" : "เริ่มต้นจาก Villa แรก"}
              </h2>
              <p>
                {admin
                  ? "รายการที่ Merchant ส่งพร้อมเอกสารจะปรากฏที่นี่"
                  : "เพิ่มที่พักและแนบหลักฐานกรรมสิทธิ์เพื่อเริ่มรับการตรวจสอบ"}
              </p>
              {!admin && (
          <button
            className="primary-button"
            disabled={false}
            onClick={() => go("owner-add-villa")}
                >
                  + เพิ่ม Villa
                </button>
              )}
            </div>
          )}
          <div className="merchant-list">
            {list.map((v) => (
              <article className="merchant-panel merchant-villa" key={v.id}>
                {v.photoUrl&&<img src={v.photoUrl} alt={v.name} style={{width:"100%",height:220,objectFit:"cover",borderRadius:12,marginBottom:16}}/>}
                <div className="merchant-villa-top">
                  <div>
                    <small>
                      {v.province} · MERCHANT {v.merchant}
                    </small>
                    <h2>{v.name}</h2>
                    <p>{v.email}</p>
                  </div>
                  {v.premiumBanner&&<span className="merchant-status">Premium Verified</span>}
                  <span className={`merchant-status ${v.status}`}>
                    {approvalStatus(v.status)}
                  </span>
                </div>
                <div className="merchant-villa-meta">
                  <span>
                    แพ็กเกจ<strong>{v.package}</strong>
                  </span>
                  <span>จำนวนผู้เข้าพักสูงสุด<strong>{v.guestCapacity == null ? "ไม่ได้ระบุ" : `${v.guestCapacity} คน`}</strong></span>
                  <span>
                    วันหมดอายุ<strong>{date(v.expires)}</strong>
                  </span>
                </div>
                {v.reason && (
                  <p className="merchant-reason">เหตุผลจาก Admin: {v.reason}</p>
                )}
                <div className="button-row">
                  {admin ? <>
                    <a className="outline-button" href={`${v.document.data}?preview=1`} target="_blank" rel="noreferrer">เปิดเอกสารที่แนบ</a>
                    {v.status === "pending" && <button className="primary-button" onClick={()=>go("admin-pending-villas")}>เปิดคิว Villa รออนุมัติ</button>}
                    {v.status === "approved" && <button className="primary-button" onClick={()=>go("admin-approved-villas")}>ดู Villa ที่อนุมัติแล้ว</button>}
                  </> : <button
                    className="outline-button"
                    onClick={() => showDetails(v)}
                  >
                    ดูรายละเอียด Villa
                  </button>}
                  {!admin&&<button className="primary-button" onClick={()=>showDetails(v,true)}>แก้ไขข้อมูล Villa / เปลี่ยนรูป</button>}
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
              <section className="merchant-panel merchant-detail">
                {!admin&&<div className="button-row"><button className="outline-button" onClick={()=>go("owner-villas")}>กลับรายการ Villa</button>{!editing&&<button className="primary-button" onClick={()=>showDetails(active,true)}>แก้ไขข้อมูล Villa / เปลี่ยนรูป</button>}</div>}
                {!admin&&editing&&<form className="portal-form" onSubmit={async e=>{
                  e.preventDefault();
                  if(busyRef.current)return;
                  busyRef.current=true;setBusy(true);setMessage("");
                  try{
                    await api(`/merchant/villas/${active.id}`,{...form,photo});
                    setPhoto(null);
                    setMessage("บันทึกสำเร็จ · รออนุมัติจาก Admin โดยคง QR เดิม");
                    try{
                      const next=await api<Store>("/state");
                      setStore(next);
                      const saved=next.villas.find(v=>v.id===active.id);
                      if(saved)setForm(current=>({...current,photoUrl:saved.photoUrl||""}));
                    }
                    catch{setMessage("บันทึกและส่งตรวจใหม่สำเร็จแล้ว แต่โหลดสถานะล่าสุดไม่สำเร็จ กรุณารีเฟรชหน้า");}
                  }catch(error){
                    if(error instanceof ApiError && error.status===401)go(admin ? "admin-login" : "owner-auth");
                    setMessage(error instanceof Error?error.message:"บันทึกไม่สำเร็จ กรุณาลองใหม่");
                  }finally{busyRef.current=false;setBusy(false);}
                }}><h2>แก้ไขข้อมูล Villa</h2><p role="status" className="merchant-status">สถานะ: {status(active)}</p><label><span>จำนวนผู้พักสูงสุด</span><input type="number" min="1" max="1000" step="1" value={form.guestCapacity} onChange={e=>setForm({...form,guestCapacity:e.target.value})}/></label><VillaPhotoInput url={form.photoUrl} photo={photo} onChange={setPhoto}/><label>วันที่ถ่ายภาพ (หากทราบ)<input type="date" value={form.photoTakenAt} onChange={e=>setForm({...form,photoTakenAt:e.target.value})}/></label><p>การแก้ข้อมูลจะส่งให้ Admin ตรวจใหม่ และออก QR ใหม่หลังอนุมัติ</p>{(["name","nameEn","province","merchant","phone","bankName","accountName","accountNumber"] as const).map(k=><label key={k}>{({name:"ชื่อที่พักภาษาไทย",nameEn:"ชื่อที่พักภาษาอังกฤษ"} as Record<string,string>)[k] || k}<input required={["name","nameEn","province","merchant"].includes(k)} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}{message&&<p role="status" aria-live="polite">{message}</p>}<button type="submit" disabled={busy} className="primary-button">{busy?"กำลังบันทึกและส่งตรวจ…":"บันทึกและส่งตรวจใหม่"}</button></form>}
                {!editing&&active.photoUrl&&<img src={active.photoUrl} alt={active.name} style={{width:"100%",maxHeight:360,objectFit:"cover",borderRadius:12}}/>}
                <PropertyMedia villaId={active.id} mode={admin?"admin":"merchant"}/>
                {!admin&&!editing&&<><OwnerVerification villaId={active.id}/><SocialMaterials villaId={active.id}/></>}
                <h2>เอกสารกรรมสิทธิ์ · {active.name}</h2>
                <p>{active.document.name}</p>
                <div className="merchant-villa-meta">
                  <span>เบอร์โทรทางการ<strong>{active.phone || "ยังไม่ได้ระบุ"}</strong></span>
                  <span>บัญชีรับเงิน<strong>{active.bankName || "ยังไม่ได้ระบุ"} · {active.accountNumber || "—"}</strong></span>
                  <span>ชื่อบัญชี<strong>{active.accountName || "ยังไม่ได้ระบุ"}</strong></span>
                </div>
                <a
                  className="outline-button"
                  href={active.document.data}
                  download={active.document.name}
                >
                  ดาวน์โหลดเอกสาร
                </a>
                {active.document.type.startsWith("image/") && (
                  <img
                    className="merchant-document"
                    src={active.document.data}
                    alt="เอกสารกรรมสิทธิ์ Villa"
                  />
                )}
                {!admin && ["changes", "rejected"].includes(active.status) && (
                  <div className="portal-form">
                    <label>
                      <span>แนบเอกสารใหม่เพื่อส่งตรวจอีกครั้ง</span>
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
                      ส่งตรวจสอบอีกครั้ง
                    </button>
                  </div>
                )}
                {!editing && active.qr && <VillaQr villa={active} admin={admin} />}
              </section>
            )}
          {(admin || billing) && (
            <section className="merchant-panel merchant-mail">
              <h2>
                ประวัติการส่งอีเมล <small>{store.mails.length} รายการ</small>
              </h2>
              <p>
                {store.demoMode ? "DEMO · อีเมลถูกบันทึกให้ตรวจดูในระบบ ไม่ส่งผ่าน SMTP จริง" : store.smtpConfigured
                  ? "ส่งผ่าน SMTP อัตโนมัติ มีการลองใหม่เมื่อส่งไม่สำเร็จ"
                  : "ยังไม่ได้ตั้งค่า SMTP · อีเมลเก็บในคิวและจะส่งเมื่อเชื่อมบริการแล้ว"}
              </p>
              {!store.mails.length && <p>ยังไม่มีอีเมลแจ้งชำระเงิน</p>}
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
                        ถึง {mail.to} · {date(mail.created)} ·{" "}
                        {mail.status === "sent"
                          ? "ส่งแล้ว"
                          : mail.status === "demo" ? "DEMO · เก็บอีเมล ไม่ส่งจริง"
                          : mail.status === "waiting_config"
                            ? "รอตั้งค่า SMTP"
                            : mail.status === "failed"
                              ? "ส่งไม่สำเร็จ"
                              : "กำลังรอส่ง"}
                      </small>
                    </span>
                    <span>ดูอีเมล ↗</span>
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
                          ลองส่งอีกครั้ง
                        </button>
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
  const activityLogged = useRef("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setVilla(null)
    setError("")
    void api<{ villaId?:string; propertyDetails?:Details|null; nameEn?: string; basicVerificationNotice?: string | null; ownerVerificationRequired?: boolean; ownerVerification?: {status:string;reviewedAt:string;method:string} | null; trialUnlimited?: boolean; photoUploadedAt?: string | null; photoTakenAt?: string | null; photoReviewedAt?: string | null; photoUrl: string; verificationLevel: string; premiumBanner: boolean; qrStatus: string; merchantName: string; name: string; province: string; expires: string; valid: boolean; locked: boolean; viewerRole?: string; phone?: string; bankName?: string; accountName?: string; accountNumber?: string }>(
      `${adminView?"/admin/qr-verification":"/public/qr"}/${encodeURIComponent(reference)}`,
    )
      .then((value) => {
        if (!cancelled) {
          setVilla(value)
          if(preview || value.viewerRole==="admin")return
          const activityKey=reference+":"+value.locked
          if(activityLogged.current===activityKey)return
          activityLogged.current=activityKey
          void api("/public/events",{qr:reference,kind:"PROFILE_VIEW"}).catch(()=>{})
          if(sessionStorage.getItem("villacheck-scan-reference")===reference){sessionStorage.removeItem("villacheck-scan-reference");void api("/public/events",{qr:reference,kind:"QR_SCAN"}).catch(()=>{})}
          if(!value.locked){
            void api("/public/events",{qr:reference,kind:"CONTACT_VIEW"}).catch(()=>{})
            void currentAccount().then(()=>api("/user/checks",{qr:reference,requestKey:crypto.randomUUID()})).catch(()=>{})
          }
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
  }, [reference,adminView])
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
      else setError(error instanceof Error?error.message:"กลับหน้าบัญชีไม่สำเร็จ กรุณาลองใหม่");
    }finally{setReturning(false);}
  };
  return (
    <main className="page-bg">
      <div className="container"><HomeLogoLink className="logo-button" onNavigate={()=>go("home")}>VillaCheck</HomeLogoLink></div>
      <div className="container merchant-verification merchant-panel">
        <span className="kicker">{isAdmin?"VILLACHECK / ADMIN PROPERTY DETAILS":"VILLACHECK / PROPERTY DETAILS"}</span>
        <h1>
          {loading ? "กำลังโหลดรายละเอียดที่พัก…" : villa?.name || (villa?"ข้อมูลที่พักอยู่ระหว่างตรวจสอบ":"ไม่พบรายละเอียดที่พัก")}
        </h1>
        {error && <p role="alert">{error}</p>}
        {villa && (
          <>
            <div className="property-detail-intro"><p>{villa.nameEn}</p><p>{villa.province} · {villa.merchantName}</p>{villa.photoUrl&&<img className="property-detail-cover" src={villa.photoUrl} alt={villa.name}/>}{villa.propertyDetails&&<PropertyDetails details={villa.propertyDetails}/>}<h2>ข้อมูลและสถานะของที่พัก</h2></div>
            <span className="merchant-status">
              {villa.valid
                ? "QR ใช้งานได้ · Admin อนุมัติแล้ว"
                : ({EXPIRED:"QR หมดอายุ",SUSPENDED:"QR ถูกระงับ",INACTIVE:"QR ปิดใช้งาน",PENDING:"QR อยู่ระหว่างรออนุมัติ"} as Record<string,string>)[villa.qrStatus] || "QR ไม่พร้อมใช้งาน"}
            </span>
            {villa.ownerVerificationRequired && !villa.ownerVerification && <p className="verification-reminder">ยังไม่ผ่านการยืนยันเจ้าของบ้านด้วยใบหน้าและทะเบียนบ้าน</p>}
            {villa.ownerVerification && <p className="merchant-status">ยืนยันเจ้าของบ้านแล้ว · {villa.ownerVerification.method} · {date(villa.ownerVerification.reviewedAt)}</p>}
            {villa.basicVerificationNotice && <p className="verification-reminder">{villa.basicVerificationNotice}</p>}
            <p>{villa.nameEn}</p><p>อัปเดตรูปภาพล่าสุดเมื่อ {villa.photoUploadedAt ? date(villa.photoUploadedAt) : "ไม่ระบุ"}</p>{villa.photoUrl && <p>วันที่อัปโหลด: {villa.photoUploadedAt ? date(villa.photoUploadedAt) : "ไม่ระบุ"} · วันที่ถ่าย: {villa.photoTakenAt ? date(villa.photoTakenAt) : "ไม่ระบุ"}{villa.photoReviewedAt && <> · วันที่ทีมตรวจสื่อ: {date(villa.photoReviewedAt)}</>}</p>}<p>{villa.province} · {villa.merchantName} · {villa.verificationLevel} · {villa.qrStatus}</p>
            {villa.premiumBanner && <p className="merchant-status">✦ Premium Verified · เอกสารผ่านและ Subscription ใช้งานได้</p>}
            {villa.name&&<a href={`https://www.google.com/maps/search/?${new URLSearchParams({api:"1",query:`${villa.name} ${villa.province}`})}`} target="_blank" rel="noopener noreferrer">{t("profile.map")}</a>}
            <p>วันหมดอายุ: {villa.trialUnlimited ? "ยังไม่มีวันสิ้นสุดที่ยืนยัน · Basic โปรโมชั่น" : date(villa.expires)}</p>
            {!isAdmin&&<button onClick={()=>go("villa-report",reference)}>{t("profile.report")}</button>}
            <section className={`verification-contact ${villa.locked ? "locked" : ""}`}>
              <div className="verification-contact-head"><h2>{t("profile.contacts")}</h2><span>{isAdmin?"ข้อมูลเต็มสำหรับ Admin":villa.locked ? "ข้อมูลส่วนบุคคลถูกปกปิด" : "ข้อมูลทะเบียน"}</span></div>
              <dl>
                <div><dt>{t("profile.phone")}</dt><dd>{villa.locked ? "•••-•••-••••" : villa.phone || "ยังไม่ได้ระบุ"}</dd></div>
                <div><dt>{t("profile.bank")}</dt><dd>{villa.bankName || "ยังไม่ได้ระบุ"}</dd></div>
                <div><dt>{t("profile.bankName")}</dt><dd>{villa.locked ? "ข้อมูลถูกปกปิด" : villa.accountName || "ยังไม่ได้ระบุ"}</dd></div>
                <div><dt>{t("profile.bankNumber")}</dt><dd>{villa.locked ? "•••-•-•••••-•" : villa.accountNumber || "ยังไม่ได้ระบุ"}</dd></div>
              </dl>
              {villa.locked && !isAdmin ? <div className="verification-login"><p>กรอกเลขบัญชีหรือเบอร์ที่ได้รับในหน้าตรวจข้อมูลก่อนโอน ระบบจะแจ้งว่าตรงกับทะเบียนหรือไม่ โดยไม่เปิดเผยข้อมูลเต็ม</p><div className="button-row"><button className="primary-button" onClick={() => go(villa.viewerRole === "user"?"user-precheck":"login", reference)}>{villa.viewerRole === "user"?"ตรวจข้อมูลก่อนโอน":"เข้าสู่ระบบเพื่อตรวจข้อมูล"}</button><button className="outline-button" onClick={() => go("user-registration", reference)}>สมัครสมาชิก User</button></div></div> : <p className="verification-reminder">{isAdmin?"ข้อมูลทะเบียนสำหรับผู้ดูแลระบบ":t("profile.contactReminder")}</p>}
            </section>
          </>
        )}
        {villa?.name && <>{isAdmin&&villa.villaId&&villa.ownerVerificationRequired&&<OwnerVerification admin villaId={villa.villaId}/>}<PropertyMedia key={`media-${reference}`} qr={reference} villaId={villa.villaId} mode={isAdmin?"admin":"public"}/><Reviews qr={reference} mode={isAdmin?"admin":"public"}/></>}
        <p>QR Reference: {reference}</p>
        <button className="outline-button" disabled={returning} onClick={()=>void backToAccount()}>
          {returning?"กำลังกลับหน้าบัญชี…":isAdmin?"กลับหน้าก่อนหน้า Admin":villa?.viewerRole==="merchant"?"กลับหน้าหลัก Merchant":villa?.viewerRole==="user"?"กลับหน้าหลัก User":"กลับหน้าหลัก"}
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
  if(invoice.paymentAccessMode==="DISABLED"||invoice.paymentAccessMode==="OMISE_TEST")return <section className="payment-panel"><strong>ประวัติใบแจ้งชำระ ฿{invoice.amount.toLocaleString("th-TH")}</strong><p>ปิดรับชำระ manual รายการเดิมเก็บไว้สำหรับตรวจสอบ กรุณาติดต่อผู้ดูแลหากเคยโอนแล้ว</p></section>
  const selectProof = (selected?: File) => {
    setFile(null)
    setError("")
    if (!selected) return
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(selected.type) ||
      selected.size > 2 * 1024 * 1024
    ) {
      setError("ใช้ PDF, JPG, PNG ไม่เกิน 2 MB")
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
      setError("อ่านไฟล์ไม่สำเร็จ")
      setReading(false)
    }
    reader.readAsDataURL(selected)
  }
  return (
    <div className="payment-panel">
      <strong>
        ใบแจ้งชำระ{invoice.scope === "merchant" ? "แพ็กเกจ Merchant" : " Villa"} ฿{invoice.amount.toLocaleString("th-TH")} · อายุ QR{" "}
        {invoice.months} เดือน
      </strong>
      <small>{invoice.id} · {invoice.packageName} · สร้าง {date(invoice.created)}</small>
      <p>Payment: {invoice.paymentStatus} · QR: {invoice.paymentQr?.status||"ไม่มี QR"} · หมดอายุ {date(invoice.paymentQr?.expiresAt||"")}</p>
      {invoice.proof&&<p>อัปเดตหลักฐาน {new Date(invoice.updatedAt).toLocaleString("th-TH")}</p>}
          <h3>บัญชีธนาคารรับชำระที่ Admin ตั้งไว้</h3><p className="payment-instructions">{instructions}</p>
          <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(`VillaCheck · ${invoice.id}\n${invoice.packageName} · THB ${invoice.amount}\n${instructions}`)}`} download={`payment-${invoice.id}.txt`}>ดาวน์โหลดรายละเอียดบัญชีและยอดชำระ</a>
          {!demo && invoice.bankQrImage && <section className="bank-payment-details"><h3>QR โอนเงินเข้าบัญชีรับชำระ</h3><img src={invoice.bankQrImage} alt="QR บัญชีรับชำระของ VillaCheck" style={{width:240,maxWidth:"100%",objectFit:"contain"}}/><p>ตรวจชื่อผู้รับและยอดตามใบแจ้งชำระก่อนยืนยันโอน จากนั้นแนบสลิปเพื่อให้ Admin ตรวจ</p><a href={invoice.bankQrImage} target="_blank" rel="noopener noreferrer" download>เปิด / ดาวน์โหลด QR รับชำระ</a></section>}
      {!admin && invoice.status === "pending" && <PaymentQr paymentId={invoice.id} initial={invoice.paymentQr} />}
      <p>
        {invoice.status === "paid"
          ? `ยืนยันชำระแล้ว ${date(invoice.paidAt || "")}`
          : invoice.paymentStatus === "REJECTED" ? "สลิปถูกปฏิเสธ กรุณาแนบใหม่"
          : invoice.status === "submitted"
            ? "แนบสลิปแล้ว รอ Admin ตรวจยืนยัน"
            : "รอชำระเงินและแนบสลิป"}
      </p>
      {invoice.reason && <p>เหตุผลจาก Admin: {invoice.reason}</p>}
      {demo && invoice.status === "pending" && !admin && <div className="merchant-panel"><strong>DEMO · ไม่มีการโอนเงินจริง</strong><p>สร้างสลิปและส่งเข้าคิวให้ Admin ตรวจ Manual</p><button disabled={busy} onClick={async()=>{try{const slip=await api<{reference:string;document:Document}>(`/payments/${invoice.id}/demo-slip`,{});await perform(`/invoices/${invoice.id}/proof`,slip,"ส่งสลิป dummy ให้ Admin ตรวจแล้ว");}catch(e){setError(e instanceof Error?e.message:"สร้างสลิปไม่สำเร็จ")}}}>สร้างและแนบสลิป dummy</button>{error&&<p role="alert">{error}</p>}</div>}
      {invoice.status === "pending" && !admin && (
        <div className="portal-form">

          {!demo&&invoice.paymentInstructions===null&&<p className="form-message">ใบแจ้งชำระนี้สร้างก่อนระบบบันทึกข้อมูลบัญชี ณ ตอนสร้าง โปรดยืนยันข้อมูลรับชำระกับทีมงานก่อนโอน</p>}
          {(
            <>
              <label>
                <span>เลขอ้างอิงการโอน</span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
              <label>
                <span>หลักฐานการชำระเงิน (ไม่เกิน 2 MB)</span>
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
                ส่งหลักฐานการชำระ
              </button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      {invoice.proof && admin && (
        <a href={invoice.proof.data} className="outline-button" download>
          ดาวน์โหลดสลิป · {invoice.proof.name}
        </a>
      )}
      {invoice.status === "submitted" && admin && (
        <div className="portal-form">
          <p>เลขอ้างอิง: {invoice.reference} · ตรวจยอดเข้าบัญชีก่อนยืนยัน</p>
          <label><span>เลขธุรกรรมธนาคารที่ตรวจสอบแล้ว</span><input value={bankTransaction} onChange={e => setBankTransaction(e.target.value)} /></label>
          <label>
            <span>เหตุผลหากไม่ผ่าน</span>
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
              ยืนยันได้รับชำระ (รออนุมัติ Villa)
            </button>
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
              ไม่ผ่าน / แนบสลิปใหม่
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
