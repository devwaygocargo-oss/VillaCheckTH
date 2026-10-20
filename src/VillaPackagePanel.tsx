import { useState } from "react"
import { usePackages } from "./packagePlans"
import type { Store } from "./merchantStore"
export default function VillaPackagePanel({
  store,
  busy,
  perform,
  onAdd,
}: {
  store: Store
  busy: boolean
  perform: (
    path: string,
    data: unknown,
    message: string,
  ) => Promise<Store | null>
  onAdd: () => void
}) {
  const { plans, error } = usePackages()
  const [villaId, setVillaId] = useState(store.villas[0]?.id || "")
  const [selected, setSelected] = useState("")
  const [couponCode, setCouponCode] = useState("")
  const villa = store.villas.find((v) => v.id === villaId)
  const plan = plans.find((p) => p.id === selected)
  const featureRows=[...new Set(plans.flatMap(p=>p.features.map(feature=>feature.trim()).filter(Boolean)))];
  return (
    <section className="merchant-panel subscription-panel">
      <span className="kicker">MEMBER ROOM</span>
      <h2>แพ็กเกจของแต่ละที่พัก</h2>
      <p>ราคาต่อเดือน รวมภาษี ต่อที่พัก · การซื้อแพ็กเกจไม่ทำให้ผ่านการตรวจสอบโดยอัตโนมัติ</p>
      {error && <p role="alert">{error}</p>}
      {!store.villas.length ? (
        <>
          <p>เพิ่มที่พักเพื่อใช้สิทธิ์ Basic Verify ฟรีไม่มีกำหนด จนกว่าจะเลือกซื้อแพ็กเกจเอง</p>
          <button className="primary-button" onClick={onAdd}>
            เพิ่มที่พักฟรี
          </button>
        </>
      ) : (
        <label>
          เลือกที่พัก
          <select value={villaId} onChange={(e) => setVillaId(e.target.value)}>
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
            {villa.trialUnlimited ? "Basic Verify · ฟรีไม่มีกำหนด" : villa.package}
          </p>
          <p>
            สถานะการตรวจสอบ: {villa.verificationLevel} · {villa.status}
          </p>
          <p>
            เริ่มใช้บริการ:{" "}
            {new Date(villa.createdAt || Date.now()).toLocaleDateString(
              "th-TH",
              { timeZone: "Asia/Bangkok" },
            )}{" "}
            ·{" "}
            {villa.trialUnlimited
              ? "สิ้นสุดทดลองใช้ฟรี: ไม่มีกำหนด จนกว่าจะซื้อเอง"
              : `สิ้นสุดแพ็กเกจ: ${new Date(villa.expires).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}`}
          </p>
        </div>
      )}
      {!!featureRows.length&&<p className="package-feature-legend">✓ รวมในแพ็กเกจ · × ไม่รวมในแพ็กเกจ</p>}
      <div className="subscription-options">
        {plans.map((p) => {
          const included=new Set(p.features.map(feature=>feature.trim()));
          return <article key={p.id} data-plan-id={p.id} className={`subscription-plan${selected===p.id?" active":""}`}>
            <button type="button" aria-pressed={selected===p.id} onClick={()=>setSelected(p.id)}>
              <strong>{p.name}</strong><span>฿{(p.amount/100).toLocaleString("th-TH")} / เดือน / ที่พัก</span><small>รวมภาษี · ทุกแพ็กเกจเขียนรีวิวได้</small>
            </button>
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
            แพ็กเกจที่ซื้อเปิดใช้หลัง Admin ยืนยันสลิป การต่ออายุแพ็กเกจเดิมเพิ่ม 1
            เดือนจากวันสิ้นสุดเดิม ส่วนการเปลี่ยนระดับเริ่ม 1 เดือนจากวันยืนยันชำระ
          </p>
          <button
            className="primary-button"
            disabled={
              busy ||
              !plan ||
              villa.status !== "approved" ||
              villa.invoices.some((i) => i.status !== "paid")
            }
            onClick={() =>
              void perform(
                "/merchant/villa-package",
                { villaId, packageId: selected, couponCode },
                "สร้างใบแจ้งชำระต่อที่พักแล้ว กรุณาตรวจยอดและแนบสลิปด้านล่าง",
              )
            }
          >
            ซื้อ / ต่ออายุแพ็กเกจสำหรับที่พักนี้
          </button>
          {villa.status !== "approved" && <p>รอทีมอนุมัติที่พักก่อนเลือกซื้อแพ็กเกจ</p>}
        </>
      )}
    </section>
  )
}
