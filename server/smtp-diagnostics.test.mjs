import test from 'node:test'
import assert from 'node:assert/strict'
import {smtpDiagnostic,smtpTransportOptions} from './smtp-diagnostics.mjs'
import {openTestDatabase} from './test-database.mjs'
import {createUser,hashPassword} from './database.mjs'
import {createApp} from './app.mjs'
test('SMTP diagnostics classify actionable failures without retaining provider secrets',()=>{
 for(const [error,category]of [[{code:'EAUTH',responseCode:535},'AUTHENTICATION'],[{code:'ENOTFOUND'},'DNS'],[{code:'ETIMEDOUT'},'CONNECTION'],[{code:'ETLS'},'TLS'],[{responseCode:451},'TEMPORARY_PROVIDER_LIMIT'],[{code:'unknown'},'PROVIDER_ERROR']]){
  const d=smtpDiagnostic({...error,message:'password=SUPER_SECRET',response:'smtp://user:SUPER_SECRET@example.test',command:'AUTH SUPER_SECRET'});assert.equal(d.category,category);assert.ok(!JSON.stringify(d).includes('SUPER_SECRET'))
 }
})
test('SMTP test persists failed and accepted outcomes and exposes diagnostics only to Admin',async t=>{
 const db=await openTestDatabase(),password='SmtpDiagnosticDummy123';await createUser(db,'smtp-admin@example.test',password,'SMTP Admin','admin');await createUser(db,'smtp-user@example.test',password,'SMTP User','user');let failing=true,sends=0
 const origin='http://localhost:8443',server=createApp(db,{appUrl:origin,allowedOrigins:[origin],fakeHash:hashPassword('fake'),smtpFrom:'dummy@example.test'},{verify:async()=>{if(failing)throw Object.assign(Error("TOP_SECRET_PASSWORD"),{code:"EAUTH",responseCode:535});return true},sendMail:async()=>{sends++;if(failing)throw Object.assign(Error('TOP_SECRET_PASSWORD'),{code:'EAUTH',responseCode:535})}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await db.close()})
 const req=async(path,data,s)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:data===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(s?{Cookie:s.cookie,'X-CSRF-Token':s.csrf}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const login=async email=>{const r=await req('/auth/login',{email,password});return {cookie:r.cookie,csrf:r.value.csrf}},admin=await login('smtp-admin@example.test'),user=await login('smtp-user@example.test')
 assert.equal((await req('/admin/email-test',{recipient:'dummy@example.test',confirmed:true},user)).status,403)
 const failed=await req('/admin/email-test',{recipient:'dummy@example.test',confirmed:true},admin);assert.equal(failed.status,502);assert.ok(!JSON.stringify(failed).includes('TOP_SECRET'))
 let state=(await req('/admin/readiness',undefined,admin)).value;assert.equal(state.mail.smtpTest.status,'failed');assert.equal(state.mail.smtpTest.category,'AUTHENTICATION');assert.ok(!JSON.stringify(state).includes('TOP_SECRET'))
 assert.equal((await req('/admin/readiness',undefined,user)).status,403)
 assert.equal((await req('/admin/email-test',{recipient:'dummy@example.test',confirmed:true},admin)).status,429);assert.equal(sends,1)
 await db.prepare("UPDATE system_settings SET value=? WHERE key='smtp:last_test'").run(JSON.stringify({...state.mail.smtpTest,at:'2000-01-01T00:00:00Z'}));failing=false
 assert.equal((await req('/admin/email-test',{recipient:'dummy@example.test',confirmed:true},admin)).status,200)
 state=(await req('/admin/readiness',undefined,admin)).value;assert.equal(state.mail.smtpTest.status,'accepted');assert.equal(state.mail.smtpTest.category,'SMTP_ACCEPTED')
 await db.prepare("UPDATE system_settings SET value=? WHERE key='smtp:last_test'").run(JSON.stringify({at:'2000-01-01T00:00:00Z'}))
 const count=sends,verified=await req('/admin/email-test',{recipient:'dummy@example.test',confirmed:true,verifyOnly:true},admin);assert.equal(verified.status,200);assert.equal(verified.value.acceptedBySmtp,false);assert.equal(verified.value.inboxConfirmationRequired,false);assert.equal(sends,count)
 assert.equal((await req('/admin/readiness',undefined,admin)).value.mail.smtpTest.status,'verified')

})

test('SMTP chooses implicit TLS for port 465 only when no explicit setting exists',()=>{
 assert.equal(smtpTransportOptions({SMTP_PORT:'465'}).secure,true)
 assert.equal(smtpTransportOptions({SMTP_PORT:'465'}).requireTLS,false)
 assert.equal(smtpTransportOptions({SMTP_PORT:'587'}).secure,false)
 assert.equal(smtpTransportOptions({SMTP_PORT:'587'}).requireTLS,true)
 assert.equal(smtpTransportOptions({SMTP_PORT:'465',SMTP_SECURE:'false'}).secure,false)
 assert.throws(()=>smtpTransportOptions({SMTP_PORT:'invalid'}),/Invalid SMTP port/)
})
