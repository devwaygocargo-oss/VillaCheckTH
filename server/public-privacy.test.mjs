import test from "node:test"
import assert from "node:assert/strict"
import { openTestDatabase } from "./test-database.mjs"
import { createUser, hashPassword } from "./database.mjs"
import { createApp } from "./app.mjs"

test("public QR never exposes bank/phone/reviewer IDs; checks have a durable per-user limit", async t => {
 const db=await openTestDatabase()
 const owner=await createUser(db,"privacy-owner@test.example","Password12345","Owner")
 await createUser(db,"privacy-user@test.example","Password12345","Member","user")
 await createUser(db,"privacy-admin@test.example","Password12345","Admin","admin")
 await db.prepare("INSERT INTO documents VALUES ('privacy-doc',?,?,?,?)").run(owner.id,"proof.pdf","application/pdf",Buffer.from("%PDF-"))
 await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,created,phone,account_number,reviewed_by) VALUES ('privacy-villa',?,'Private Villa','Bangkok','Owner','privacy-owner@test.example','basic','privacy-doc','approved','VC-private','now','0812345678','1234567890','internal-reviewer')").run(owner.id)
 await db.prepare("UPDATE villas SET account_name='Private Account Holder' WHERE id='privacy-villa'").run()
 const app=createApp(db,{serverless:true,appUrl:"http://localhost",allowedOrigins:["http://localhost"],fakeHash:hashPassword("placeholder-password")})
 await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(async()=>{await new Promise(r=>app.close(r));await db.close()})
 const base=`http://127.0.0.1:${app.address().port}/api`
 const request=async(path,data,session)=>{const res=await fetch(base+path,{method:data?"POST":"GET",headers:{"Content-Type":"application/json",...(session?{cookie:session.cookie,"X-CSRF-Token":session.csrf}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,value:await res.json(),cookie:res.headers.get("set-cookie")?.split(";")[0]}}
 const login=async(email,admin=false)=>{const r=await request(admin?"/auth/admin-login":"/auth/login",{email,password:"Password12345"});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf}}
 const ownerSession=await login("privacy-owner@test.example")
 const badUpload=await request("/villas",{name:"Test",nameEn:"Test",province:"Bangkok",merchant:"Owner",email:owner.email,document:{name:"cms-image:forged",data:"data:application/pdf;base64,"+Buffer.from("%PDF-").toString("base64")}},ownerSession)
 assert.equal(badUpload.status,400)
 const user=await login("privacy-user@test.example"),admin=await login("privacy-admin@test.example",true)
 for(const session of [undefined,user,admin]){
  const r=await request("/public/qr/VC-private",undefined,session);assert.equal(r.status,200)
  assert.equal(r.value.locked,true)
  for(const secret of ["0812345678","1234567890","internal-reviewer","Private Account Holder"])assert(!JSON.stringify(r.value).includes(secret))
 }
 const inspection=await request("/admin/qr-verification/VC-private",undefined,admin)
 assert.equal(inspection.value.accountNumber,"1234567890")
 assert.equal((await request("/admin/qr-verification/VC-private",undefined,user)).status,403)
 for(let i=0;i<30;i++)assert.equal((await request("/user/checks",{requestKey:`privacy-${i}`,qr:"VC-private",account:"1234567890"},user)).status,200)
 assert.equal((await request("/user/checks",{requestKey:"too-many",qr:"VC-private",account:"1234567890"},user)).status,429)
 const listing=await request("/public/villas")
 assert(!JSON.stringify(listing.value).includes("1234567890"))
})
