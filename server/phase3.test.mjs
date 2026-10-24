import {createLoginOtp} from "./login-otp.mjs"
import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {request as httpRequest} from "node:http"
import test from "node:test"
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {openTestDatabase} from "./test-database.mjs"
import {createUser,hashPassword} from "./database.mjs"
import {createApp} from "./app.mjs"
import {createOmisePayments,chargePresentation,OmiseTestGateway} from "./omise.mjs"
import {paymentConfiguration} from "./payment-access.mjs"
import {stagingMailTransport} from "./staging-mail.mjs"
import {testReceivingBank} from "./test-receiving-bank.mjs"
async function fixture(t){
 const db=await openTestDatabase();t.after(()=>db.close());const password="Phase3Fixture123",owner=await createUser(db,"phase3-owner@example.test",password,"Owner"),admin=await createUser(db,"phase3-admin@example.test",password,"Admin","admin"),id=randomUUID(),invoiceId=randomUUID(),doc=randomUUID()
 await db.prepare("INSERT INTO subscriptions(owner_id,package_id,created) VALUES (?,'basic','now')").run(owner.id)
 await db.prepare("INSERT INTO documents VALUES (?,?,?,?,?)").run(doc,owner.id,"proof.pdf","application/pdf",Buffer.from("%PDF-"))
 await db.prepare("INSERT INTO villas(id,owner_id,name,name_en,province,merchant,email,package_id,document_id,status,qr,created) VALUES (?,?,'QA Villa','QA Villa','Bangkok','Owner',?,'basic',?,'approved','VC-phase3','now')").run(id,owner.id,owner.email,doc)
 await db.prepare("INSERT INTO invoices(id,villa_id,amount,months,status,package_id,created) VALUES (?,?,199000,1,'pending','starter','now')").run(invoiceId,id)
 return {db,owner,admin,id,invoiceId,password,invoice:await db.prepare("SELECT * FROM invoices WHERE id=?").get(invoiceId)}
}
test("test checkout validates source server-side, binds return URI and restores pending actions once",async t=>{
 const {db,owner,invoice}=await fixture(t);let creates=0,sources=0
 let charge={id:"chrg_test_phase3",livemode:false,metadata:{invoiceId:invoice.id},amount:invoice.amount,currency:"THB",status:"pending",authorize_uri:"https://api.omise.co/payments/paym_test_phase3/authorize",source:{scannable_code:{image:{download_uri:"https://api.omise.co/charges/chrg_test_phase3/documents/docu_test_phase3/downloads/ABC123"}}}}
 const gateway={retrieveSource:async id=>{sources++;return {id,livemode:false,type:"promptpay",amount:invoice.amount,currency:"THB"}},createCharge:async data=>{creates++;assert.equal(data.amount,invoice.amount);assert.equal(data.returnUri,"https://staging.example.test/#page=owner-package&item="+invoice.id);return charge},retrieveCharge:async()=>charge}
 const service=createOmisePayments(db,gateway,{appUrl:"https://staging.example.test",methods:["promptpay"]})
 const settled=await Promise.allSettled([service.create(invoice,owner,"src_test_one"),service.create(invoice,owner,"src_test_two")]);assert(settled.some(r=>r.status==="fulfilled"));assert.equal(creates,1);assert.equal(sources,1)
 const pending=await service.status(invoice.id);assert.equal(pending.authorizeUri,charge.authorize_uri);assert.equal(pending.qrImage,charge.source.scannable_code.image.download_uri)
 await service.create(invoice,owner,"src_test_again");assert.equal(creates,1)
 charge={...charge,status:"failed"};assert.equal((await service.status(invoice.id)).authorizeUri,null)
 assert.equal((await db.prepare("SELECT payments FROM villas WHERE id=?").get(invoice.villa_id)).payments,0)
 charge={...charge,status:"successful",paid:true,transaction:"trxn_test_phase3"};await service.status(invoice.id);await service.status(invoice.id)
 const after=await db.prepare("SELECT * FROM villas WHERE id=?").get(invoice.villa_id);assert.equal(after.payments,1);assert.equal(after.status,"pending")
})
test("mismatched and live sources cannot create charges",async t=>{
 for(const mismatch of [{livemode:true},{amount:1},{currency:"USD"},{type:"mobile_banking_scb"},{id:"src_test_other"}]){
  const {db,owner,invoice}=await fixture(t);let creates=0
  const service=createOmisePayments(db,{retrieveSource:async()=>({id:"src_test_input",livemode:false,amount:invoice.amount,currency:"THB",type:"promptpay",...mismatch}),createCharge:async()=>{creates++;throw Error("must not charge")}},{methods:["promptpay"]})
  await assert.rejects(service.create(invoice,owner,"src_test_input"),{status:400});assert.equal(creates,0);assert.equal((await db.prepare("SELECT status FROM invoices WHERE id=?").get(invoice.id)).status,"pending")
 }
})
test("provider actions reject unsafe redirects and unrelated QR URLs; live credentials remain rejected",async()=>{
 assert.throws(()=>new OmiseTestGateway({secretKey:"skey_live_forbidden"}),{status:503})
 for(const authorize_uri of ["javascript:alert(1)","https://api.omise.co.attacker.test/payments/paym_test_id/authorize","https://user@api.omise.co/payments/paym_test_id/authorize","https://api.omise.co/payments/paym_live_id/authorize"])
  assert.throws(()=>chargePresentation({id:"chrg_test_id",authorize_uri}),{status:502})
 assert.throws(()=>chargePresentation({id:"chrg_test_id",source:{scannable_code:{image:{download_uri:"https://api.omise.co/charges/chrg_test_other/documents/docu_test_id/downloads/ABC"}}}}),{status:502})
 assert.equal(paymentConfiguration({NODE_ENV:"production"}),"DISABLED")
 assert.throws(()=>paymentConfiguration({NODE_ENV:"production",PAYMENT_ACCESS_MODE:"LEGACY_MANUAL"}))
})
test("payment disable blocks manual aliases, QR, positive invoices and mail while preserving history and Basic",async t=>{
 const {db,owner,admin,id,invoiceId,password}=await fixture(t);await testReceivingBank(db);let sends=0
 const config={paymentAccessMode:"DISABLED",serverless:true,appUrl:"http://localhost",allowedOrigins:["http://localhost"],fakeHash:hashPassword("placeholder"),smtpFrom:"qa@example.test"}
 const app=createApp(db,config,{sendMail:async()=>{sends++}});await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(()=>new Promise(r=>app.close(r)))
 const base=`http://127.0.0.1:${app.address().port}/api`,request=async(path,data,user,method)=>{const r=await fetch(base+path,{method:method||(data?"POST":"GET"),headers:{"Content-Type":"application/json",...(user?{cookie:user.cookie,"X-CSRF-Token":user.csrf}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,value:await r.json(),cookie:r.headers.get("set-cookie")?.split(";")[0]}}
 const login=async account=>{const r=await request(account.role==="admin"?"/auth/admin-login":"/auth/login",{email:account.email,password});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf}}
 const merchant=await login(owner),a=await login(admin)
 for(const path of [`/invoices/${invoiceId}/proof`,`/payments/${invoiceId}/slip`,`/payments/${invoiceId}/qr`,`/payments/${invoiceId}/demo-slip`])assert.equal((await request(path,{},merchant)).status,503)
 assert.equal((await request(`/invoices/${invoiceId}/confirm`,{},a)).status,503);assert.equal((await request(`/admin/payments/${invoiceId}/approve`,{},a,"PATCH")).status,503)
 assert.equal((await request("/admin/receiving-bank/email",{},a)).status,503)
 await db.prepare("UPDATE invoices SET status='paid' WHERE id=?").run(invoiceId)
 assert.equal((await request("/merchant/villa-package",{villaId:id,packageId:"starter"},merchant)).status,503)
 assert.equal((await request("/merchant/villa-package",{villaId:id,packageId:"basic"},merchant)).status,200)
 const state=(await request("/state",undefined,merchant)).value;assert.equal(state.villas[0].invoices.length,1);assert.equal(state.villas[0].invoices[0].bankQrImage,"");assert.equal(state.paymentConfigured,false);assert.equal(state.paymentBankQrImage,"")
 await app.runMail();assert.equal(sends,0);assert.equal((await request("/config")).value.paymentConfigured,false)
})
test("staging mail rejects non-test recipients before delivery and diagnostics do not send by default",async()=>{
 let sends=0,verifies=0;const transport=stagingMailTransport({sendMail:async()=>{sends++},verify:async()=>{verifies++}},{APP_ENV:"staging",STAGING_EMAIL_ALLOWLIST:"qa@example.test"})
 assert.throws(()=>transport.sendMail({to:"customer@example.test"}),{code:"EENVELOPE"});assert.throws(()=>transport.sendMail({to:"qa@example.test",bcc:"customer@example.test"}),{code:"EENVELOPE"})
 await transport.sendMail({to:"qa@example.test"});await transport.verify();assert.equal(sends,1);assert.equal(verifies,1)
 const closed=stagingMailTransport({sendMail:async()=>{throw Error("must not send")}},{APP_ENV:"staging"});assert.throws(()=>closed.sendMail({to:"qa@example.test"}),{code:"EENVELOPE"})
})

test("Vercel admin login honors staging APP_URL and refuses another host",async t=>{
 const {db,admin,password}=await fixture(t),app=createApp(db,{trustVercelProxy:true,serverless:true,appUrl:"https://staging.example.test",allowedOrigins:["https://staging.example.test"],fakeHash:hashPassword("placeholder")})
 await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(()=>new Promise(r=>app.close(r)))
 const request=host=>new Promise((resolve,reject)=>{const req=httpRequest(`http://127.0.0.1:${app.address().port}/api/auth/admin-login`,{method:"POST",headers:{host,Origin:"https://staging.example.test","Content-Type":"application/json"}},res=>{res.resume();res.once("end",()=>resolve({status:res.statusCode}))});req.once("error",reject);req.end(JSON.stringify({email:admin.email,password}))})
 assert.equal((await request("another.example.test")).status,403);assert.equal((await request("staging.example.test")).status,200)
})

test("staging OTP blocks non-allowlisted recipients for direct provider API as well as SMTP",async t=>{
 const db=await openTestDatabase();t.after(()=>db.close());let calls=0
 const otp=createLoginOtp(db,{appEnvironment:"staging",stagingEmailAllowlist:["qa@example.test"],otpSecret:"phase3-otp-synthetic-secret-32-characters",thaiBulkSmsEmailOtpTemplateId:"test-template",thaiBulkSmsApiKey:"test-key",thaiBulkSmsApiSecret:"test-secret"},{sendMail:async()=>{calls++}},async()=>{calls++;throw Error("must not call provider")})
 await assert.rejects(otp.request({channel:"email",destination:"customer@example.test"}),{status:403});assert.equal(calls,0);assert.equal((await db.prepare("SELECT count(*) AS n FROM login_otps").get()).n,0)
 const result=await promisify(execFile)(process.execPath,["scripts/staging-diagnostics.mjs"],{env:{APP_ENV:"staging",SMTP_PASSWORD:"dummy-private-value",SMTP_HOST:"invalid.example.test"}})
 assert(!result.stdout.includes("dummy-private-value"));assert(!result.stdout.includes("invalid.example.test"));assert.equal(JSON.parse(result.stdout).providerAcceptance,false)
})

test("checkout HTTP config is invoice-scoped, exposes only test public key and ignores client redirect/amount",async t=>{
 const {db,owner,invoice,invoiceId,password}=await fixture(t);const other=await createUser(db,"phase3-other@example.test",password,"Other");let chargeCreates=0
 const charge={id:"chrg_test_checkout",livemode:false,metadata:{invoiceId},amount:invoice.amount,currency:"THB",status:"pending",authorize_uri:"https://api.omise.co/payments/paym_test_checkout/authorize"}
 await db.prepare("UPDATE invoices SET external_provider='OMISE' WHERE id=?").run(invoiceId)
 const gateway={retrieveSource:async id=>({id,livemode:false,type:"promptpay",amount:invoice.amount,currency:"THB"}),createCharge:async input=>{chargeCreates++;assert.equal(input.amount,invoice.amount);assert.equal(input.returnUri,"https://staging.example.test/#page=owner-package&item="+invoiceId);return charge},retrieveCharge:async()=>charge}
 const app=createApp(db,{paymentAccessMode:"OMISE_TEST",serverless:true,appUrl:"https://staging.example.test",allowedOrigins:["https://staging.example.test"],fakeHash:hashPassword("placeholder"),omiseTestEnabled:true,omiseGateway:gateway,omiseTestPublicKey:"pkey_test_public",omiseTestSecretKey:"skey_test_neverexpose",omiseTestMethods:["promptpay"]})
 await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(()=>new Promise(r=>app.close(r)))
 const base=`http://127.0.0.1:${app.address().port}/api`,request=async(path,data,session)=>{const r=await fetch(base+path,{method:data?"POST":"GET",headers:{"Content-Type":"application/json",...(session?{cookie:session.cookie,"X-CSRF-Token":session.csrf}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,value:await r.json(),cookie:r.headers.get("set-cookie")?.split(";")[0]}}
 const login=async account=>{const r=await request("/auth/login",{email:account.email,password});return {cookie:r.cookie,csrf:r.value.csrf}}
 const a=await login(owner),b=await login(other),path=`/payments/${invoiceId}`
 assert.equal((await request(path+"/checkout")).status,401);assert.equal((await request(path+"/checkout",undefined,b)).status,404)
 const config=await request(path+"/checkout",undefined,a);assert.equal(config.value.enabled,true);assert.equal(config.value.amount,199000);assert.deepEqual(config.value.methods,["promptpay"]);assert(!JSON.stringify(config).includes("skey_test_"))
 const result=await request(path+"/omise",{source:"src_test_checkout",amount:1,returnUri:"https://attacker.example.test",status:"successful"},a);assert.equal(result.status,200);assert.equal(result.value.status,"pending")
 assert.equal((await request(path+"/omise",undefined,a)).value.status,"pending");assert.equal(chargeCreates,1)
 await db.prepare("UPDATE invoices SET external_provider='MANUAL' WHERE id=?").run(invoiceId)
 assert.equal((await request(path+"/omise",{source:"src_test_other"},a)).status,409);assert.equal(chargeCreates,1)
})
