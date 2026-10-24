import test from "node:test"
import assert from "node:assert/strict"
import {openTestDatabase} from "./test-database.mjs"
import {createUser} from "./database.mjs"
import {createMailWorker} from "./mail.mjs"
test("a queued payment reminder is retained but never delivered after payment or proof submission",async t=>{
 const db=await openTestDatabase();t.after(()=>db.close())
 const owner=await createUser(db,"mail-owner@example.test","Password12345","Owner")
 await db.prepare("INSERT INTO documents VALUES ('mail-doc',?,?,?,?)").run(owner.id,"proof.pdf","application/pdf",Buffer.from("%PDF-"))
 await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,created) VALUES ('mail-villa',?,'Villa','Bangkok','Owner',?,'starter','mail-doc','now')").run(owner.id,owner.email)
 await db.prepare("INSERT INTO invoices(id,villa_id,amount,months,status,created) VALUES ('mail-invoice','mail-villa',199000,1,'paid','now')").run()
 await db.prepare("INSERT INTO mails(id,villa_id,invoice_id,recipient,subject,body,created) VALUES ('mail-reminder','mail-villa','mail-invoice',?,'Payment reminder','Reminder','now')").run(owner.email)
 let delivered=0;const worker=createMailWorker(db,{serverless:true,smtpFrom:"test@example.test"},{sendMail:async()=>{delivered++}})
 t.after(()=>worker.stop());await worker.run()
 assert.equal(delivered,0);assert.equal((await db.prepare("SELECT status FROM mails WHERE id='mail-reminder'").get()).status,"cancelled")
 assert.equal((await db.prepare("SELECT status FROM invoices WHERE id='mail-invoice'").get()).status,"paid")
 await db.prepare("UPDATE invoices SET status='submitted' WHERE id='mail-invoice'").run()
 await db.prepare("UPDATE mails SET status='queued',next_attempt=0 WHERE id='mail-reminder'").run();await worker.run()
 assert.equal(delivered,0);assert.equal((await db.prepare("SELECT count(*) AS n FROM mails").get()).n,1)
})
