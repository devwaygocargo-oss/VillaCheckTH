import {assertNoUnsettledPackageChange} from "./proration.mjs"
import { saveRecord,preserveApprovedVilla,notifyOwner } from "./approval-history.mjs"
import { confirmPayment } from "./payment-service.mjs"
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
const chargeId=id=>typeof id==="string"&&/^chrg_test_[a-z0-9]+$/.test(id)
export class OmiseTestGateway {
 constructor({secretKey,fetchImpl=fetch}) {
  if(typeof secretKey!=="string"||!/^skey_test_[a-zA-Z0-9]+$/.test(secretKey))fail(503,"Omise requires a test secret key; live mode is disabled")
  this.secretKey=secretKey;this.fetch=fetchImpl
 }
 async request(path,form) {
  let response
  try{response=await this.fetch("https://api.omise.co"+path,{method:form?"POST":"GET",headers:{Authorization:"Basic "+Buffer.from(this.secretKey+":").toString("base64"),"Omise-Version":"2019-05-29",...(form?{"Content-Type":"application/x-www-form-urlencoded"}:{})},body:form?new URLSearchParams(form):undefined,signal:AbortSignal.timeout(10000),redirect:"error"})}catch{fail(503,"Omise unavailable; reconcile existing attempt before retrying")}
  if(!response.ok)fail(502,"Omise rejected the request")
  let value;try{value=await response.json()}catch{fail(502,"Invalid Omise response")}
  if(value.livemode!==false)fail(502,"Omise live or unverifiable response rejected")
  return value
 }
 async createCharge({invoiceId,amount,source}) {
  if(!Number.isSafeInteger(amount)||amount<=0)fail(400,"A charge requires a positive integer amount")
  if(typeof source!=="string"||!/^src_test_[a-z0-9]+$/.test(source))fail(400,"A test payment source is required")
  const charge=await this.request("/charges",{amount:String(amount),currency:"THB",source,ref_id:"villacheck-"+invoiceId,"metadata[invoiceId]":invoiceId})
  if(!chargeId(charge.id))fail(502,"Invalid test charge ID")
  return charge
 }
 async retrieveCharge(id) {
  if(!chargeId(id))fail(400,"Invalid test charge ID")
  return this.request("/charges/"+id)
 }
 async retrieveEvent(id) {
  if(typeof id!=="string"||!/^evnt_test_[a-z0-9]+$/.test(id))fail(400,"Invalid test event ID")
  return this.request("/events/"+id)
 }
}
const read=async(db,key)=>{const row=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key);return row?JSON.parse(row.value):null}
const dto=attempt=>({invoiceId:attempt.invoiceId,provider:"OMISE",mode:"TEST",status:attempt.status,chargeId:attempt.chargeId||null,approvalRequired:["successful","reversed"].includes(attempt.status)})
export function createOmisePayments(db,gateway) {
 const enabled=()=>{if(!gateway)fail(503,"Omise test integration is not configured")}
 async function reconcile(charge,eventId=null) {
  if(!chargeId(charge.id)||charge.livemode!==false)fail(400,"Invalid test charge")
  const invoiceId=charge.metadata?.invoiceId
  if(typeof invoiceId!=="string")fail(400,"Charge has no invoice binding")
  return db.transaction(async()=>{
   const attempt=await read(db,"omise_payment:"+invoiceId),invoice=await db.prepare("SELECT * FROM invoices WHERE id=?").get(invoiceId)
   if(!invoice||!attempt||attempt.chargeId!==charge.id)fail(409,"Unrecognized payment attempt")
   if(charge.amount!==invoice.amount||String(charge.currency).toUpperCase()!=="THB")fail(409,"Payment amount or currency mismatch")
   if(eventId&&await read(db,"omise_event:"+eventId))return dto(attempt)
   if(!["pending","successful","failed","expired","reversed"].includes(charge.status))fail(400,"Unsupported payment status")
   // A provider reversal is recorded for manual reconciliation without deleting
   // the original receipt or inventing a refund/credit policy.
   if(attempt.status==="successful" && charge.status==="reversed") {
    const villa=await db.prepare("SELECT * FROM villas WHERE id=?").get(invoice.villa_id)
    await preserveApprovedVilla(db,villa)
    await db.prepare("UPDATE invoices SET payment_status='FAILED' WHERE id=?").run(invoiceId)
    await db.prepare("UPDATE villas SET status='pending',verification_level='REGISTERED',reason='Omise กลับรายการ รอ Admin ตรวจสอบ' WHERE id=?").run(villa.id)
    attempt.status="reversed";attempt.updatedAt=new Date().toISOString()
    await saveRecord(db,"omise_payment:"+invoiceId,attempt)
    await saveRecord(db,"omise_audit:"+invoiceId+":reversal",{invoiceId,chargeId:charge.id,status:"reversed",eventId,at:attempt.updatedAt})
    await notifyOwner(db,{type:"PAYMENT_REVERSAL_REVIEW",targetId:villa.id,actorId:null,result:"PENDING_RECONCILIATION"})
   }
   // Late pending/failed events cannot rewrite successful or reversed history.
   if(!["successful","reversed"].includes(attempt.status)){
    if(charge.status==="successful"){
     if(charge.paid!==true||typeof charge.transaction!=="string"||!/^trxn_test_[a-z0-9]+$/.test(charge.transaction))fail(409,"Charge is not captured")
     const duplicate=await db.prepare("SELECT id FROM invoices WHERE external_transaction_id=? AND id!=?").get(charge.transaction,invoiceId)
     if(duplicate)fail(409,"Transaction already consumed")
     await db.prepare("UPDATE invoices SET external_provider='OMISE',external_transaction_id=? WHERE id=?").run(charge.transaction,invoiceId)
     const villa=await db.prepare("SELECT * FROM villas WHERE id=?").get(invoice.villa_id)
     await confirmPayment(db,{...invoice,external_provider:"OMISE"},villa,null)
    }
    if(charge.status!=="successful")await db.prepare("UPDATE invoices SET payment_status=? WHERE id=? AND status!='paid'").run(charge.status==="pending"?"VERIFYING":"FAILED",invoiceId)
    attempt.status=charge.status;attempt.updatedAt=new Date().toISOString()
    await saveRecord(db,"omise_payment:"+invoiceId,attempt)
    await saveRecord(db,"omise_audit:"+invoiceId+":"+(eventId||attempt.updatedAt),{invoiceId,chargeId:charge.id,status:attempt.status,eventId,at:attempt.updatedAt})
   }
   if(eventId)await saveRecord(db,"omise_event:"+eventId,{invoiceId,chargeId:charge.id,at:new Date().toISOString()})
   return dto(attempt)
  })
 }
 return {
 async create(invoice,user,source) {
  if(invoice.amount===0)return {invoiceId:invoice.id,status:"NO_PAYMENT_REQUIRED",provider:null}
  enabled()
  if(invoice.status==="paid")fail(409,"Invoice already paid")
  if(!Number.isSafeInteger(invoice.amount)||invoice.amount<0||String(invoice.currency||"THB").toUpperCase()!=="THB")fail(409,"Invoice amount or currency is unsupported")
  if(invoice.subscription_owner)fail(409,"Legacy account-wide invoices require reconciliation before gateway conversion")
  const attempt=await db.transaction(async()=>{
   const current=await db.prepare("SELECT * FROM invoices WHERE id=?").get(invoice.id)
   if(!current || current.status!=="pending" || current.amount!==invoice.amount)fail(409,"Invoice is not available for a new payment")
   const villa=await db.prepare("SELECT * FROM villas WHERE id=?").get(current.villa_id)
   assertNoUnsettledPackageChange(villa,current.package_id||villa.package_id)
   const existing=await read(db,"omise_payment:"+invoice.id)
   if(existing)return {...existing,existing:true}
   if(typeof source!=="string"||!/^src_test_[a-z0-9]+$/.test(source))fail(400,"A test payment source is required")
   const pending={invoiceId:invoice.id,ownerId:user.id,status:"CREATING",createdAt:new Date().toISOString()}
   await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("invoice_gateway:"+invoice.id,"OMISE")
   await db.prepare("UPDATE invoices SET external_provider='OMISE',verification_mode='AUTO',payment_status='VERIFYING' WHERE id=?").run(invoice.id)
   await saveRecord(db,"omise_audit:"+invoice.id+":create",{invoiceId:invoice.id,actorId:user.id,status:"CREATING",at:pending.createdAt})
   await saveRecord(db,"omise_payment:"+invoice.id,pending);return pending
  })
  if(attempt.existing){if(!attempt.chargeId)fail(409,"Payment creation requires reconciliation; automatic duplicate creation is blocked");return this.status(invoice.id)}
  let charge
  try{charge=await gateway.createCharge({invoiceId:invoice.id,amount:invoice.amount,source})}catch(error){await db.transaction(()=>saveRecord(db,"omise_payment:"+invoice.id,{...attempt,status:"UNKNOWN"}));throw error}
  await db.transaction(()=>saveRecord(db,"omise_payment:"+invoice.id,{...attempt,status:"pending",chargeId:charge.id}))
  return reconcile(charge)
 },
 async status(invoiceId){enabled();const attempt=await read(db,"omise_payment:"+invoiceId);if(!attempt)fail(404,"No Omise payment");if(!attempt.chargeId)return dto(attempt);return reconcile(await gateway.retrieveCharge(attempt.chargeId))},
 async webhook(payload){
  enabled()
  // Retrieve the event and charge with the secret key. Do not trust client event data.
  const event=await gateway.retrieveEvent(payload.id)
  if(event.id!==payload.id||event.livemode!==false||!/^charge\.(create|complete|update|capture|expire|reverse)$/.test(event.key))fail(400,"Unrecognized event")
  const charge=await gateway.retrieveCharge(event.data?.id)
  return reconcile(charge,event.id)
 }
 }
}
