import test from "node:test"
import assert from "node:assert/strict"
import {openTestDatabase} from "./test-database.mjs"
import {createLoginOtp} from "./login-otp.mjs"
test("slow OTP verification does not hold the write lock; only one consumer succeeds",async t=>{
 const db=await openTestDatabase();t.after(()=>db.close())
 let release,started;const pending=new Promise(r=>release=r),entered=new Promise(r=>started=r)
 const otp=createLoginOtp(db,{otpSecret:"test-otp-secret-longer-than-32-characters",thaiBulkSmsOtpKey:"test-key",thaiBulkSmsOtpSecret:"test-secret"},null,async url=>{
  if(url.endsWith("/request"))return {ok:true,status:200,json:async()=>({status:"success",token:"provider-token"})}
  started();await pending;return {ok:true,status:200,json:async()=>({status:"success"})}
 })
 const challenge=await otp.request({channel:"sms",destination:"0812345678"})
 const first=otp.verify({challengeId:challenge.challengeId,code:"123456"})
 await entered
 let timer
 try {
  await Promise.race([db.transaction(()=>db.prepare("INSERT INTO system_settings(key,value) VALUES ('concurrent-write','ok')").run()),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error("Provider held the write lock")),1000))])
  clearTimeout(timer)
 }finally{clearTimeout(timer);release()}
 const user=await first;assert.equal(user.role,"user")
 await assert.rejects(otp.verify({challengeId:challenge.challengeId,code:"123456"}),{status:401})
})
