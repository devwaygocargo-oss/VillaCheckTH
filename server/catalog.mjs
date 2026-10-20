import {packageContent,footerAdFeature} from './package-content.mjs'
import { packages } from "./database.mjs"
export const levels = [
  "REGISTERED",
  "BASIC_CHECKED",
  "VERIFIED",
  "PREMIUM_VERIFIED",
]
export async function seedCatalog(db) {
  for (const [id, plan] of Object.entries(packages)) {
    await db
      .prepare(
        "INSERT INTO package_catalog(id,name,slug,description,amount,currency,billing_cycle,trial_months,capacity,features,max_level,banner,active,sort_order,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      )
      .run(
        id,
        plan.name,
        id,
        packageContent[id]?.description || "แพ็กเกจบัญชี Merchant",
        plan.amount,
        "THB",
        "MONTHLY",
        0,
        plan.capacity,
        JSON.stringify(packageContent[id]?.features || ["1 Villa = 1 QR", `รองรับ ${plan.capacity} Villa`]),
        id === "basic" ? "BASIC_CHECKED" : id === "premium" ? "PREMIUM_VERIFIED" : "VERIFIED",
        id === "premium" ? 1 : 0,
        1,
        Object.keys(packages).indexOf(id),
        new Date().toISOString(),
        new Date().toISOString(),
      )
  }
  if(!(await db.prepare("SELECT value FROM system_settings WHERE key='package_model_v2'").get())) {
    await db.prepare("UPDATE package_catalog SET active=0").run()
    for(const [id,plan]of Object.entries(packages))await db.prepare("UPDATE package_catalog SET name=?,amount=?,capacity=1,trial_months=0,billing_cycle='MONTHLY',description=?,features=?,active=1,max_level=?,banner=?,sort_order=? WHERE id=?").run(plan.name,plan.amount,packageContent[id].description,JSON.stringify(packageContent[id].features),id==='basic'?'BASIC_CHECKED':id==='premium'?'PREMIUM_VERIFIED':'VERIFIED',id==='premium'?1:0,Object.keys(packages).indexOf(id),id)
    await db.prepare("UPDATE villas SET payments=0,expires=NULL WHERE package_id='basic' AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.status='paid' AND i.amount>0 AND (i.villa_id=villas.id OR i.subscription_owner=villas.owner_id))").run()
    await db.prepare("INSERT INTO system_settings(key,value) VALUES ('package_model_v2','true')").run()
  }
  if(!(await db.prepare("SELECT value FROM system_settings WHERE key='package_footer_ad_v1'").get())){
    for(const id of ["pro","premium"]){
      const row=await db.prepare("SELECT features FROM package_catalog WHERE id=?").get(id);
      if(row){const features=JSON.parse(row.features);if(!features.includes(footerAdFeature))await db.prepare("UPDATE package_catalog SET features=? WHERE id=?").run(JSON.stringify([...features,footerAdFeature]),id);}
    }
    await db.prepare("INSERT INTO system_settings(key,value) VALUES ('package_footer_ad_v1','true') ON CONFLICT(key) DO NOTHING").run();
  }

}
export async function getPlan(db, id) {
  if (typeof id !== "string" || !id)
    throw Object.assign(Error("แพ็กเกจไม่ถูกต้อง"), { status: 400 })
  const row = await db
    .prepare("SELECT * FROM package_catalog WHERE id=?")
    .get(id)
  if (!row) throw Object.assign(Error("ไม่พบแพ็กเกจ"), { status: 400 })
  return planDto(row)
}
function planDto(row) {
  return {
    ...row,
    features: JSON.parse(row.features),
    trialMonths: row.trial_months,
    maximumVerificationLevel: row.max_level,
    showPremiumBanner: Boolean(row.banner),
    isActive: Boolean(row.active),
    billingCycle: row.billing_cycle,
    billingScope: "VILLA", taxIncluded: true,
  }
}
export async function listPlans(db, all = false) {
  const rows = await db
    .prepare(
      `SELECT * FROM package_catalog ${
        all ? "" : "WHERE active=1"
      } ORDER BY sort_order,id`,
    )
    .all()
  return rows.map(planDto)
}
export async function getVerificationMode() {
  return "MANUAL"
}
export function qrState(villa, subscription, now = Date.now()) {
  if (villa.status === "changes" || villa.status === "rejected")
    return "SUSPENDED"
  if (subscription?.lifecycle === "SUSPENDED" || villa.status === "suspended")
    return "SUSPENDED"
  if (subscription?.lifecycle === "CANCELLED") return "INACTIVE"
  if (villa.status !== "approved" || !villa.qr) return "PENDING"
  if (villa.payments === 0) return "ACTIVE"
  return new Date(villa.expires).getTime() > now
    ? "ACTIVE"
    : "EXPIRED"
}
export async function trustDto(db, villa, context) {
  const sub = context ? context.subscriptions.get(villa.owner_id) : await db
    .prepare("SELECT * FROM subscriptions WHERE owner_id=?")
    .get(villa.owner_id)
  const plan = await readContextPlan(db,villa.payments === 0 ? "basic" : villa.package_id,context)
  const override = context ? context.settings.get("villa_qr:"+villa.id) : await db.prepare("SELECT value FROM system_settings WHERE key=?").get("villa_qr:"+villa.id)
  const qrStatus = ["SUSPENDED","INACTIVE"].includes(override?.value) ? override.value : qrState(villa, sub)
  const actual = qrStatus === "ACTIVE" ? villa.verification_level : "REGISTERED"
  return {
    qrStatus,
    verificationStatus:
      qrStatus === "EXPIRED"
        ? "EXPIRED"
        : villa.status === "approved"
          ? "APPROVED"
          : villa.status === "rejected"
            ? "REJECTED"
            : "PENDING_REVIEW",
    verificationLevel:
      levels.indexOf(actual) <= levels.indexOf(plan.max_level)
        ? actual
        : plan.max_level,
    premiumBanner:
      qrStatus === "ACTIVE" &&
      villa.status === "approved" &&
      Boolean(plan.banner) &&
      plan.max_level === "PREMIUM_VERIFIED" &&
      actual === "PREMIUM_VERIFIED",
    merchantName: villa.merchant,
    packageName: plan.name,
  }
}

export async function readContextPlan(db,id,context){return context?.plans.has(id)?planDto(context.plans.get(id)):getPlan(db,id)}
