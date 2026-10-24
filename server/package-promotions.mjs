// Percentages are campaign data; monetary bases always come from package_catalog.
export const launchDiscounts={basic:100,starter:100,pro:80,premium:80}
export async function packagePricing(db,plan){
 const rows=await db.prepare("SELECT key,value FROM system_settings WHERE key IN (?,?,?)").all("launch_promotion_active","package_promotion:"+plan.id,"basic_promotion")
 const settings=new Map(rows.map(r=>[r.key,JSON.parse(r.value)])),override=settings.get("package_promotion:"+plan.id)
 const active=plan.id==="basic"?(settings.get("basic_promotion")?.active??true):(settings.get("launch_promotion_active")??true)
 const percent=override?.active===false||!active?0:override?.percent??launchDiscounts[plan.id]??0
 if(!Number.isInteger(percent)||percent<0||percent>100)throw Object.assign(Error("Invalid package promotion"),{status:409})
 const numerator=BigInt(plan.amount)*BigInt(percent)
 const exact=numerator%100n===0n
 return {regularAmount:plan.amount,discountAmount:exact?Number(numerator/100n):null,netAmount:exact?plan.amount-Number(numerator/100n):null,pricingPending:!exact,promotion:percent?{code:"LAUNCH_20261024",percent,revision:override?.revision||settings.get("basic_promotion")?.revision||1}:null}
}
export async function savePackagePromotion(db,user,id,data){
 if(user.role!=="admin")throw Object.assign(Error("เฉพาะ Admin"),{status:403})
 return db.transaction(async()=>{
  if(!await db.prepare("SELECT id FROM package_catalog WHERE id=?").get(id))throw Object.assign(Error("ไม่พบแพ็กเกจ"),{status:404})
  const key="package_promotion:"+id,row=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key),current=row?JSON.parse(row.value):{revision:1}
  if(data.revision!==current.revision)throw Object.assign(Error("โปรโมชั่นเปลี่ยนแล้ว กรุณาโหลดใหม่"),{status:409})
  if(typeof data.active!=="boolean"||!Number.isInteger(data.percent)||data.percent<0||data.percent>100)throw Object.assign(Error("ส่วนลดไม่ถูกต้อง"),{status:400})
  const value={active:data.active,percent:data.percent,revision:current.revision+1,updatedBy:user.id,at:new Date().toISOString()}
  await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,JSON.stringify(value))
  await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run("package_promotion_history:"+id+":"+value.revision,JSON.stringify(value))
  return value
 })
}
