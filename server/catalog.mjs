import {normalizeSocialFeatures,packageContent,footerAdFeature,premiumGuaranteeFeature,basicVerificationNotice,onlineVerificationFeatures} from './package-content.mjs'
import { packages } from "./database.mjs"
import { basicPricing } from "./basic-promotion.mjs"
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

  if(!(await db.prepare("SELECT value FROM system_settings WHERE key='premium_guarantee_v1'").get())) {
    const row=await db.prepare("SELECT features,description FROM package_catalog WHERE id='premium'").get();
    if(row){
      const features=JSON.parse(row.features).map(feature=>feature==='รับการตรวจบ้านตรงปกตามเกณฑ์ที่ทีมอนุมัติ'?premiumGuaranteeFeature:feature);
      if(!features.includes(premiumGuaranteeFeature))features.push(premiumGuaranteeFeature);
      await db.prepare("UPDATE package_catalog SET features=?,description=? WHERE id='premium'").run(JSON.stringify([...new Set(features)]),row.description.replace('การตรวจบ้านตรงปก','การันตีบ้านตรงปก'));
    }
    await db.prepare("INSERT INTO system_settings(key,value) VALUES ('premium_guarantee_v1','true') ON CONFLICT(key) DO NOTHING").run();
  }

  if(!(await db.prepare("SELECT value FROM system_settings WHERE key='basic_verification_scope_v1'").get())) {
    const row=await db.prepare("SELECT description FROM package_catalog WHERE id='basic'").get();
    if(row && !row.description.includes(basicVerificationNotice))await db.prepare("UPDATE package_catalog SET description=? WHERE id='basic'").run(row.description+' · '+basicVerificationNotice);
    await db.prepare("INSERT INTO system_settings(key,value) VALUES ('basic_verification_scope_v1','true') ON CONFLICT(key) DO NOTHING").run();
  }

  if(!(await db.prepare("SELECT value FROM system_settings WHERE key='online_owner_verification_v1'").get())) {
    for(const id of ['starter','pro','premium']) {
      const row=await db.prepare("SELECT features,description FROM package_catalog WHERE id=?").get(id);
      if(!row)continue;
      const features=JSON.parse(row.features).filter(feature=>feature!=='ตรวจสอบผู้มีสิทธิ์ดูแลผ่านช่องทางออนไลน์');
      for(const feature of onlineVerificationFeatures)if(!features.includes(feature))features.push(feature);
      const description=id==='starter' && row.description==='ตรวจสอบออนไลน์และสื่อวิดีโอ'?packageContent.starter.description:row.description;
      await db.prepare("UPDATE package_catalog SET features=?,description=? WHERE id=?").run(JSON.stringify(features),description,id);
    }
    await db.prepare("INSERT INTO system_settings(key,value) VALUES ('online_owner_verification_v1','true') ON CONFLICT(key) DO NOTHING").run();
  }

  if(!(await db.prepare("SELECT value FROM system_settings WHERE key='social_single_post_v1'").get())){
    const row=await db.prepare("SELECT features FROM package_catalog WHERE id='pro'").get();
    if(row)await db.prepare("UPDATE package_catalog SET features=?,description=? WHERE id='pro'").run(JSON.stringify(normalizeSocialFeatures(JSON.parse(row.features))),packageContent.pro.description);
    await db.prepare("INSERT INTO system_settings(key,value) VALUES ('social_single_post_v1','true') ON CONFLICT(key) DO NOTHING").run();
  }

}
export async function getPlan(db, id) {
  if (typeof id !== "string" || !id)
    throw Object.assign(Error("แพ็กเกจไม่ถูกต้อง"), { status: 400 })
  const rows=await db.prepare("SELECT * FROM package_catalog ORDER BY sort_order,id").all();
  const plan=effectivePlans(rows).find(row=>row.id===id);
  if(!plan)throw Object.assign(Error("ไม่พบแพ็กเกจ"),{status:400});
  return pricedPlan(plan,plan.id==="basic"?await basicPricing(db):null);
}
const tierOrder=["basic","starter","pro","premium"];
export function effectivePlans(rows){
 const plans=rows.map(planDto).map(plan=>plan.id==="pro"?{...plan,features:normalizeSocialFeatures(plan.features),description:normalizeSocialFeatures([plan.description]).length?plan.description:packageContent.pro.description}:plan),byId=new Map(plans.map(plan=>[plan.id,plan]));
 let inherited=[];
 for(const id of tierOrder){const plan=byId.get(id);const required=packageContent[id]?.features||[];inherited=[...new Set([...inherited,...required,...(plan?.features||[]).filter(f=>!(/แบนเนอร์|โฆษณา/.test(f)&&/รายละเอียด/.test(f)))].map(value=>value.trim()).filter(Boolean))];if(plan)plan.features=[...inherited];}
 return plans.map(plan=>({...plan,features:plan.features.filter(feature=>!feature.includes(premiumGuaranteeFeature)),description:plan.id==="basic"?packageContent.basic.description:plan.description.replace(/และการันตีบ้านตรงปก|การันตีบ้านตรงปก/g,""),guarantee:null}));
}

function pricedPlan(plan,basic) {
 if(plan.id!=="basic")return {...plan,regularAmount:plan.amount,discountAmount:0,netAmount:plan.amount,promotion:null}
 return {...plan,...basic,description:basic.promotion?packageContent.basic.description:`${basicVerificationNotice} · ราคาปกติ 990 บาท โปรโมชั่นสิ้นสุดแล้ว สิทธิ์ที่ได้รับเดิมยังคงอยู่`}
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
  const rows=await db.prepare("SELECT * FROM package_catalog ORDER BY sort_order,id").all();
  const pricing=await basicPricing(db);
  return effectivePlans(rows).filter(plan=>all||plan.isActive).map(plan=>pricedPlan(plan,pricing));
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

export async function readContextPlan(db,id,context){
 if(context?.plans.has(id))return planDto(context.plans.get(id));
 const row=await db.prepare("SELECT * FROM package_catalog WHERE id=?").get(id);
 if(!row)throw Object.assign(Error("Unknown package"),{status:400});
 return planDto(row);
}
