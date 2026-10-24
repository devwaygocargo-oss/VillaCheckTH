import {createHash} from "node:crypto"
const fail=()=>{throw Object.assign(Error("หลักฐานหรือเลขธุรกรรมนี้ถูกใช้กับใบแจ้งชำระอื่นแล้ว"),{status:409})}
const hash=value=>createHash("sha256").update(value).digest("hex")
// Must run in the invoice transaction. Unique setting keys serialize retries.
export async function reserveManualProof(db,invoiceId,reference,bytes) {
 const normalized=reference.trim().toUpperCase().replace(/[\s-]/g,"")
 if(!normalized)throw Object.assign(Error("เลขธุรกรรมไม่ถูกต้อง"),{status:400})
 for(const key of ["manual_reference:"+hash(normalized),"manual_proof:"+hash(bytes)]) {
  const previous=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key)
  if(previous&&previous.value!==invoiceId)fail()
  if(!previous)await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run(key,invoiceId)
 }
 return normalized
}
