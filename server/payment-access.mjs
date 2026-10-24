const fail=message=>{throw Object.assign(Error(message),{status:503})}
export function paymentAccess(config){return config.paymentAccessMode||"LEGACY_MANUAL"}
export function requireManualPayment(config){if(!["LEGACY_MANUAL","DEMO"].includes(paymentAccess(config)))fail("ปิดการรับชำระและยืนยันสลิป manual กรุณาติดต่อผู้ดูแล")}
export function requireNewPayment(config){if(paymentAccess(config)==="DISABLED")fail("ปิดการสร้างรายการชำระชั่วคราว สิทธิ์และประวัติเดิมยังคงอยู่")}
export function paymentConfiguration(env){
 const mode=env.PAYMENT_ACCESS_MODE||(env.NODE_ENV==="production"?"DISABLED":"LEGACY_MANUAL")
 if(!["DISABLED","OMISE_TEST","LEGACY_MANUAL","DEMO"].includes(mode))throw Error("Invalid PAYMENT_ACCESS_MODE")
 if(env.NODE_ENV==="production"&&mode==="LEGACY_MANUAL")throw Error("Production legacy manual payment is disabled; use an isolated non-production reconciliation environment")
 if(mode==="DEMO"&&env.DEMO_MODE!=="true")throw Error("DEMO mode requires DEMO_MODE=true")
 if(mode==="OMISE_TEST"&&env.OMISE_TEST_ENABLED!=="true")throw Error("OMISE_TEST requires test integration configuration")
 return mode
}
