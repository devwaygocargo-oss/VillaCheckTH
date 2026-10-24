import {rememberQr} from "./public-revision.mjs"
import {createHash} from "node:crypto"
import { randomUUID } from "node:crypto"
export async function saveRecord(db,key,value) {
 await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,JSON.stringify(value))
}
export async function preserveApprovedVilla(db,villa) {
 if(villa.status !== "approved") return
 await rememberQr(db,villa)
 const details=await db.prepare("SELECT value FROM system_settings WHERE key=?").get("villa_page:"+villa.id)
 const media=await db.prepare("SELECT value FROM system_settings WHERE key LIKE ?").all("property_media:"+villa.id+":%")
 const proof=await db.prepare("SELECT value FROM system_settings WHERE key=?").get("owner_verification:"+villa.id)
 const snapshot={villa,ownerVerification:proof?JSON.parse(proof.value):null,propertyDetails:details?JSON.parse(details.value):null,media:media.map(row=>JSON.parse(row.value)).filter(row=>row.reviewedAt&&!row.removedAt),recordedAt:new Date().toISOString()}
 await saveRecord(db,`villa_approved:${villa.id}`,snapshot)
 await saveRecord(db,`villa_approved_history:${randomUUID()}`,snapshot)
}
// Transactional outbox: no external delivery in the approval transaction.
export async function notifyOwner(db,{type,targetId,actorId,result,eventId}) {
 return db.transaction(async()=>{
 const id=eventId?createHash("sha256").update(JSON.stringify([type,targetId,eventId])).digest("hex"):randomUUID()
 const existing=await db.prepare("SELECT value FROM system_settings WHERE key=?").get("owner_notification:"+id)
 if(existing)return id
 await saveRecord(db,`email_outbox:${id}`,{id,type,targetId,actorId,result,status:"PENDING_RECIPIENT",channel:"EMAIL",attempts:0})
 await saveRecord(db,`notice_outbox:${id}`,{id,type,targetId,actorId,result,status:"PENDING_RECIPIENT",channel:"IN_APP",attempts:0})
 await saveRecord(db,`owner_notification:${id}`,{id,type,targetId,actorId,result,createdAt:new Date().toISOString(),status:"PENDING_DELIVERY",channels:{email:{status:"PENDING_RECIPIENT",attempts:0},notice:{status:"AVAILABLE"}},eventId:eventId||id})
 return id
 })
}
export async function approvalHistory(db,villa,user,result) {
 const id=randomUUID(),record={id,villaId:villa.id,actorId:user.id,approverId:user.id,result,at:new Date().toISOString(),reviewId:villa.reviewId||null}
 await saveRecord(db,`villa_approval_history:${id}`,record)
 await notifyOwner(db,{type:"VILLA_REVIEW",targetId:villa.id,actorId:user.id,result,eventId:id})
}

// An explicit Admin media/detail review is also an approval of a public revision.
export async function rotateApprovedRevision(db,villa,user,type) {
 if(user.role!=="admin")throw Object.assign(Error("Admin permission required"),{status:403})
 if(villa.status!=="approved")return null
 await rememberQr(db,villa)
 const qr=`VC-${randomUUID()}`
 await db.prepare("UPDATE villas SET qr=? WHERE id=?").run(qr,villa.id)
 await preserveApprovedVilla(db,await db.prepare("SELECT * FROM villas WHERE id=?").get(villa.id))
 await approvalHistory(db,villa,user,type)
 return qr
}
