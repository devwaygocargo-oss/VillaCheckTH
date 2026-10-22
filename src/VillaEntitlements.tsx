import type { MerchantVilla } from "./merchantStore"
import { billingLabel,type PackagePlan } from "./packagePlans"
import type { Page } from "./prototype"
const qrLabels:Record<string,string>={ACTIVE:"ใช้งานได้",EXPIRED:"หมดอายุ",SUSPENDED:"ระงับ",INACTIVE:"ปิดใช้งาน",PENDING:"รอเปิดใช้งาน"}
export default function VillaEntitlements({villa,plan,error,go}:{villa:MerchantVilla;plan?:PackagePlan;error:string;go:(page:Page,item?:string)=>void}){
 const pending=villa.status!=="approved"
 return <section className="villa-entitlements" aria-label={`สิทธิ์รายที่พัก ${villa.name}`} data-package-id={villa.packageId}>
  <h3>สิทธิ์แพ็กเกจของที่พักนี้</h3>
  <dl className="subscription-detail-grid">
   <div><dt>แพ็กเกจปัจจุบัน</dt><dd>{villa.package}{plan&&<small>฿{(plan.amount/100).toLocaleString("th-TH")} / {billingLabel(plan.billingCycle)} / ที่พัก · รวมภาษี</small>}</dd></div>
   <div><dt>สถานะ QR</dt><dd><span className={`subscription-status status-${villa.qrStatus.toLowerCase()}`}>{qrLabels[villa.qrStatus]||villa.qrStatus}</span></dd></div>
   <div><dt>วันหมดอายุ</dt><dd>{villa.trialUnlimited?"Basic Verify ฟรีไม่มีกำหนด จนกว่าจะซื้อแพ็กเกจ":villa.expires?new Date(villa.expires).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Bangkok"}):"ยังไม่เปิดสิทธิ์"}</dd></div>
   <div><dt>การชำระเงิน</dt><dd>{villa.paymentPending?"มีรายการรอชำระ / ตรวจสลิป":"ไม่มีรายการรอชำระ"}</dd></div>
   <div><dt>ระดับที่ตรวจแล้ว</dt><dd>{villa.verificationLevel||"ยังไม่ตรวจ"}</dd></div>
   <div><dt>ยืนยันเจ้าของบ้าน</dt><dd>{villa.packageId==="basic"?"Basic Verify ไม่ต้องยืนยันเจ้าของบ้าน":"ตรวจใบหน้าและทะเบียนบ้านในหน้ารายละเอียดที่พัก · การซื้อแพ็กเกจไม่ถือว่ายืนยันแล้ว"}</dd></div>
  </dl>
  <p>{pending?"ที่พักนี้ยังรอการอนุมัติ ข้อมูลสิทธิ์ด้านล่างเป็นสิทธิ์ตามแพ็กเกจ ยังไม่ถือว่าเปิดเผยแพร่แล้ว":"สิทธิ์ที่ซื้อขึ้นอยู่กับการยืนยันชำระ วันหมดอายุ และสถานะแพ็กเกจ การอนุมัติที่พักและการยืนยันเจ้าของบ้านเป็นคนละขั้นตอน"}</p>
  {plan?<details><summary>ดูสิทธิ์ที่รวมใน {plan.name} ({plan.features.length} รายการ)</summary>{!plan.isActive&&<p>แพ็กเกจนี้ถูกปิดใช้งานในระบบ</p>}<ul className="villa-entitlement-features">{plan.features.map((feature,i)=><li key={i}><span aria-hidden="true">✓</span> {feature}</li>)}</ul></details>:<p>{error?"โหลดรายละเอียดสิทธิ์ไม่สำเร็จ กรุณาลองโหลดหน้าใหม่":"กำลังโหลดรายละเอียดสิทธิ์…"}</p>}
  <div className="subscription-actions"><button type="button" onClick={()=>go("admin-payments")}>ตรวจการชำระเงิน</button>{villa.packageId!=="basic"&&<button type="button" onClick={()=>go("admin-villa-page",villa.id)}>ตรวจยืนยันเจ้าของบ้าน</button>}{!pending&&villa.qr&&<a href={`/#page=verify&item=${encodeURIComponent(villa.qr)}`} target="_blank" rel="noopener noreferrer">ดูหน้าลูกค้า ↗</a>}</div>
 </section>
}
