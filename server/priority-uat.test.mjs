import test from 'node:test'
import assert from 'node:assert/strict'
import {PNG} from 'pngjs'
import zxing from '@zxing/library'
import {openTestDatabase} from './test-database.mjs'
import {createApp} from './app.mjs'
import {createUser,hashPassword} from './database.mjs'
import {dummyPdf} from './demo-seed.mjs'
const decode=bytes=>{const p=PNG.sync.read(bytes),pixels=new Uint8ClampedArray(p.width*p.height);for(let i=0;i<pixels.length;i++)pixels[i]=(p.data[i*4]+p.data[i*4+1]+p.data[i*4+2])/3;return new zxing.QRCodeReader().decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(pixels,p.width,p.height)))).getText()}
test('Priority UAT: independent approvals, coupon invoice, automatic bank QR, manual payment and acceptance evidence',async t=>{
 const db=await openTestDatabase(),password='PriorityUatDummy123',sent=[]
 const a=await createUser(db,'uat-editor@example.test',password,'UAT Editor','admin'),b=await createUser(db,'uat-approver@example.test',password,'UAT Approver','admin'),merchant=await createUser(db,'uat-merchant@example.test',password,'UAT Merchant','merchant');await createUser(db,'uat-user@example.test',password,'UAT User','user')
 const config={appUrl:'http://localhost:8443',allowedOrigins:['http://localhost:8443'],fakeHash:hashPassword('fake'),serverless:true,requireDualApproval:true,cronSecret:'dummy-cron-secret',demoMode:false,smtpFrom:'dummy@example.test'}
 const server=createApp(db,config,{sendMail:async m=>sent.push(m)});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await server.runMail();await new Promise(r=>server.close(r));await db.close()})
 const req=async(path,data,s,extra={})=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:data===undefined?'GET':'POST',headers:{Origin:config.appUrl,'Content-Type':'application/json',...(s?{Cookie:s.cookie,'X-CSRF-Token':s.csrf}:{}),...extra},body:data===undefined?undefined:JSON.stringify(data)});return{status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const login=async(email)=>{const r=await req('/auth/login',{email,password});assert.equal(r.status,200);return{cookie:r.cookie,csrf:r.value.csrf}}
 const editor=await login(a.email),approver=await login(b.email),m=await login(merchant.email),u=await login('uat-user@example.test')
 const fields={bankName:'DUMMY BANK - NO REAL MONEY',accountName:'DUMMY ACCOUNT',accountNumber:'0000000000',accountType:'current',promptpayType:'phone',promptpayId:'0812345678',instructions:'DUMMY ONLY',confirmedBinding:true,revision:0}
 await t.test('Bank changes need a different Admin, reject bypass and preserve unapproved current values',async()=>{
  assert.equal((await req('/admin/receiving-bank',fields,editor)).status,403)
  const proposed=await req('/admin/change-approvals',{kind:'bank',payload:fields},editor);assert.equal(proposed.status,200)
  assert.equal((await req('/admin/receiving-bank',undefined,editor)).value.bank,null)
  assert.equal((await req(`/admin/change-approvals/${proposed.value.request.id}/approve`,{},editor)).status,403)
  assert.equal((await req(`/admin/change-approvals/${proposed.value.request.id}/approve`,{},m)).status,403)
  assert.equal((await req(`/admin/change-approvals/${proposed.value.request.id}/approve`,{},approver)).status,200)
  assert.equal((await req(`/admin/change-approvals/${proposed.value.request.id}/approve`,{},approver)).status,409)
  assert.equal((await req('/admin/receiving-bank',undefined,editor)).value.bank.accountType,'current')
  assert.equal((await req('/admin/change-approvals',{kind:'bank',payload:fields},editor)).status,409)
 })
 await t.test('CMS drafts stay private until another Admin approves; modified drafts invalidate proposals',async()=>{
  let state=(await req('/admin/cms',undefined,editor)).value;state.draft.content.site.name='UAT Published Name'
  state=(await req('/admin/cms/save',{revision:state.draft.revision,content:state.draft.content},editor)).value
  assert.equal((await req('/admin/cms/publish',{revision:state.draft.revision},editor)).status,403)
  let p=await req('/admin/change-approvals',{kind:'cms',payload:{revision:state.draft.revision}},editor);assert.equal(p.status,200)
  assert.equal((await req(`/admin/change-approvals/${p.value.request.id}/approve`,{},editor)).status,403)
  assert.equal((await req(`/admin/change-approvals/${p.value.request.id}/approve`,{},approver)).status,200)
  p=await req('/admin/change-approvals',{kind:'cms',payload:{revision:state.draft.revision}},editor)
  await req('/admin/cms/save',{revision:state.draft.revision,content:state.draft.content},editor)
  assert.equal((await req(`/admin/change-approvals/${p.value.request.id}/approve`,{},approver)).status,409)
 })
 let villa,invoice
 const promotion={code:'UAT100',type:'fixed',value:10000,maxUses:1,packageIds:['starter'],startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),active:true,revision:0}
 await t.test('Coupon administration validates periods, roles, eligibility and immutable discounted invoice amount',async()=>{
  assert.equal((await req('/admin/promotions',promotion,m)).status,403)
  assert.equal((await req('/admin/promotions',{...promotion,endsAt:promotion.startsAt},editor)).status,400)
  assert.equal((await req('/admin/promotions',promotion,editor)).status,200)
  const expired={...promotion,code:'EXPIRED',startsAt:'2020-01-01T00:00:00Z',endsAt:'2020-01-02T00:00:00Z'}
  assert.equal((await req('/admin/promotions',expired,editor)).status,200)
  assert.equal((await req('/subscription',{packageId:'starter',couponCode:'EXPIRED'},m)).status,400)
  assert.equal((await req('/admin/promotions',{...promotion,code:'INVALID',type:'percent',value:100},editor)).status,400)
  assert.equal((await req('/subscription',{packageId:'pro',couponCode:'UAT100'},m)).status,400)
  assert.equal((await req('/subscription',{packageId:'starter',couponCode:'UAT100'},m)).status,200)
  const doc={name:'DUMMY.pdf',type:'application/pdf',data:'data:application/pdf;base64,'+dummyPdf().toString('base64')}
  const created=await req('/villas',{name:'UAT Dummy Villa',province:'ชลบุรี',merchant:merchant.name,email:merchant.email,document:doc,guestCapacity:4},m);assert.equal(created.status,201)
  villa=created.value.villas[0];assert.equal((await req(`/villas/${villa.id}/review`,{status:'approved',verificationLevel:'VERIFIED'},editor)).status,200)
  const s=(await req('/state',undefined,m)).value;invoice=s.villas[0].invoices[0];assert.equal(invoice.amount,890);assert.equal(s.subscription.active,false)
  assert.equal((await req('/admin/promotions',{...promotion,value:20000,revision:1},editor)).status,200)
  assert.equal((await req('/state',undefined,m)).value.villas[0].invoices[0].amount,890)
  assert.equal((await req('/subscription/coupon',{couponCode:'UAT100'},m)).status,409)
  await createUser(db,'uat-other@example.test',password,'Other UAT Merchant','merchant')
  const other=await login('uat-other@example.test')
  assert.equal((await req('/subscription',{packageId:'starter',couponCode:'UAT100'},other)).status,409)
 })
 await t.test('Automatic invoice email attaches decodable PromptPay PNG with invoice amount and same receiver',async()=>{
  await server.runMail();const mail=sent.find(x=>x.to===merchant.email);assert.ok(mail)
  const attachment=mail.attachments.find(x=>x.filename==='villacheck-payment-promptpay.png');assert.ok(attachment)
  const payload=decode(attachment.content);assert.ok(payload.includes('0066812345678'));assert.ok(payload.includes('5406890.00'));assert.ok(mail.text.includes('890'))
 })
 await t.test('Demo slip manual approval activates entitlement; renewal preserves Villa QR',async()=>{
  await req('/admin/settings',{paymentVerificationMode:'MANUAL',demoMode:true},editor)
  const proof=(await req(`/payments/${invoice.id}/demo-slip`,{},m)).value
  assert.equal((await req(`/invoices/${invoice.id}/proof`,proof,m)).status,200)
  assert.equal((await req(`/invoices/${invoice.id}/confirm`,{},u)).status,403)
  assert.equal((await req(`/invoices/${invoice.id}/confirm`,{},editor)).status,200)
  const s=(await req('/state',undefined,m)).value,qr=s.villas[0].qr;assert.equal(s.subscription.active,true);assert.ok(qr)
  const r=await req(`/villas/${villa.id}/renew`,{packageId:'starter'},m);assert.equal(r.status,200);assert.equal(r.value.villas[0].qr,qr);assert.ok(r.value.villas[0].invoices.some(x=>x.status==='pending'&&x.amount===990))
 })
 await t.test('Scheduled mail worker requires secret; UAT attestations require explicit evidence and Admin role',async()=>{
  assert.equal((await req('/ops/cron')).status,401);assert.equal((await req('/ops/cron',undefined,null,{Authorization:'Bearer dummy-cron-secret'})).status,200)
  assert.equal((await req('/admin/acceptance',{area:'uat',outcome:'pass',evidence:'Dummy evidence ONLY',confirmed:true},u)).status,403)
  assert.equal((await req('/admin/acceptance',{area:'uat',outcome:'pass',evidence:'short',confirmed:true},editor)).status,400)
  assert.equal((await req('/admin/email-test',{recipient:'dummy@example.test',confirmed:true},m)).status,403)
  assert.equal((await req('/admin/email-test',{recipient:'dummy@example.test',confirmed:true},editor)).status,200)
  assert.equal((await req('/admin/email-test',{recipient:'dummy@example.test',confirmed:true},editor)).status,429)
  const r=await req('/admin/acceptance',{area:'uat',outcome:'blocked',evidence:'DUMMY - real bank not supplied; no actual transfer made',confirmed:true},editor);assert.equal(r.status,200);assert.equal(r.value.records[0].reviewer,'UAT Editor')
 })
})
