import {paymentAccess} from "./payment-access.mjs"
import generatePayload from "promptpay-qr"
import QRCode from "qrcode"
import { drainBankNotifications } from "./bank-receiving.mjs"
import {demoMode} from "./demo-payment.mjs"
import { qrSvg, paymentQrDto } from "./payment-qr.mjs"
export function createMailWorker(db, config, transport) {
 return {run:async()=>{},stop:()=>{}}

  if(config.productionPrelaunch||config.productionRuntime||config.productionReleaseMode)return {run:async()=>{},stop:()=>{}}
  let active
  function run() {
    if (!active)
      active = drain().finally(() => {
        active = undefined
      })
    return active
  }
  async function drain() {
    if(["DISABLED","OMISE_TEST"].includes(paymentAccess(config)))return
    await drainBankNotifications(db,config,transport)
    const demo=await demoMode(db,config)
    if(!transport && !demo)return
    // Delivery leases allow retry after an interrupted function invocation.
    for (let i = 0; i < (config.serverless ? 1 : 10); i++) {
      const now = Date.now()
      // An empty outbox must not queue behind payment/registration transactions.
      // Claiming below remains atomic when multiple workers see the same mail.
      const ready = await db.prepare(
        "SELECT id FROM mails WHERE status IN ('queued','failed','sending') AND next_attempt<=? AND attempts<8 LIMIT 1",
      ).get(now)
      if (!ready) break
      const mail = await db.transaction(() =>
        db.prepare(
          "UPDATE mails SET status='sending',attempts=attempts+1,next_attempt=? WHERE id=(SELECT id FROM mails WHERE status IN ('queued','failed','sending') AND next_attempt<=? AND attempts<8 ORDER BY created LIMIT 1) RETURNING *",
        ).get(now + 120000, now),
      )
      if (!mail) break
      try {
        const currentInvoice=await db.prepare("SELECT status FROM invoices WHERE id=?").get(mail.invoice_id)
        if(!currentInvoice || currentInvoice.status!=="pending") {
          await db.prepare("UPDATE mails SET status='cancelled',last_error='Invoice no longer awaiting payment' WHERE id=?").run(mail.id)
          continue
        }
        if(demo || /\.example$/.test(mail.recipient)){
          await db.prepare("UPDATE mails SET status='demo',sent_at=?,last_error='' WHERE id=?").run(new Date().toISOString(),mail.id)
          continue
        }
        const qr = await paymentQrDto(db, mail.invoice_id)
        const invoice=await db.prepare("SELECT amount,status FROM invoices WHERE id=?").get(mail.invoice_id)
        const bankRow=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(`invoice_receiving_bank:${mail.invoice_id}`)
        const bank=bankRow?JSON.parse(bankRow.value):null
        const attachments=bank&&invoice?.amount>0&&invoice.status==='pending'?[{filename:"villacheck-payment-promptpay.png",content:await QRCode.toBuffer(generatePayload(bank.promptpayId,{amount:invoice.amount/100}),{type:"png",width:512,margin:4}),contentType:"image/png"}]:[]
        await transport.sendMail({
          attachments: [...attachments,...(qr?.payload
            ? [
                {
                  filename: "payment-qr.svg",
                  content: qrSvg(qr.payload),
                  contentType: "image/svg+xml",
                },
              ]
            : [])],
          from: config.smtpFrom,
          to: mail.recipient,
          subject: mail.subject,
          text: `${mail.body}\n\n${mail.payment_instructions ?? (config.paymentInstructions || "กรุณาติดต่อทีมงานเพื่อรับข้อมูลบัญชีชำระเงิน")}`,
          messageId: `<${mail.id}@villacheck.local>`,
        })
        await db
          .prepare(
            "UPDATE mails SET status='sent',sent_at=?,last_error='' WHERE id=?",
          )
          .run(new Date().toISOString(), mail.id)
      } catch (error) {
        // Do not store SMTP credentials, connection URLs, or transport error details.
        const reason =
          error.code === "EAUTH"
            ? "SMTP authentication failed"
            : "SMTP delivery failed; check server SMTP configuration"
        await db
          .prepare(
            "UPDATE mails SET status='failed',last_error=?,next_attempt=? WHERE id=?",
          )
          .run(
            reason,
            Date.now() + Math.min(3600000, 30000 * 2 ** mail.attempts),
            mail.id,
          )
      }
    }
  }
  const timer = config.serverless
    ? null
    : setInterval(
        () =>
          void run().catch(() =>
            console.error("Mail outbox processing failed"),
          ),
        10000,
      )
  timer?.unref()
  if (!config.serverless)
    void run().catch(() => console.error("Mail outbox processing failed"))
  return { run, stop: () => clearInterval(timer) }
}
