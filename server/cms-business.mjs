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
