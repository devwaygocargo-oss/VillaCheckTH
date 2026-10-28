import {preserveApprovedVilla,notifyOwner,saveRecord} from "./approval-history.mjs"
import {assertNoUnsettledPackageChange} from "./proration.mjs"
import { randomUUID } from "node:crypto"
import { addMonths } from "./database.mjs"
import { activateSubscription } from "./subscriptions.mjs"
// Caller owns one DB transaction covering payment, subscription and Villa QR.
export async function confirmPayment(db, invoice, villa, adminId) {
  const current = await db.prepare("SELECT status FROM invoices WHERE id=?").get(invoice.id)
  if (!current) throw Object.assign(Error("Invoice not found"), {status:404})
  if (current.status === "paid") return
  const affected=invoice.subscription_owner ? await db.prepare("SELECT * FROM villas WHERE owner_id=?").all(invoice.subscription_owner) : [villa]
  for(const target of affected)assertNoUnsettledPackageChange(target,invoice.package_id || target.package_id)
  const sub = invoice.subscription_owner
    ? await db
        .prepare("SELECT * FROM subscriptions WHERE owner_id=?")
        .get(invoice.subscription_owner)
    : null
  if (["SUSPENDED", "CANCELLED"].includes(sub?.lifecycle))
    throw Object.assign(Error("Subscription ถูกระงับหรือยกเลิก"), { status: 409 })
  const needsApproval = true // Every payment requires a separate Villa approval, including renewal.
  for(const target of affected)await preserveApprovedVilla(db,target)
  const now = new Date()
  await db
    .prepare(
      "UPDATE invoices SET status='paid',payment_status='VERIFIED',paid_at=?,confirmed_by=?,updated_at=?,reason='' WHERE id=?",
    )
    .run(now.toISOString(), adminId, now.toISOString(), invoice.id)
  await db
    .prepare(
      "UPDATE payment_qrs SET status='PAID',updated=? WHERE payment_id=? AND status='ACTIVE'",
    )
    .run(now.toISOString(), invoice.id)
  if (invoice.subscription_owner) {
    if (invoice.package_id) {
      await db
        .prepare("UPDATE subscriptions SET package_id=? WHERE owner_id=?")
        .run(invoice.package_id, invoice.subscription_owner)
      await db
        .prepare("UPDATE villas SET package_id=? WHERE owner_id=?")
        .run(invoice.package_id, invoice.subscription_owner)
    }
    await activateSubscription(db,invoice.subscription_owner,invoice.months,now)
    const activated=await db.prepare("SELECT expires,payments FROM subscriptions WHERE owner_id=?").get(invoice.subscription_owner)
    await db.prepare("UPDATE villas SET expires=?,payments=? WHERE owner_id=?").run(activated.expires,activated.payments,invoice.subscription_owner)
  } else {
    const base =
      invoice.package_id === villa.package_id && villa.expires && new Date(villa.expires) > now
        ? new Date(villa.expires)
        : now
    if(invoice.package_id) await db.prepare("UPDATE villas SET package_id=? WHERE id=?").run(invoice.package_id,villa.id)
    await db
      .prepare(
        "UPDATE villas SET qr=?,expires=?,payments=payments+1 WHERE id=?",
      )
      .run(
        villa.qr || `VC-${randomUUID()}`,
        addMonths(base, invoice.months),
        villa.id,
      )
  }
  await saveRecord(db,`payment_audit:${invoice.id}`,{invoiceId:invoice.id,actorId:adminId,provider:invoice.external_provider||"MANUAL",paidAmount:invoice.amount,at:now.toISOString(),approvalRequired:needsApproval})
  for(const target of affected) {
    await db.prepare("UPDATE villas SET status='pending',reason='ชำระเงินแล้ว รอ Admin ตรวจสอบสิทธิ์แพ็กเกจ',verification_level='REGISTERED' WHERE id=?").run(target.id)
    await notifyOwner(db,{type:"PAYMENT_AWAITING_APPROVAL",targetId:target.id,actorId:adminId,result:"PENDING_APPROVAL"})
  }

}
