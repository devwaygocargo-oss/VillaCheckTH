import test from "node:test"
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {openTestDatabase} from "./test-database.mjs"
import {createUser,createInvoice,hashPassword} from "./database.mjs"
import {getPlan,listPlans} from "./catalog.mjs"
import {savePackagePromotion} from "./package-promotions.mjs"
import {createApp} from "./app.mjs"
import {notifyOwner,preserveApprovedVilla} from "./approval-history.mjs"
import {verificationCapabilities,packageEntitlements} from "./package-entitlements.mjs"
import {publicOwnerVerification} from "./owner-verification.mjs"
import {previewPackageChange,proposeCreditLedger} from "./package-change.mjs"
async function villaFixture(t,{launchPromotion=true}={}){
 const db=await openTestDatabase({launchPromotion});t.after(()=>db.close());const password="BusinessUpdate123",owner=await createUser(db,"update-owner@example.test",password,"Owner"),admin=await createUser(db,"update-admin@example.test",password,"Admin","admin"),id=randomUUID(),doc=randomUUID()
 await db.prepare("INSERT INTO subscriptions(owner_id,package_id,created) VALUES (?,'basic','now')").run(owner.id)
 await db.prepare("INSERT INTO documents VALUES (?,?,?,?,?)").run(doc,owner.id,"proof.pdf","application/pdf",Buffer.from("%PDF-"))
 await db.prepare("INSERT INTO villas(id,owner_id,name,name_en,province,merchant,email,package_id,document_id,status,qr,created,phone,account_number,account_name) VALUES (?,?,'Approved Name','Approved Name','Bangkok','Owner',?,'basic',?,'approved','VC-before','now','0800000000','0000000000','Private Holder')").run(id,owner.id,owner.email,doc)
 return {db,owner,admin,id,password,villa:await db.prepare("SELECT * FROM villas WHERE id=?").get(id)}
}
test("launch prices use stored catalog amounts, preserve historical invoices and store immutable discount snapshots",async t=>{
 const {db,owner,admin,villa}=await villaFixture(t)
 const expected={basic:[99000,100,0],starter:[199000,100,0],pro:[299000,80,59800],premium:[499000,80,99800]}
 for(const p of await listPlans(db)){assert.equal(p.amount,expected[p.id][0]);assert.equal(p.regularAmount,p.amount);assert.equal(p.promotion.percent,expected[p.id][1]);assert.equal(p.netAmount,expected[p.id][2])}
 await db.prepare("INSERT INTO invoices(id,villa_id,amount,months,status,created) VALUES ('historic',?,299000,3,'paid','2026-01-01')").run(villa.id)
 const invoiceId=await db.transaction(()=>createInvoice(db,{...villa,package_id:"pro"},"https://staging.example.test"))
 assert.equal((await db.prepare("SELECT amount FROM invoices WHERE id=?").get(invoiceId)).amount,59800)
 const snapshot=(await db.prepare("SELECT value FROM system_settings WHERE key=?").get("invoice_package_promotion:"+invoiceId)).value
 await savePackagePromotion(db,admin,"pro",{revision:1,percent:60,active:true});assert.equal((await getPlan(db,"pro")).netAmount,119600)
 assert.equal((await db.prepare("SELECT amount FROM invoices WHERE id='historic'").get()).amount,299000)
 assert.equal((await db.prepare("SELECT value FROM system_settings WHERE key=?").get("invoice_package_promotion:"+invoiceId)).value,snapshot)
 await db.prepare("UPDATE package_catalog SET amount=100000 WHERE id='premium'").run();assert.equal((await getPlan(db,"premium")).netAmount,20000)
 await db.prepare("UPDATE package_catalog SET amount=100001 WHERE id='premium'").run();assert.equal((await getPlan(db,"premium")).pricingPending,true);await assert.rejects(createInvoice(db,{...villa,package_id:"premium"},"https://staging.example.test"),{status:409})
 await assert.rejects(createInvoice(db,{...villa,package_id:"starter"},"https://staging.example.test"),{status:409})
 assert.equal((await db.prepare("SELECT count(*) AS n FROM invoices").get()).n,2)
 assert((await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'package_promotion_history:%'").all()).length===1)
 assert.equal((await db.prepare("SELECT expires FROM villas WHERE id=?").get(villa.id)).expires,null)
})
test("old QR redirects to latest approved revision; pending snapshot never exposes drafts and financial holds remain blocked",async t=>{
 const {db,owner,admin,id,password,villa}=await villaFixture(t)
 const oldPhoto=randomUUID(),newPhoto=randomUUID(),oldUrl="/api/public/villa-photo/"+oldPhoto,newUrl="/api/public/villa-photo/"+newPhoto,bytes=Buffer.from([255,216,255,0])
 for(const photo of [oldPhoto,newPhoto])await db.prepare("INSERT INTO documents VALUES (?,?,?,?,?)").run(photo,owner.id,"villa-photo","image/jpeg",bytes)
 await db.prepare("UPDATE villas SET photo_url=? WHERE id=?").run(oldUrl,id)
 await preserveApprovedVilla(db,{...villa,photo_url:oldUrl})
 const app=createApp(db,{serverless:true,appUrl:"http://localhost",allowedOrigins:["http://localhost"],fakeHash:hashPassword("placeholder")});await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(()=>new Promise(r=>app.close(r)))
 const base=`http://127.0.0.1:${app.address().port}/api`,request=async(path,data,session)=>{const r=await fetch(base+path,{method:data?"POST":"GET",headers:{"Content-Type":"application/json",...(session?{cookie:session.cookie,"X-CSRF-Token":session.csrf}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,value:await r.json(),cookie:r.headers.get("set-cookie")?.split(";")[0]}}
 const login=async user=>{const r=await request(user.role==="admin"?"/auth/admin-login":"/auth/login",{email:user.email,password});return {cookie:r.cookie,csrf:r.value.csrf}}
 const m=await login(owner),a=await login(admin)
 const input={name:"DRAFT SECRET NAME",nameEn:"Draft",province:"Draft Province",merchant:"Draft Merchant",phone:"0899999999",accountNumber:"9999999999",accountName:"DRAFT ACCOUNT",bankName:"Draft Bank"}
 assert.equal((await request("/merchant/villas/"+id,input,m)).status,200)
 await db.prepare("UPDATE villas SET photo_url=? WHERE id=?").run(newUrl,id)
 const root=base.slice(0,-4),oldResponse=await fetch(root+oldUrl);assert.equal(oldResponse.status,200);assert.deepEqual(Buffer.from(await oldResponse.arrayBuffer()),bytes)
 assert.equal((await fetch(root+newUrl)).status,404)
 for(const path of ["/public/qr/VC-before","/public/villas","/public/property-media?qr=VC-before"]){const r=await request(path);assert.equal(r.status,200);for(const secret of [input.name,input.phone,input.accountNumber,input.accountName])assert(!JSON.stringify(r.value).includes(secret))}
 assert.equal((await request("/public/qr/VC-before")).value.name,"Approved Name")
 assert.equal((await request(`/villas/${id}/review`,{status:"approved"},a)).status,200)
 const latest=await db.prepare("SELECT * FROM villas WHERE id=?").get(id)
 assert.equal((await fetch(root+newUrl)).status,200)
 const redirect=await fetch(base+"/public/qr/VC-before",{redirect:"manual"});assert.equal(redirect.status,307);assert.equal(redirect.headers.get("location"),"/api/public/qr/"+latest.qr)
 const publicData=(await request("/public/qr/VC-before")).value;assert.equal(publicData.qr,latest.qr);assert.equal(publicData.name,input.name);assert.equal(publicData.accountName,undefined);assert.equal(publicData.accountNumber,undefined)
 await db.prepare("UPDATE subscriptions SET lifecycle='SUSPENDED' WHERE owner_id=?").run(owner.id);assert.equal((await request("/public/qr/VC-before")).value.valid,false)
 await db.prepare("UPDATE subscriptions SET lifecycle='ACTIVE' WHERE owner_id=?").run(owner.id)
 await request("/merchant/villas/"+id,{...input,name:"SECOND DRAFT"},m)
 await db.prepare("INSERT INTO invoices(id,villa_id,amount,months,status,payment_status,created) VALUES ('reversal',?,100,1,'paid','FAILED','now')").run(id)
 const held=(await request("/public/qr/"+latest.qr)).value;assert.equal(held.valid,false);assert.equal(held.name,undefined)
})
test("upgrade/downgrade exact preview and proposed credit ledger never settle or double-create credit",async t=>{
 const {db,owner,id}=await villaFixture(t)
 const inputs={paidAmount:100000,targetPeriodAmount:150000,startsAt:"2026-10-01T00:00:00Z",endsAt:"2026-10-31T00:00:00Z",at:"2026-10-16T00:00:00Z",direction:"upgrade"}
 const preview=previewPackageChange(inputs);const value=f=>Number(f.numerator)/Number(f.denominator);assert.equal(value(preview.upgradeDifferenceCandidate),25000)
 const down=previewPackageChange({...inputs,direction:"downgrade",targetPeriodAmount:50000});assert.equal(value(down.downgradeRemainingCreditCandidate),50000);assert.equal(down.refundAllowed,false);assert.equal(down.creditSpendable,false)
 const [a,b]=await Promise.all([proposeCreditLedger(db,{actorId:owner.id,villaId:id,requestKey:"one",inputs}),proposeCreditLedger(db,{actorId:owner.id,villaId:id,requestKey:"one",inputs})]);assert.equal(a.id,b.id);assert.equal(a.status,"PROPOSED_NOT_SPENDABLE")
 await assert.rejects(proposeCreditLedger(db,{actorId:owner.id,villaId:id,requestKey:"one",inputs:{...inputs,paidAmount:0}}),{status:409})
 assert.equal((await db.prepare("SELECT count(*) AS n FROM system_settings WHERE key LIKE 'credit_proposal:%'").get()).n,1)
 assert.equal((await db.prepare("SELECT payments FROM villas WHERE id=?").get(id)).payments,0);assert.equal((await db.prepare("SELECT count(*) AS n FROM invoices").get()).n,0)
})
test("four verification capabilities keep guarantees private; email/notice outboxes deduplicate one event atomically",async t=>{
 const {db,id,admin,villa}=await villaFixture(t)
 assert.deepEqual(Object.values(verificationCapabilities).map(c=>c.tier),[1,2,3,4])
 assert.equal(verificationCapabilities.starter.onlineOwnerVerification,true);assert.equal(verificationCapabilities.premium.propertyInspection,true)
 for(const plan of await listPlans(db)){assert.equal(plan.guarantee,null);assert.equal((await packageEntitlements(db,plan.id)).guaranteeTermsConfirmed,false)}
 await db.prepare("UPDATE package_catalog SET description=?,features=? WHERE id='pro'").run("รับประกันการจองได้บ้าน",JSON.stringify(["รับประกันการจองได้บ้าน"]))
 const publicPlan=(await listPlans(db)).find(p=>p.id==="pro");assert(!JSON.stringify(publicPlan).includes("รับประกันการจองได้บ้าน"))
 await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run("owner_verification:"+id,JSON.stringify({status:"accepted",reviewedAt:"now"}))
 assert.equal(await publicOwnerVerification(db,{...villa,package_id:"pro",payments:1,expires:"2099-01-01",_approvedSnapshot:{ownerVerification:null}}),null)
 const data={type:"APPROVED",targetId:id,actorId:admin.id,result:"approved",eventId:"stable-review-event"}
 const ids=await Promise.all([notifyOwner(db,data),notifyOwner(db,data)]);assert.equal(ids[0],ids[1])
 for(const prefix of ["owner_notification:","email_outbox:","notice_outbox:"])assert.equal((await db.prepare("SELECT count(*) AS n FROM system_settings WHERE key LIKE ?").get(prefix+"%")).n,1)
 const email=JSON.parse((await db.prepare("SELECT value FROM system_settings WHERE key=?").get("email_outbox:"+ids[0])).value);assert.equal(email.status,"PENDING_RECIPIENT");assert.equal(email.attempts,0)
})
