import {t as translateSystem} from "./locale"
import {t,localeTag} from "./locale"
import { useCms } from "./cms";
import { usePackages, billingLabel, billingValidityLabel } from "./packagePlans";

export default function PremiumBanner({ onSelect }: { onSelect: (id: string) => void }) {
  const {business}=useCms();
  const { plans, error } = usePackages();
  const plan = [...plans].filter(p => p.isActive).sort((a, b) => b.amount - a.amount || b.capacity - a.capacity || b.sort_order - a.sort_order)[0];
  if (!plan) return error ? <p role="alert" className="merchant-panel">{translateSystem("โหลดแพ็กเกจแนะนำไม่สำเร็จ:")}{" "}{error}</p> : <p role="status">{translateSystem("กำลังโหลดแพ็กเกจแนะนำ…")}</p>;
  return <section className="premium-merchant-banner premium-package-promo" aria-label={translateSystem("แพ็กเกจสูงสุด {v0}", {v0: plan.name})}>
    <span className="premium-banner-emblem" aria-hidden="true">✦</span>
    <div className="premium-promo-copy"><small>{translateSystem("สำหรับ MERCHANT · แพ็กเกจสูงสุด")}</small>
      <h2>{plan.name} {" "}{translateSystem("— ยกระดับความน่าเชื่อถือของธุรกิจ Villa")}</h2>
      <p>{(plan.amount / 100).toLocaleString(localeTag(), { style: "currency", currency: plan.currency })} / {billingLabel(plan.billingCycle)} {" "}{translateSystem("· รองรับที่พักสูงสุด")}{" "}{plan.capacity} {" "}{translateSystem("แห่ง")}</p>
      {plan.amount > 0 && <p>{billingValidityLabel(plan.billingCycle,business)}</p>}
      <ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}{plan.maximumVerificationLevel === "PREMIUM_VERIFIED" && <li>{translateSystem("สิทธิ์รับการตรวจสอบระดับ Premium")}</li>}</ul>
      <p className="premium-promo-note">{translateSystem("รับสิทธิ์การตรวจสอบระดับสูงสุด โดยต้องผ่านการตรวจเอกสารและอนุมัติจาก Admin")}</p>
    </div>
    <button className="white-button" onClick={() => onSelect(plan.id)}>{translateSystem("เลือก")}{" "}{plan.name} →</button>
  </section>;
}
