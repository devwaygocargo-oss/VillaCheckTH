import { cmsDefaults } from "./cms-defaults.mjs"
export async function cmsBusiness(db) {
  const row=await db.prepare("SELECT value FROM system_settings WHERE key='cms_published'").get()
  return {...cmsDefaults.business,...(row?JSON.parse(row.value).content.business:{})}
}
export function monthlyValidity(business, cycle, payments) {
  return cycle === "MONTHLY" ? (payments === 0 ? business.monthlyInitialMonths : business.monthlyRenewalMonths) : ({QUARTERLY:3,YEARLY:12}[cycle] || 1)
}
export function paymentTemplate(value, fields) {
  return value.replace(/\{\{(merchant|package|villa)\}\}/g,(_,key)=>fields[key])
}
export async function cmsPaymentSnapshot(db, fallback="") {
  const row=await db.prepare("SELECT value FROM system_settings WHERE key='cms_published'").get()
  return (row?JSON.parse(row.value).content.site.paymentInstructions:"") || fallback || "กรุณาติดต่อทีมงานเพื่อรับข้อมูลบัญชีชำระเงิน"
}
export async function cmsLoginConfig(db,config) {
  const row=await db.prepare("SELECT value FROM system_settings WHERE key='cms_published'").get()
  const business=row?JSON.parse(row.value).content.business:{}
  return {...config,thaiBulkSmsEmailOtpTemplateId:business.emailOtpTemplateId||config.thaiBulkSmsEmailOtpTemplateId,facebookLoginEnabled:business.facebookLoginEnabled??(config.facebookLoginEnabled===true)}
}
export function otpTemplate(value,code) {
  return value.replace(/\{\{(code|minutes)\}\}/g,(_,key)=>key==='code'?code:'5')
}
