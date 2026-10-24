import { basicVerificationNotice } from "../server/package-content.mjs"
import { useState } from "react"
import { usePackages } from "./packagePlans"
import type { Store } from "./merchantStore"
export default function VillaPackagePanel({
  store,
  busy,
  perform,
  onAdd,
  onPayment,
}: {
  store: Store
  busy: boolean
  perform: (
    path: string,
    data: unknown,
    message: string,
  ) => Promise<Store | null>
  onAdd: () => void
  onPayment: (invoiceId: string) => void
}) {
  const { plans, error } = usePackages()
  const [villaId, setVillaId] = useState(store.villas[0]?.id || "")
  const [selected, setSelected] = useState("")
  const [couponCode, setCouponCode] = useState("")
  const villa = store.villas.find((v) => v.id === villaId)
  const selectedPlanId = selected || (villa?.trialUnlimited ? "basic" : villa?.packageId) || "basic"
  const basicPlan=plans.find(p=>p.id==="basic")
  const plan = plans.find((p) => p.id === selectedPlanId)
  const pendingInvoice = villa?.invoices.find(i => i.status !== "paid")
  const expiresAt = villa?.expires ? Date.parse(villa.expires) : NaN
  const daysLeft = Math.ceil((expiresAt - Date.now()) / 86400000)
  const expiryDate = Number.isFinite(expiresAt) ? new Date(expiresAt).toLocaleString("th-TH", {timeZone:"Asia/Bangkok",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}) : ""
  const featureRows=[...new Set(plans.flatMap(p=>p.features.map(feature=>feature.trim()).filter(Boolean)))];
  return (
    <section className="merchant-panel subscription-panel">
      <span className="kicker">MEMBER ROOM</span>
      <h2>แพ็กเกจของแต่ละที่พัก</h2>
      <p>ราคาต่อเดือน รวมภาษี ต่อที่พัก · การซื้อแพ็กเกจไม่ทำให้ผ่านการตรวจสอบโดยอัตโนมัติ</p>
      {error && <p role="alert">{error}</p>}
      {!store.villas.length ? (
        <>
          <p>{basicPlan?.promotion?"Basic Verify ราคาปกติ 990 บาท โปรโมชั่นลด 100% ยอดสุทธิ 0 บาท":"Basic Verify ราคาปกติ 990 บาท การสมัครสิทธิ์ใหม่รอเงื่อนไขโปรโมชั่น"}</p>
          <button className="primary-button" disabled={!basicPlan || basicPlan.netAmount!==0} onClick={onAdd}>
            เพิ่มที่พัก
          </button>
        </>
      ) : (
        <label>
          เลือกที่พัก
          <select value={villaId} onChange={(e) => {setVillaId(e.target.value);setSelected("");setCouponCode("")}}>
            {store.villas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} / {v.nameEn}
              </option>
            ))}
          </select>
        </label>
      )}
      {villa && (
        <div className="subscription-current">
          <h3>{villa.name}</h3>
          <p>
            แพ็กเกจปัจจุบัน:{" "}
            {villa.trialUnlimited ? "Basic Verify · สิทธิ์โปรโมชั่น" : villa.package}
          </p>
          <p>
            สถานะการตรวจสอบ: {villa.verificationLevel} · {villa.status}
            {villa.status === "pending" && villa.invoices.some(i=>i.status==="paid") && <strong> · ชำระเงินแล้ว รอ Admin ตรวจสอบและอนุมัติ</strong>}
          </p>
          <p>
            เริ่มใช้บริการ:{" "}
            {new Date(villa.createdAt || Date.now()).toLocaleDateString(
              "th-TH",
              { timeZone: "Asia/Bangkok" },
            )}{" "}
            ·{" "}
            {villa.trialUnlimited
              ? "วันสิ้นสุดโปรโมชั่น: รอประกาศ สิทธิ์เดิมยังคงอยู่"
              : `สิ้นสุดแพ็กเกจ: ${expiryDate || "ยังไม่มีวันสิ้นสุดที่ยืนยัน"}`}
          </p>
          <p className={`package-expiry-notice${!villa.trialUnlimited && daysLeft <= 7 ? " package-expiry-urgent" : ""}`} role="status">
            {villa.trialUnlimited ? "สิทธิ์ Basic จากโปรโมชั่นยังคงอยู่ วันสิ้นสุดและเงื่อนไขต่ออายุรอประกาศ" : expiryDate ? `${expiresAt <= Date.now() ? "แพ็กเกจหมดอายุแล้ว" : daysLeft <= 7 ? "แพ็กเกจใกล้หมดอายุ" : "กำหนดสิ้นสุดแพ็กเกจ"}: ${expiryDate}${expiresAt > Date.now() ? ` · เหลือ ${daysLeft} วัน` : " · กรุณาต่ออายุเพื่อใช้สิทธิ์แพ็กเกจต่อ"}` : "วันหมดอายุจะแสดงหลัง Admin ยืนยันการชำระเงิน"}
          </p>
        </div>
      )}
      {!!featureRows.length&&<p className="package-feature-legend">✓ รวมในแพ็กเกจ · × ไม่รวมในแพ็กเกจ</p>}
      <div className="subscription-options">
        {plans.map((p) => {
          const included=new Set(p.features.map(feature=>feature.trim()));
          return <article key={p.id} data-plan-id={p.id} className={`subscription-plan${selectedPlanId===p.id?" active":""}`}>
            <button type="button" aria-pressed={selectedPlanId===p.id} onClick={()=>setSelected(p.id)}>
              <strong>{p.name}</strong><span>{p.discountAmount ? <><del>฿{((p.regularAmount ?? p.amount)/100).toLocaleString("th-TH")}</del> · ลด 100% · สุทธิ ฿0</> : <>฿{((p.netAmount ?? p.amount)/100).toLocaleString("th-TH")} / เดือน / ที่พัก</>}</span><small>รวมภาษี · ทุกแพ็กเกจเขียนรีวิวได้</small>
            </button>
            {p.id === "basic" && <p>{basicVerificationNotice}</p>}
            <ul className="package-feature-list" aria-label={`สิทธิ์ของ ${p.name}`}>
              {featureRows.map(feature=>{
                const available=included.has(feature);
                return <li key={feature} className={available?"feature-included":"feature-excluded"}><span className="package-feature-symbol" aria-hidden="true">{available?"✓":"×"}</span><span><span className="sr-only">{available?"มีสิทธิ์: ":"ไม่มีสิทธิ์: "}</span>{feature}</span></li>;
              })}
            </ul>
          </article>;
        })}
      </div>
      {plan && (
        <section className="subscription-selection">
          <h3>{plan.name}</h3>
          <p>{plan.description}</p>

        </section>
      )}
      {villa && (
        <>
          <label>
            รหัสคูปอง (ถ้ามี)
            <input
              maxLength={32}
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            />
          </label>
          <p>
            ใช้ฟรีได้ครบสิทธิ์ Basic Verify โดยไม่ต้องชำระหรือเปิดการต่ออายุอัตโนมัติ
            แพ็กเกจที่ซื้อใช้งานได้หลังยืนยันชำระและ Admin อนุมัติ Villa แยกอีกขั้น หากต่อแพ็กเกจเดิมก่อนหมดอายุจะเพิ่ม
            1 เดือนจากวันสิ้นสุดเดิม การเปลี่ยนระดับระหว่างรอบต้องรักษามูลค่าคงเหลือและรอยืนยันเงื่อนไข
          </p>
          <button
            className="primary-button"
            disabled={
              busy ||
              (!pendingInvoice && (!plan || villa.status !== "approved"))
            }
            onClick={async () => {
              if (pendingInvoice) { onPayment(pendingInvoice.id); return }
              const result = await perform(
                "/merchant/villa-package",
                { villaId, packageId: selectedPlanId, couponCode },
                "สร้างใบแจ้งชำระต่อที่พักแล้ว กรุณาตรวจยอดและแนบสลิปด้านล่าง",
              )
              if (result) { const invoice = result.villas.find(v=>v.id===villaId)?.invoices.find(i=>i.status!=="paid"); if(invoice) onPayment(invoice.id) }
            }}
          >
            {busy ? "กำลังสร้างใบแจ้งชำระ…" : pendingInvoice ? "เปิดหน้าชำระเงินของรายการค้าง" : "ซื้อ / ต่ออายุแพ็กเกจสำหรับที่พักนี้"}
          </button>
          {pendingInvoice && <div role="status"><p>{pendingInvoice.status === "submitted" ? "ส่งสลิปแล้ว อยู่ระหว่างรอ Admin ตรวจสอบ วันหมดอายุจะปรับหลังยืนยันชำระ" : "มีใบแจ้งชำระค้าง กรุณาชำระและแนบสลิปในรายการเดิมก่อนสร้างรายการใหม่"}</p><button type="button" className="outline-button" onClick={()=>onPayment(pendingInvoice.id)}>ดูใบแจ้งชำระ / แนบสลิป</button></div>}
          {villa.status !== "approved" && <p>รอทีมอนุมัติที่พักก่อนเลือกซื้อแพ็กเกจ</p>}
        </>
      )}
    </section>
  )
}
