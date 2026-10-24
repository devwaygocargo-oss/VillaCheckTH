import {createUser} from "./database.mjs"
import {testReceivingBank} from "./test-receiving-bank.mjs"
import test from "node:test"
import assert from "node:assert/strict"
import {openTestDatabase} from "./test-database.mjs"
test("NestJS HTTP API uses Prisma, preserves guards, cookies, payment and Villa QR",{skip:!process.env.TEST_DATABASE_URL},async t=>{
 const fixture=await openTestDatabase();await testReceivingBank(fixture);const saved={...process.env};
 process.env.DATABASE_URL=fixture.testConnectionString;process.env.APP_URL="http://localhost:8443";process.env.NODE_ENV="test";process.env.ADMIN_EMAIL="admin@nest.test";process.env.ADMIN_PASSWORD="AdminPassword123";
 const {createBackend}=await import("../.build/backend/bootstrap.js");const {app}=await createBackend();await app.listen(0,"127.0.0.1");
 t.after(async()=>{await app.close();await fixture.close();for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved)});
 const base=await app.getUrl();
 const request=async(path,data,session,method)=>{const r=await fetch(base+path,{method:method||(data?"POST":"GET"),headers:{"Content-Type":"application/json",Origin:process.env.APP_URL,...session?{Cookie:session.cookie,"X-CSRF-Token":session.csrf}:{}},body:data?JSON.stringify(data):undefined});const value=await r.json();return{status:r.status,value,cookie:r.headers.get("set-cookie")?.split(";")[0]}};
 assert.equal((await request("/api/health")).status,200);
 assert.equal((await request("/api/packages")).status,401);
 const registration=await request("/api/auth/register",{name:"Merchant",businessNameEn:"Merchant English",email:"merchant@nest.test",password:"MerchantPassword123"});assert.equal(registration.status,503);assert.match(registration.value.error,/OTP/);assert.equal(await fixture.prepare("SELECT id FROM users WHERE email='merchant@nest.test'").get(),undefined);await createUser(fixture,"merchant@nest.test","MerchantPassword123","Merchant");const signedIn=await request("/api/auth/login",{email:"merchant@nest.test",password:"MerchantPassword123"});assert.equal(signedIn.status,200);const merchant={cookie:signedIn.cookie,csrf:signedIn.value.csrf};
 assert.equal((await request("/api/admin/packages",undefined,merchant)).status,403);
 const login=await request("/api/auth/admin-login",{email:"admin@nest.test",password:"AdminPassword123"});const admin={cookie:login.cookie,csrf:login.value.csrf};
 assert.equal((await request("/api/admin/packages",undefined,admin)).status,200);
 assert.equal((await request("/api/subscription",{packageId:"starter"},merchant)).status,409);
 const catalog=(await request("/api/packages",undefined,merchant)).value.packages;assert.equal(catalog.length,4);for(const [lower,higher] of [["basic","starter"],["starter","pro"],["pro","premium"]])for(const feature of catalog.find(p=>p.id===lower).features)assert(catalog.find(p=>p.id===higher).features.includes(feature));
 const document={name:"ownership.pdf",type:"application/pdf",data:`data:application/pdf;base64,${Buffer.from("%PDF-test").toString("base64")}`};
 const created=await request("/api/villas",{name:"Nest Villa",nameEn:"Nest Villa English",province:"ชลบุรี",merchant:"Merchant",email:"merchant@nest.test",document},merchant);assert.equal(created.status,201);const id=created.value.createdId;
 assert.equal((await request(`/api/villas/${id}/review`,{status:"approved"},admin)).status,200);
 assert.equal((await request("/api/merchant/villa-package",{villaId:id,packageId:"starter"},merchant)).status,200);
 let state=(await request("/api/state",undefined,merchant)).value;const payment=state.villas[0].invoices[0];assert.equal(payment.paymentQr.status,"ACTIVE");
 assert.equal((await request(`/api/payments/${payment.id}/slip`,{document,reference:"NEST-BANK-1"},merchant)).status,200);
 assert.equal((await request(`/api/admin/payments/${payment.id}/approve`,{},admin,"PATCH")).status,200);
 state=(await request("/api/state",undefined,merchant)).value;assert.equal(state.villas[0].trialUnlimited,false);assert.ok(state.villas[0].qr);
 assert.equal(state.villas[0].status,"pending");assert.equal((await request(`/api/villas/${id}/review`,{status:"approved"},admin)).status,200);state=(await request("/api/state",undefined,merchant)).value;
 const guest=await request(`/api/public/qr/${state.villas[0].qr}`);assert.equal(guest.value.locked,true);assert.equal(guest.value.qrStatus,"ACTIVE");
 assert.equal((await request("/api/auth/logout",{},merchant)).status,200);
})
