import test from "node:test"
import assert from "node:assert/strict"
import {createOmisePayments,OmiseTestGateway} from "./omise.mjs"
import {openTestDatabase} from "./test-database.mjs"
import {createUser} from "./database.mjs"
async function fixture(t) {
 const db=await openTestDatabase();t.after(()=>db.close())
 const owner=await createUser(db,"omise-owner@example.test","Password12345","Owner")
 await db.prepare("INSERT INTO subscriptions(owner_id,package_id,created) VALUES (?,'basic','now')").run(owner.id)
 await db.prepare("INSERT INTO documents VALUES ('omise-doc',?,?,?,?)").run(owner.id,"proof.pdf","application/pdf",Buffer.from("%PDF-"))
 await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,created) VALUES ('omise-villa',?,'Villa','Bangkok','Owner','omise-owner@example.test','basic','omise-doc','approved','VC-previous','now')").run(owner.id)
 await db.prepare("INSERT INTO invoices(id,villa_id,amount,months,status,package_id,created) VALUES ('omise-invoice','omise-villa',199000,1,'pending','starter','now')").run()
 return {db,owner,invoice:await db.prepare("SELECT * FROM invoices WHERE id='omise-invoice'").get()}
}
test("Omise test gateway rejects live keys, binds server amount/ref_id and never returns raw errors",async()=>{
 assert.throws(()=>new OmiseTestGateway({secretKey:"skey_live_secret"}),{status:503})
 let calls=0
 const gateway=new OmiseTestGateway({secretKey:"skey_test_mock",fetchImpl:async(url,options)=>{calls++;assert.equal(url,"https://api.omise.co/charges");assert.equal(options.body.get("amount"),"199000");assert.equal(options.body.get("ref_id"),"villacheck-invoice");assert.equal(options.body.get("metadata[invoiceId]"),"invoice");return {ok:true,json:async()=>({id:"chrg_test_mock",livemode:false})}}})
 await assert.rejects(gateway.createCharge({invoiceId:"invoice",amount:0,source:"src_test_mock"}),{status:400});assert.equal(calls,0)
 await gateway.createCharge({invoiceId:"invoice",amount:199000,source:"src_test_mock"});assert.equal(calls,1)
})
test("pending survives refresh; verified webhook pays once and leaves Villa waiting for Admin",async t=>{
 const {db,owner,invoice}=await fixture(t);let creates=0,retrieves=0
 let charge={id:"chrg_test_mock",metadata:{invoiceId:invoice.id},livemode:false,amount:invoice.amount,currency:"THB",status:"pending",paid:false}
 const gateway={createCharge:async()=>{creates++;return charge},retrieveCharge:async()=>{retrieves++;return charge},retrieveEvent:async id=>({id,livemode:false,key:"charge.complete",data:{id:charge.id}})}
 const service=createOmisePayments(db,gateway)
 await assert.rejects(service.create({...invoice,currency:"USD"},owner,"src_test_mock"),{status:409})
 await assert.rejects(service.create(invoice,owner,"src_live_wrong"),{status:400})
 assert.equal(creates,0)
 assert.equal((await service.create(invoice,owner,"src_test_mock")).status,"pending")
 assert.equal((await createOmisePayments(db,gateway).status(invoice.id)).status,"pending")
 await service.create(invoice,owner,"src_test_other");assert.equal(creates,1)
 charge={...charge,status:"successful",paid:true,transaction:"trxn_test_mock"}
 await service.webhook({id:"evnt_test_mock",data:{amount:1},status:"failed"})
 const paid=await db.prepare("SELECT * FROM invoices WHERE id=?").get(invoice.id);assert.equal(paid.status,"paid");assert.equal(paid.external_provider,"OMISE")
 const villa=await db.prepare("SELECT * FROM villas WHERE id='omise-villa'").get();assert.equal(villa.status,"pending");assert.equal(villa.verification_level,"REGISTERED");assert.equal(villa.payments,1)
 await service.webhook({id:"evnt_test_mock"});await service.webhook({id:"evnt_test_other"});assert.equal((await db.prepare("SELECT payments FROM villas WHERE id='omise-villa'").get()).payments,1)
 await db.prepare("UPDATE villas SET status='approved',verification_level='VERIFIED' WHERE id='omise-villa'").run()
 const beforeReverse=await db.prepare("SELECT expires,payments FROM villas WHERE id='omise-villa'").get()
 charge={...charge,status:"reversed"}
 assert.equal((await service.webhook({id:"evnt_test_reversal"})).status,"reversed")
 const reversed=await db.prepare("SELECT * FROM villas WHERE id='omise-villa'").get()
 assert.equal(reversed.status,"pending");assert.equal(reversed.payments,beforeReverse.payments);assert.equal(reversed.expires,beforeReverse.expires)
 assert.equal((await db.prepare("SELECT status FROM invoices WHERE id=?").get(invoice.id)).status,"paid","original receipt is retained")
 charge={...charge,status:"pending"}
 assert.equal((await service.webhook({id:"evnt_test_late"})).status,"reversed")
 assert(retrieves>=3)
})
test("amount, currency and unbound webhook cannot mark payment successful",async t=>{
 const {db,owner,invoice}=await fixture(t)
 let charge={id:"chrg_test_mock",metadata:{invoiceId:invoice.id},livemode:false,amount:invoice.amount,currency:"THB",status:"pending"}
 const service=createOmisePayments(db,{createCharge:async()=>charge,retrieveCharge:async()=>charge,retrieveEvent:async id=>({id,livemode:false,key:"charge.complete",data:{id:charge.id}})})
 await service.create(invoice,owner,"src_test_mock")
 for(const mutation of [{amount:1},{currency:"USD"},{id:"chrg_test_other"},{livemode:true}]){
  const previous=charge;charge={...charge,...mutation,status:"successful",paid:true,transaction:"trxn_test_mock"}
  await assert.rejects(service.webhook({id:"evnt_test_bad"}));charge=previous
 }
 assert.equal((await db.prepare("SELECT status FROM invoices WHERE id=?").get(invoice.id)).status,"pending")
 charge={...charge,status:"failed"};assert.equal((await service.status(invoice.id)).status,"failed")
})
test("ambiguous creation blocks retries; zero net bypasses provider entirely",async t=>{
 const {db,owner,invoice}=await fixture(t);let calls=0
 const service=createOmisePayments(db,{createCharge:async()=>{calls++;throw Error("timeout")}})
 await assert.rejects(service.create(invoice,owner,"src_test_mock"))
 await assert.rejects(service.create(invoice,owner,"src_test_mock"),{status:409});assert.equal(calls,1)
 assert.equal((await createOmisePayments(db,null).create({...invoice,amount:0},owner)).status,"NO_PAYMENT_REQUIRED")
})
