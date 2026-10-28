import {t as translateSystem} from "./locale"
import {t,localeTag} from "./locale"
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
  const expiryDate = Number.isFinite(expiresAt) ? new Date(expiresAt).toLocaleString(localeTag(), {timeZone:"Asia/Bangkok",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}) : ""
  const featureRows=[...new Set(plans.flatMap(p=>p.features.map(feature=>feature.trim()).filter(Boolean)))];
  if(store.freePeriod)return <section className="merchant-panel"><h2>{translateSystem("เร็ว ๆ นี้")}</h2><p>{translateSystem("ยังไม่เปิดให้เลือกแพ็กเกจ")}</p><p>{store.freePeriod.state==="ACTIVE"?translateSystem("ใช้งานฟรี สิ้นสุดวันที่ {v0}", {v0: new Date(store.freePeriod.endsAt).toLocaleDateString("th-TH")}):translateSystem("ช่วงใช้ฟรีสิ้นสุดแล้ว รอประกาศสิทธิ์การใช้งานต่อ")}</p><p>{translateSystem("สิทธิ์ Online Verify · เพิ่มที่พักได้ไม่จำกัดระหว่างช่วงใช้ฟรี")}</p></section>;
  if(plans.some(p=>p.phase1DisplayOnly))return <section className="merchant-panel subscription-panel">
    <span className="kicker">MEMBER ROOM · PHASE 1</span><h2>{translateSystem("ข้อมูลแพ็กเกจและโปรโมชั่น")}</h2>
    <p role="status">{translateSystem("รอบสมาชิกแบบรายเดือน ระหว่างโปรโมชั่นรับสิทธิ์เดือนต่อเดือนเท่านั้น ปิดรับชำระและเปิดสิทธิ์ใหม่ชั่วคราว โปรโมชั่นปัจจุบันยังไม่กำหนดวันสิ้นสุด ส่วนเงื่อนไขการต่ออายุยังไม่ประกาศ")}</p>
    {error&&<p role="alert">{error}</p>}
    {!store.villas.length&&<button className="primary-button" disabled={busy} onClick={onAdd}>{translateSystem("ส่งข้อมูลที่พักเพื่อรอตรวจสอบ")}</button>}
    {store.villas.map(v=><p key={v.id}>{v.name} / {v.nameEn} · {v.status} {" "}{translateSystem("· การส่งข้อมูลไม่ใช่การเปิดสิทธิ์ใหม่")}</p>)}
    <div className="subscription-options">{plans.map(p=><article key={p.id} data-plan-id={p.id} className="subscription-plan"><h3>{p.name}</h3><p>{translateSystem("ราคาเต็ม ฿")}{((p.regularAmount??p.amount)/100).toLocaleString(localeTag())} {" "}{translateSystem("· ลด")}{" "}{p.promotion?.percent??0}{translateSystem("% · สุทธิ ฿")}{((p.netAmount??p.amount)/100).toLocaleString(localeTag())}</p><p>{p.description}</p></article>)}</div>
    <p>{translateSystem("การตรวจสอบข้อมูลแยกจากสิทธิ์แพ็กเกจ ไม่มีการชำระเงินจริงหรือเปิด Upgrade/Downgrade ใน Phase 1")}</p>
  </section>
  return (
    <section className="merchant-panel subscription-panel">
      <span className="kicker">MEMBER ROOM</span>
      <h2>{translateSystem("แพ็กเกจของแต่ละที่พัก")}</h2>
      <p>{translateSystem("ราคาต่อเดือน รวมภาษี ต่อที่พัก · การซื้อแพ็กเกจไม่ทำให้ผ่านการตรวจสอบโดยอัตโนมัติ")}</p>
      {error && <p role="alert">{error}</p>}
      {!store.villas.length ? (
        <>
          <p>{basicPlan?.promotion?translateSystem("Basic Verify ราคาปกติ 990 บาท โปรโมชั่นลด 100% ยอดสุทธิ 0 บาท"):translateSystem("Basic Verify ราคาปกติ 990 บาท การสมัครสิทธิ์ใหม่รอเงื่อนไขโปรโมชั่น")}</p>
          <button className="primary-button" disabled={!basicPlan || basicPlan.netAmount!==0} onClick={onAdd}>
            {translateSystem("เพิ่มที่พัก")}</button>
        </>
      ) : (
        <label>
          {translateSystem("เลือกที่พัก")}<select value={villaId} onChange={(e) => {setVillaId(e.target.value);setSelected("");setCouponCode("")}}>
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
            {translateSystem("แพ็กเกจปัจจุบัน:")}{" "}
            {villa.trialUnlimited ? translateSystem("Basic Verify · สิทธิ์โปรโมชั่น") : villa.package}
          </p>
          <p>
            {translateSystem("สถานะการตรวจสอบ:")}{" "}{villa.verificationLevel} · {villa.status}
            {villa.status === "pending" && villa.invoices.some(i=>i.status==="paid") && <strong> {" "}{translateSystem("· ชำระเงินแล้ว รอ Admin ตรวจสอบและอนุมัติ")}</strong>}
          </p>
          <p>
            {translateSystem("เริ่มใช้บริการ:")}{" "}
            {new Date(villa.createdAt || Date.now()).toLocaleDateString(
              localeTag(),
              { timeZone: "Asia/Bangkok" },
            )}{" "}
            ·{" "}
            {villa.trialUnlimited
              ? translateSystem("วันสิ้นสุดโปรโมชั่น: รอประกาศ สิทธิ์เดิมยังคงอยู่")
              : translateSystem("สิ้นสุดแพ็กเกจ: {v0}", {v0: expiryDate || "ยังไม่มีวันสิ้นสุดที่ยืนยัน"})}
          </p>
          <p className={`package-expiry-notice${!villa.trialUnlimited && daysLeft <= 7 ? " package-expiry-urgent" : ""}`} role="status">
            {villa.trialUnlimited ? translateSystem("สิทธิ์ Basic จากโปรโมชั่นยังคงอยู่ วันสิ้นสุดและเงื่อนไขต่ออายุรอประกาศ") : expiryDate ? `${expiresAt <= Date.now() ? translateSystem("แพ็กเกจหมดอายุแล้ว") : daysLeft <= 7 ? translateSystem("แพ็กเกจใกล้หมดอายุ") : translateSystem("กำหนดสิ้นสุดแพ็กเกจ")}: ${expiryDate}${expiresAt > Date.now() ? translateSystem(" · เหลือ {v0} วัน", {v0: daysLeft}) : translateSystem(" · กรุณาต่ออายุเพื่อใช้สิทธิ์แพ็กเกจต่อ")}` : translateSystem("วันหมดอายุจะแสดงหลัง Admin ยืนยันการชำระเงิน")}
          </p>
        </div>
      )}
      {!!featureRows.length&&<p className="package-feature-legend">{translateSystem("✓ รวมในแพ็กเกจ · × ไม่รวมในแพ็กเกจ")}</p>}
      <div className="subscription-options">
        {plans.map((p) => {
          const included=new Set(p.features.map(feature=>feature.trim()));
          return <article key={p.id} data-plan-id={p.id} className={`subscription-plan${selectedPlanId===p.id?" active":""}`}>
            <button type="button" aria-pressed={selectedPlanId===p.id} onClick={()=>setSelected(p.id)}>
              <strong>{p.name}</strong><span>{p.pricingPending ? <>{translateSystem("ราคาเต็ม ฿")}{((p.regularAmount??p.amount)/100).toLocaleString(localeTag())} {" "}{translateSystem("· ส่วนลด")}{" "}{p.promotion?.percent}{translateSystem("% · ยอดสุทธิรอยืนยันการปัดเศษ")}</> : p.promotion ? <><del>{translateSystem("฿")}{((p.regularAmount ?? p.amount)/100).toLocaleString(localeTag())}</del> {" "}{translateSystem("· ลด")}{" "}{p.promotion?.percent}% (Discount {p.promotion?.percent}{translateSystem("%) · ส่วนลด ฿")}{((p.discountAmount??0)/100).toLocaleString(localeTag())} {" "}{translateSystem("· สุทธิ ฿")}{((p.netAmount??0)/100).toLocaleString(localeTag())}</> : <>{translateSystem("ราคาเต็ม ฿")}{((p.regularAmount??p.amount)/100).toLocaleString(localeTag())} {" "}{translateSystem("· ส่วนลด 0% (Discount 0%) · ส่วนลด ฿0 · สุทธิ ฿")}{((p.netAmount??p.amount)/100).toLocaleString(localeTag())}</>}</span><small>{translateSystem("รวมภาษี · ทุกแพ็กเกจเขียนรีวิวได้")}</small>
            </button>
            {p.id === "basic" && <p>{basicVerificationNotice}</p>}
            <ul className="package-feature-list" aria-label={translateSystem("สิทธิ์ของ {v0}", {v0: p.name})}>
              {featureRows.map(feature=>{
                const available=included.has(feature);
                return <li key={feature} className={available?"feature-included":"feature-excluded"}><span className="package-feature-symbol" aria-hidden="true">{available?"✓":"×"}</span><span><span className="sr-only">{available?translateSystem("มีสิทธิ์: "):translateSystem("ไม่มีสิทธิ์: ")}</span>{feature}</span></li>;
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
            {translateSystem("รหัสคูปอง (ถ้ามี)")}<input
              maxLength={32}
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            />
          </label>
          <p>
            {translateSystem("ใช้ฟรีได้ครบสิทธิ์ Basic Verify โดยไม่ต้องชำระหรือเปิดการต่ออายุอัตโนมัติ แพ็กเกจที่ซื้อใช้งานได้หลังยืนยันชำระและ Admin อนุมัติ Villa แยกอีกขั้น หากต่อแพ็กเกจเดิมก่อนหมดอายุจะเพิ่ม 1 เดือนจากวันสิ้นสุดเดิม การเปลี่ยนระดับระหว่างรอบต้องรักษามูลค่าคงเหลือและรอยืนยันเงื่อนไข")}</p>
          <button
            className="primary-button"
            disabled={
              busy ||
              (!pendingInvoice && selectedPlanId!=="basic" && (store.paymentAccessMode==="DISABLED"||plan?.netAmount===0||plan?.pricingPending===true)) ||
              (!pendingInvoice && (!plan || villa.status !== "approved"))
            }
            onClick={async () => {
              if (pendingInvoice) { onPayment(pendingInvoice.id); return }
              const result = await perform(
                "/merchant/villa-package",
                { villaId, packageId: selectedPlanId, couponCode },
                "สร้างใบแจ้งชำระแล้ว กรุณาตรวจยอดและดำเนินการตามช่องทางของรายการ",
              )
              if (result) { const invoice = result.villas.find(v=>v.id===villaId)?.invoices.find(i=>i.status!=="paid"); if(invoice) onPayment(invoice.id) }
            }}
          >
            {busy ? translateSystem("กำลังสร้างใบแจ้งชำระ…") : pendingInvoice ? translateSystem("เปิดประวัติและสถานะรายการค้าง") : translateSystem("ซื้อ / ต่ออายุแพ็กเกจสำหรับที่พักนี้")}
          </button>
          {selectedPlanId!=="basic"&&plan?.netAmount===0&&<p role="status">{translateSystem("โปรโมชั่นสุทธิ 0 บาท ไม่ต้องชำระ ระยะสิทธิ์และวิธีเปิดระดับฟรีรอยืนยัน")}</p>}
          {store.paymentAccessMode==="DISABLED"&&<p role="status">{translateSystem("ปิดการชำระชั่วคราว สิทธิ์และประวัติเดิมยังคงอยู่")}</p>}
          {pendingInvoice && <div role="status"><p>{pendingInvoice.status === "submitted" ? translateSystem("ส่งสลิปแล้ว อยู่ระหว่างรอ Admin ตรวจสอบ วันหมดอายุจะปรับหลังยืนยันชำระ") : translateSystem("มีรายการค้าง กรุณาเปิดดูสถานะและช่องทางของรายการเดิม ไม่สร้างรายการชำระซ้ำ")}</p><button type="button" className="outline-button" onClick={()=>onPayment(pendingInvoice.id)}>{translateSystem("ดูประวัติ / สถานะใบแจ้งชำระ")}</button></div>}
          {villa.status !== "approved" && <p>{translateSystem("รอทีมอนุมัติที่พักก่อนเลือกซื้อแพ็กเกจ")}</p>}
        </>
      )}
    </section>
  )
}
