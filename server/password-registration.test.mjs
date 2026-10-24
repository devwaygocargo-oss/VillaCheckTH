import test from "node:test"
import assert from "node:assert/strict"
import {openTestDatabase} from "./test-database.mjs"
import {createApp} from "./app.mjs"
import {hashPassword,verifyPassword} from "./database.mjs"

test("password signup creates no account/session before mailbox proof and binds chosen password to the initiating browser",async t=>{
 const db=await openTestDatabase();const delivered=[]
 const config={serverless:true,appUrl:"http://localhost",allowedOrigins:["http://localhost"],fakeHash:hashPassword("placeholder-password"),otpSecret:"registration-test-secret-longer-than-32-characters",smtpFrom:"test@example.test"}
 const app=createApp(db,config,{sendMail:async message=>delivered.push(message)})
 await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(async()=>{await new Promise(r=>app.close(r));await db.close()})
 const request=async(path,data,cookie)=>{const r=await fetch(`http://127.0.0.1:${app.address().port}/api`+path,{method:data?"POST":"GET",headers:{"Content-Type":"application/json",...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,value:await r.json(),cookie:r.headers.get("set-cookie")?.split(";")[0]}}
 for(const role of ["user","merchant"]){
  const email=role+"@signup.example.test",password="ChosenPassword123",pending=await request(role==="user"?"/auth/register-user":"/auth/register",{email,password,name:"Real Owner",businessNameEn:"Real Company",role:"admin"})
  assert.equal(pending.status,202);assert.match(pending.cookie,/^vc_registration=/);assert.equal(pending.value.user,undefined);assert.equal(pending.value.nonce,undefined)
  assert.equal(await db.prepare("SELECT id FROM users WHERE email=?").get(email),undefined)
  assert.equal((await request("/state",undefined,pending.cookie)).status,401)
  assert.equal((await request("/auth/login",{email,password})).status,401)
  const code=delivered.at(-1).text.match(/\d{6}/)[0],body={challengeId:pending.value.challengeId,code}
  assert.equal((await request("/auth/registration/verify",body,"vc_registration="+"f".repeat(64))).status,401)
  const verified=await request("/auth/registration/verify",body,pending.cookie)
  assert.equal(verified.status,200);assert.equal(verified.value.user.role,role);assert.match(verified.cookie,/^vc_session=/)
  assert.equal((await request("/auth/registration/verify",body,pending.cookie)).status,401)
  assert.equal((await request("/auth/login",{email,password})).status,200)
  assert.equal((await db.prepare("SELECT count(*) AS n FROM system_settings WHERE key LIKE 'password_registration:%'").get()).n,0)
 }
 // A pre-registrant holding the signup cookie cannot reclaim an identity after
 // the mailbox owner uses ordinary OTP sign-in from a different browser.
 const pending=await request("/auth/register-user",{email:"victim@signup.example.test",password:"AttackerPassword123",name:"Imposter"})
 const code=delivered.at(-1).text.match(/\d{6}/)[0],body={challengeId:pending.value.challengeId,code}
 const owner=await request("/auth/otp/verify",body)
 assert.equal(owner.status,200)
 assert.equal((await request("/auth/registration/verify",body,pending.cookie)).status,401)
 const claimed=await db.prepare("SELECT * FROM users WHERE email='victim@signup.example.test'").get()
 assert.equal(verifyPassword("AttackerPassword123",claimed.password_hash),false)
})
