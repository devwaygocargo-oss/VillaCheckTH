import test from 'node:test'
import assert from 'node:assert/strict'
import {openTestDatabase} from './test-database.mjs'
import {createApp} from './app.mjs'
import {createUser,hashPassword} from './database.mjs'
import {seedDemo,dummyPdf} from './demo-seed.mjs'

test('Per-property package selection preserves free access and changes paid rights only after payment',async t=>{
 const db=await openTestDatabase(),password='DummyPackageSelection123';await seedDemo(db,{password,adminEmail:'chooser-admin@example.test',adminPassword:password});await createUser(db,'chooser-new@example.test',password,'Dummy New Merchant','merchant')
 const config={appUrl:'http://localhost:8443',allowedOrigins:['http://localhost:8443'],fakeHash:hashPassword('fake'),serverless:true,demoMode:true,paymentInstructions:'DUMMY BANK - NO REAL TRANSFER'}
 const server=createApp(db,config);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await server.runMail();await new Promise(r=>server.close(r));await db.close()})
 const req=async(path,data,session)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:data===undefined?'GET':'POST',headers:{Origin:config.appUrl,'Content-Type':'application/json',...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})},body:data===undefined?undefined:JSON.stringify(data)});return{status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const login=async email=>{const r=await req(((await db.prepare("SELECT role FROM users WHERE email=?").get(email))?.role === "admin" ? "/auth/admin-login" : "/auth/login"),{email,password});assert.equal(r.status,200);return{cookie:r.cookie,csrf:r.value.csrf}}
 const fresh=await login('chooser-new@example.test'),expired=await login('demo-expired@villacheck.example'),main=await login('demo-merchant@villacheck.example'),admin=await login('chooser-admin@example.test')
 await t.test('new merchants can add a free villa without choosing an account package',async()=>{
  assert.equal((await req('/subscription',{packageId:'starter'},fresh)).status,409)
  const doc={name:'dummy.pdf',type:'application/pdf',data:'data:application/pdf;base64,'+dummyPdf().toString('base64')}
  const created=await req('/villas',{name:'บ้านใหม่',nameEn:'Dummy Draft Villa',province:'ชลบุรี',merchant:'DUMMY ONLY',email:'chooser-new@example.test',document:doc},fresh)
  assert.equal(created.status,201);assert.equal(created.value.villas[0].packageId,'basic');assert.equal(created.value.villas[0].trialUnlimited,true)
 })
 let villa,oldQr,invoice
 await t.test('Expired Merchant can select a paid plan and rights change only after manual slip approval',async()=>{
  const before=(await req('/state',undefined,expired)).value;villa=before.villas[0];oldQr=villa.qr
  const r=await req(`/villas/${villa.id}/renew`,{packageId:'pro'},expired);assert.equal(r.status,200);assert.equal(r.value.subscription.packageId,'starter')
  invoice=r.value.villas[0].invoices.find(i=>i.status!=='paid');assert.equal(invoice.packageName,'Social Verify');assert.equal(invoice.amount,2990)
  assert.equal((await req(`/villas/${villa.id}/renew`,{packageId:'premium'},expired)).status,409)
  const slip=(await req(`/payments/${invoice.id}/demo-slip`,{},expired)).value;assert.equal((await req(`/invoices/${invoice.id}/proof`,slip,expired)).status,200)
  const paid=await req(`/invoices/${invoice.id}/confirm`,{},admin);assert.equal(paid.status,200)
  const state=(await req('/state',undefined,expired)).value;assert.equal(state.villas[0].packageId,'pro');assert.equal(state.villas[0].qr,oldQr);assert.equal(state.villas[0].qrStatus,'ACTIVE')
 })
 await t.test('Active property can request another level without immediately changing existing rights',async()=>{
  assert.equal((await req(`/villas/${villa.id}/renew`,{packageId:'premium'},expired)).status,200);assert.equal((await req('/state',undefined,expired)).value.villas[0].packageId,'pro')
 })
 await t.test('Per-villa renewal ignores account capacity and rejects inactive plans',async()=>{
  await db.prepare("UPDATE subscriptions SET expires='2000-01-01T00:00:00.000Z' WHERE owner_id=(SELECT id FROM users WHERE email='demo-merchant@villacheck.example')").run()
  const state=(await req('/state',undefined,main)).value,v=state.villas.find(v=>v.status==='approved'&&v.qr);assert.ok(state.villas.length>2)
  assert.equal((await req(`/villas/${v.id}/renew`,{packageId:'starter'},main)).status,200)
  await db.prepare("UPDATE package_catalog SET active=0 WHERE id='premium'").run()
  assert.equal((await req(`/villas/${v.id}/renew`,{packageId:'premium'},main)).status,400)
  assert.equal((await req('/state',undefined,main)).value.subscription.packageId,'premium')
 })
})
