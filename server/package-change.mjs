import {remainingPaidValue} from "./proration.mjs"
import {createHash} from "node:crypto"
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
const fraction=(numerator,denominator)=>({numerator:numerator.toString(),denominator:denominator.toString()})
// Preview only: exact values, no rounding, refund, spendable credit or new billing cycle.
export function previewPackageChange({paidAmount,targetPeriodAmount,startsAt,endsAt,at,direction}){
 if(!["upgrade","downgrade"].includes(direction))fail(400,"Invalid change direction")
 const current=remainingPaidValue({paidAmount,startsAt,endsAt,at}),target=remainingPaidValue({paidAmount:targetPeriodAmount,startsAt,endsAt,at})
 const a=current.unusedValue,b=target.unusedValue,n=BigInt(b.numerator)*BigInt(a.denominator)-BigInt(a.numerator)*BigInt(b.denominator),d=BigInt(a.denominator)*BigInt(b.denominator)
 return {direction,currentRemaining:a,targetRemaining:b,difference:fraction(n,d),upgradeDifferenceCandidate:direction==="upgrade"?fraction(n>0n?n:0n,d):null,downgradeRemainingCreditCandidate:direction==="downgrade"?a:null,refundAllowed:false,settlementEnabled:false,creditSpendable:false,requiresDecision:["ROUNDING","CREDIT_BASIS_AND_APPLICATION","BILLING_CYCLE_AND_EFFECTIVE_DATE","PROMOTION_ELIGIBILITY"]}
}
export async function proposeCreditLedger(db,{actorId,villaId,requestKey,inputs}){
 if(typeof requestKey!=="string"||!requestKey||requestKey.length>100)fail(400,"Request key required")
 return db.transaction(async()=>{
  const user=await db.prepare("SELECT role FROM users WHERE id=?").get(actorId),villa=await db.prepare("SELECT owner_id FROM villas WHERE id=?").get(villaId)
  if(!user||!villa||(user.role!=="admin"&&villa.owner_id!==actorId))fail(403,"ไม่มีสิทธิ์")
  const id=createHash("sha256").update(JSON.stringify([actorId,villaId,requestKey])).digest("hex"),key="credit_proposal:"+id,fingerprint=createHash("sha256").update(JSON.stringify(inputs)).digest("hex")
  const existing=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key)
  if(existing){const value=JSON.parse(existing.value);if(value.fingerprint!==fingerprint)fail(409,"คำขอเดิมมีข้อมูลต่างกัน");return value}
  const record={id,actorId,villaId,fingerprint,inputs,preview:previewPackageChange(inputs),status:"PROPOSED_NOT_SPENDABLE",createdAt:new Date().toISOString()}
  await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run(key,JSON.stringify(record));return record
 })
}
