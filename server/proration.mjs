const invalid = message => { throw Object.assign(Error(message), { status: 400 }) }
const timestamp = value => {
  if(value===null || value===undefined || (typeof value==="string" && !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)))invalid("Explicit membership timestamp required")
  const n = new Date(value).getTime()
  if (!Number.isSafeInteger(n)) invalid("Invalid membership date")
  return n
}
const gcd = (a,b) => b === 0n ? a : gcd(b,a % b)
/** Exact unused paid value in minor currency units. No rounding, refund or reset policy. */
export function remainingPaidValue({ paidAmount, startsAt, endsAt, at }) {
  if (!Number.isSafeInteger(paidAmount) || paidAmount < 0) invalid("Invalid actual paid amount")
  const start=timestamp(startsAt),end=timestamp(endsAt),now=timestamp(at)
  if (end<=start) invalid("Membership must have a positive duration")
  const total=BigInt(end)-BigInt(start)
  const remaining=now<=start?total:now>=end?0n:BigInt(end)-BigInt(now)
  const numerator=BigInt(paidAmount)*remaining,divisor=gcd(numerator,total)
  return { currencyUnit:"minor", paidAmount, totalMilliseconds:total.toString(), remainingMilliseconds:remaining.toString(), unusedValue:{numerator:(numerator/divisor).toString(),denominator:(total/divisor).toString()}, settlementRequired:true }
}
export function assertNoUnsettledPackageChange(villa, targetPackageId, at=Date.now()) {
  const end=Date.parse(villa.expires||"")
  if(villa.payments>0 && !Number.isFinite(end))
    throw Object.assign(Error("ข้อมูลวันสิ้นสุดสิทธิ์เดิมไม่ครบ กรุณาตรวจสอบก่อนรับชำระหรือเปลี่ยนแพ็กเกจ"),{status:409})
  if (villa.payments > 0 && villa.package_id !== targetPackageId && end > at)
    throw Object.assign(Error("แพ็กเกจเดิมยังมีมูลค่าคงเหลือ กรุณารอคำนวณและยืนยันนโยบายเปลี่ยนแพ็กเกจ เพื่อรักษาสิทธิ์เดิม"), { status:409 })
}
