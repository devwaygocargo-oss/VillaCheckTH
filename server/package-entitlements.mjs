import { saveRecord } from "./approval-history.mjs"
import { audit } from "./database.mjs"
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
// Preserve the established moderation policy as package data, independent of price.
export const verificationCapabilities={
 basic:{tier:1,documentCheck:true,onlineOwnerVerification:false,propertyInspection:false,latestPhotos:false,guaranteeScopes:[]},
 starter:{tier:2,documentCheck:true,onlineOwnerVerification:true,propertyInspection:false,latestPhotos:false,guaranteeScopes:[]},
 pro:{tier:3,documentCheck:true,onlineOwnerVerification:true,propertyInspection:false,latestPhotos:false,guaranteeScopes:["BOOKING_PROPERTY_PROVIDED"]},
 premium:{tier:4,documentCheck:true,onlineOwnerVerification:true,propertyInspection:true,latestPhotos:true,guaranteeScopes:["PROPERTY_ACCURACY"]}
}
export async function packageEntitlements(db,packageId) {
 const row=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(`package_entitlements:${packageId}`)
 return {...(row?JSON.parse(row.value):{reviewModerationRequired:["pro","premium"].includes(packageId),revision:1}),capabilities:verificationCapabilities[packageId]||null,guarantee:null,guaranteeTermsConfirmed:false}
}
export async function packageEntitlementsApi(db,user,req,path,body) {
 const match=path.match(/^\/api\/admin\/package-entitlements\/([a-z0-9_-]+)$/)
 if(!match)return undefined
 if(user.role!=="admin")fail(403,"เฉพาะ Admin")
 if(!await db.prepare("SELECT id FROM package_catalog WHERE id=?").get(match[1]))fail(404,"ไม่พบแพ็กเกจ")
 if(req.method==="GET")return packageEntitlements(db,match[1])
 if(req.method!=="POST")fail(405,"ไม่รองรับคำสั่งนี้")
 return db.transaction(async()=>{
  const data=await body(req),current=await packageEntitlements(db,match[1])
  if(data.revision!==current.revision)fail(409,"สิทธิ์เปลี่ยนแล้ว กรุณาโหลดล่าสุด")
  if(typeof data.reviewModerationRequired!=="boolean"||data.guarantee!=null)fail(400,"สิทธิ์ไม่ถูกต้อง ขอบเขตการรับประกันรอเจ้าของธุรกิจยืนยัน")
  const next={reviewModerationRequired:data.reviewModerationRequired,guarantee:null,revision:current.revision+1}
  await saveRecord(db,`package_entitlements:${match[1]}`,next)
  await audit(db,user,"package.entitlements.update",match[1])
  return next
 })
}
