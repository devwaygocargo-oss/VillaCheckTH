import test from "node:test"
import assert from "node:assert/strict"
import {openTestDatabase} from "./test-database.mjs"
import {createUser,hashPassword} from "./database.mjs"
import {createApp} from "./app.mjs"

test("HTTP journey: verified signup, Basic grant, approval, privacy, edit/new QR, history and logout",async t=>{
 const db=await openTestDatabase(),password="JourneyPassword123",messages=[]
 await createUser(db,"journey-admin@example.test",password,"QA Admin","admin")
 const app=createApp(db,{serverless:true,appUrl:"http://localhost",allowedOrigins:["http://localhost"],fakeHash:hashPassword("placeholder"),otpSecret:"phase2-journey-synthetic-secret-32-characters",smtpFrom:"qa@example.test"},{sendMail:async m=>messages.push(m)})
 await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(async()=>{await new Promise(r=>app.close(r));await db.close()})
 const base=`http://127.0.0.1:${app.address().port}/api`
 const request=async(path,data,session,headers={})=>{const r=await fetch(base+path,{method:data?"POST":"GET",headers:{"Content-Type":"application/json",...(session?{cookie:session.cookie,"X-CSRF-Token":session.csrf}:{}),...headers},body:data?JSON.stringify(data):undefined});return {status:r.status,value:await r.json(),cookie:r.headers.get("set-cookie")?.split(";")[0]}}
 const login=async(email,admin=false)=>{const r=await request(admin?"/auth/admin-login":"/auth/login",{email,password});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf}}
 const accounts={}
 for(const role of ["user","merchant"]){
  const email=`journey-${role}@example.test`,r=await request(role==="user"?"/auth/register-user":"/auth/register",{email,password,name:"QA "+role,businessNameEn:"QA Merchant"});assert.equal(r.status,202)
  assert.equal(await db.prepare("SELECT id FROM users WHERE email=?").get(email),undefined)
  const code=messages.at(-1).text.match(/\d{6}/)[0]
  assert.equal((await request("/auth/registration/verify",{challengeId:r.value.challengeId,code},{cookie:r.cookie})).status,200)
  accounts[role]=await login(email)
 }
 const admin=await login("journey-admin@example.test",true),merchant=accounts.merchant,user=accounts.user
 const data={name:"QA Villa",nameEn:"QA Villa",province:"ชลบุรี",merchant:"QA Merchant",email:"journey-merchant@example.test",guestCapacity:8,phone:"0800000000",bankName:"QA Bank",accountName:"QA Account",accountNumber:"0000000000",document:{name:"qa.pdf",data:"data:application/pdf;base64,"+Buffer.from("%PDF-1.4 synthetic").toString("base64")}}
 const created=await request("/villas",data,merchant);assert.equal(created.status,201);const id=created.value.createdId
 assert.equal(created.value.villas[0].status,"pending");assert.equal(created.value.villas[0].invoices.length,0)
 const plans=await request("/packages",undefined,merchant),basic=plans.value.packages.find(p=>p.id==="basic");assert.equal(basic.regularAmount,99000);assert.equal(basic.discountAmount,99000);assert.equal(basic.netAmount,0)
 assert.equal((await request(`/villas/${id}/review`,{status:"approved"},user)).status,403)
 assert.equal((await request(`/villas/${id}/review`,{status:"approved"},admin,{"X-CSRF-Token":"wrong"})).status,403)
 assert.equal((await request(`/villas/${id}/review`,{status:"changes",reason:"QA ขอแก้เอกสาร"},admin)).status,200)
 assert.equal((await request("/state",undefined,merchant)).value.villas[0].approvalStatus,"CHANGE_REQUESTED")
 assert.equal((await request(`/villas/${id}/resubmit`,{document:data.document},merchant)).status,200)
 assert.equal((await request(`/villas/${id}/review`,{status:"approved"},admin)).status,200)
 const state=(await request("/state",undefined,merchant)).value,villa=state.villas[0],qr=villa.qr
 assert.equal(Boolean(villa.expires),false);assert.equal(villa.invoices.length,0)
 assert((await request("/public/villas?province="+encodeURIComponent("ชลบุรี"))).value.villas.some(v=>v.id===id))
 const detail=await request("/public/qr/"+qr);assert.equal(detail.value.name,data.name);assert.equal(detail.value.locked,true);assert.equal(detail.value.accountNumber,undefined)
 const check={qr,requestKey:"journey-check",account:"0000000000",contact:"0800000000"}
 assert.equal((await request("/user/checks",check,user)).value.status,"MATCHED")
 assert.equal((await request("/user/checks",check,user)).value.status,"MATCHED")
 assert.equal((await request(`/merchant/villas/${id}`,{...data,name:"QA Villa Edited"},user)).status,403)
 assert.equal((await request(`/merchant/villas/${id}`,{...data,name:"QA Villa Edited"},merchant)).status,200)
 assert.equal((await request("/public/qr/"+qr)).value.name,undefined)
 assert.equal((await request(`/villas/${id}/review`,{status:"approved"},admin)).status,200)
 const after=(await request("/state",undefined,merchant)).value.villas[0];assert.notEqual(after.qr,qr);assert.equal(after.name,"QA Villa Edited");assert.equal((await request("/public/qr/"+qr)).status,404)
 assert.equal((await request("/public/qr/"+after.qr)).value.name,after.name)
 assert((await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'villa_approved_history:%'").all()).length>=2)
 assert((await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'owner_notification:%'").all()).length>=2)
 assert((await db.prepare("SELECT id FROM audits WHERE target_id=?").all(id)).length>=4)
 assert.equal((await request("/admin/owner-notifications",undefined,user)).status,403)
 assert.equal((await request("/admin/owner-notifications",undefined,admin)).status,200)
 for(const lifecycle of ["SUSPENDED","CANCELLED"]){
  await db.prepare("UPDATE subscriptions SET lifecycle=? WHERE owner_id=(SELECT owner_id FROM villas WHERE id=?)").run(lifecycle,id)
  assert.equal((await request("/state",undefined,merchant)).value.villas[0].subscriptionStatus,lifecycle)
 }
 assert.equal((await request("/auth/logout",{},user)).status,200);assert.equal((await request("/auth/me",undefined,user)).status,401)
})
