import {packagePricing} from "./package-promotions.mjs"
import { saveRecord } from "./approval-history.mjs"
import { audit } from "./database.mjs"
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
export async function basicPricing(db) {
 const plan=await db.prepare("SELECT * FROM package_catalog WHERE id='basic'").get()
 return packagePricing(db,plan)
}
export async function grantBasicPromotion(db,villaId,ownerId) {
 const existing=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(`basic_grant:${villaId}`)
 if(existing)return JSON.parse(existing.value)
 const catalog=await db.prepare("SELECT active FROM package_catalog WHERE id='basic'").get()
 if(!catalog?.active)fail(409,"แพ็กเกจ Basic ยังไม่เปิดรับสิทธิ์ใหม่")
 const pricing=await basicPricing(db)
 if(pricing.netAmount!==0)fail(409,"โปรโมชั่น Basic สิ้นสุดแล้ว การสมัครแบบชำระเงินรอยืนยันเงื่อนไข กรุณาติดต่อทีมงาน")
 await saveRecord(db,`basic_grant:${villaId}`,{villaId,ownerId,...pricing,grantedAt:new Date().toISOString(),grandfathered:true})
 return pricing
}
export async function basicPromotionApi(db,user,req,path,body) {
 if(path!=="/api/admin/basic-promotion")return undefined
 if(user.role!=="admin")fail(403,"เฉพาะ Admin")
 if(req.method==="POST")return db.transaction(async()=>{
  const data=await body(req),row=await db.prepare("SELECT value FROM system_settings WHERE key='basic_promotion'").get()
  const current=row?JSON.parse(row.value):{active:true,revision:1}
  if(typeof data.active!=="boolean")fail(400,"ระบุสถานะโปรโมชั่น")
  if(data.revision!==current.revision)fail(409,"โปรโมชั่นเปลี่ยนแล้ว กรุณาโหลดล่าสุด")
  await saveRecord(db,"basic_promotion",{active:data.active,revision:current.revision+1,updatedBy:user.id,updatedAt:new Date().toISOString()})
  await audit(db,user,"basic.promotion.update","basic")
  return {...await basicPricing(db),revision:current.revision+1}
 })
 if(req.method!=="GET")fail(405,"ไม่รองรับคำสั่งนี้")
 const row=await db.prepare("SELECT value FROM system_settings WHERE key='basic_promotion'").get()
 return {...await basicPricing(db),revision:row?JSON.parse(row.value).revision:1}
}
