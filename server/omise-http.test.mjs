import test from "node:test"
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {openTestDatabase} from "./test-database.mjs"
import {createUser,hashPassword} from "./database.mjs"
import {createApp} from "./app.mjs"

test("Omise HTTP enforces ownership, backend amount, authenticated status and untrusted webhook verification",async t=>{
 const db=await openTestDatabase(),password="OmiseHttpPassword123"
 const owner=await createUser(db,"omise-http-owner@example.test",password,"Owner"),other=await createUser(db,"omise-http-other@example.test",password,"Other")
 await db.prepare("INSERT INTO subscriptions(owner_id,package_id,created) VALUES (?,'basic','now')").run(owner.id)
 const admin=await createUser(db,"omise-http-admin@example.test",password,"Admin","admin")
 const villaId=randomUUID(),invoiceId=randomUUID(),legacyId=randomUUID()
 await db.prepare("INSERT INTO documents VALUES ('omise-http-doc',?,?,?,?)").run(owner.id,"proof.pdf","application/pdf",Buffer.from("%PDF-"))
 await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,created) VALUES (?,?,'Villa','Bangkok','Owner',?,'basic','omise-http-doc','approved','VC-http-before','now')").run(villaId,owner.id,owner.email)
 await db.prepare("INSERT INTO invoices(id,villa_id,amount,months,status,package_id,created) VALUES (?,?,199000,1,'pending','starter','now')").run(invoiceId,villaId)
 let charge={id:"chrg_test_http",metadata:{invoiceId},livemode:false,amount:199000,currency:"THB",status:"pending"},creates=0,events=0
 const gateway={createCharge:async input=>{creates++;assert.equal(input.amount,199000);assert.equal(input.invoiceId,invoiceId);return charge},retrieveCharge:async()=>charge,retrieveEvent:async id=>{events++;if(id!=="evnt_test_http")throw Object.assign(Error("Unknown event"),{status:400});return {id,livemode:false,key:"charge.complete",data:{id:charge.id}}}}
 const app=createApp(db,{serverless:true,appUrl:"http://localhost",allowedOrigins:["http://localhost"],fakeHash:hashPassword("placeholder-password"),omiseTestEnabled:true,omiseGateway:gateway})
 await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(async()=>{await new Promise(r=>app.close(r));await db.close()})
 const request=async(path,data,session)=>{const res=await fetch(`http://127.0.0.1:${app.address().port}/api`+path,{method:data?"POST":"GET",headers:{"Content-Type":"application/json",...(session?{cookie:session.cookie,"X-CSRF-Token":session.csrf}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,value:await res.json(),cookie:res.headers.get("set-cookie")?.split(";")[0]}}
 const login=async user=>{const r=await request(user.role==="admin"?"/auth/admin-login":"/auth/login",{email:user.email,password});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf}}
 const a=await login(owner),b=await login(other),adminSession=await login(admin),path=`/payments/${invoiceId}/omise`
 assert.equal((await request(path)).status,401);assert.equal((await request(path,{source:"src_test_http"},b)).status,404)
 const created=await request(path,{source:"src_test_http",amount:1,status:"successful"},a);assert.equal(created.status,200);assert.equal(created.value.status,"pending")
 assert.equal((await request(path,undefined,a)).value.status,"pending");assert.equal(creates,1)
 assert.equal((await request(`/invoices/${invoiceId}/proof`,{reference:"fake"},a)).status,409)
 assert.equal((await request("/webhooks/omise",{id:"evnt_test_forged",data:{...charge,status:"successful"}})).status,400)
 assert.equal((await db.prepare("SELECT status FROM invoices WHERE id=?").get(invoiceId)).status,"pending")
 charge={...charge,status:"successful",paid:true,transaction:"trxn_test_http"}
 assert.equal((await request("/webhooks/omise",{id:"evnt_test_http"})).status,200)
 assert.equal((await request("/webhooks/omise",{id:"evnt_test_http"})).status,200)
 assert(events>=3);assert.equal((await request(path,undefined,a)).value.status,"successful")
 const state=(await request("/state",undefined,a)).value;assert.equal(state.villas[0].status,"pending");assert.equal(state.villas[0].paymentStatus,"PAID");assert.equal(state.villas[0].verificationLevel,"REGISTERED")
 assert.equal((await db.prepare("SELECT payments FROM villas WHERE id=?").get(villaId)).payments,1)
 // An invoice predating gateway activation retains the legacy proof workflow.
 await db.prepare("INSERT INTO invoices(id,villa_id,amount,months,status,package_id,created) VALUES (?,?,199000,1,'pending','starter','now')").run(legacyId,villaId)
 const proof={reference:"LEGACY-HTTP",document:{name:"receipt.pdf",data:"data:application/pdf;base64,"+Buffer.from("%PDF-1.4 legacy receipt").toString("base64")}}
 assert.equal((await request(`/invoices/${legacyId}/proof`,proof,a)).status,200)
 charge={...charge,status:"reversed"}
 assert.equal((await request(path,undefined,a)).value.status,"reversed")
 assert.equal((await request(`/villas/${villaId}/review`,{status:"approved"},adminSession)).status,409)
})
