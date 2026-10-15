import test from 'node:test'
import assert from 'node:assert/strict'
import {openTestDatabase} from './test-database.mjs'
import {seedDemo} from './demo-seed.mjs'
import {createApp} from './app.mjs'
import {hashPassword} from './database.mjs'

test('User Merchant and Admin share the same demo Villa QR checks reports and review results',async t=>{
 const db=await openTestDatabase();await seedDemo(db,{password:'DummyRelations1234',adminEmail:'relations-admin@example.test',adminPassword:'DummyRelations1234'})
 const origin='http://localhost:8443',app=createApp(db,{appUrl:origin,allowedOrigins:[origin],fakeHash:hashPassword('dummy-relations'),serverless:true},null)
 await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.close(r));await db.close()})
 const base=`http://127.0.0.1:${app.address().port}/api`
 const req=async(path,data,session)=>{const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})},body:data===undefined?undefined:JSON.stringify(data)});return{status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const login=async email=>{const r=await req('/auth/login',{email,password:'DummyRelations1234'});assert.equal(r.status,200);return{cookie:r.cookie,csrf:r.value.csrf}}
 const admin=await login('relations-admin@example.test'),merchant=await login('demo-merchant@villacheck.example'),regional=await login('demo-regional@villacheck.example'),user=await login('demo-user@villacheck.example')
 const m=(await req('/state',undefined,merchant)).value,a=(await req('/state',undefined,admin)).value,villa=m.villas.find(v=>v.name==='Sea Sky Demo Villa')
 await t.test('all roles refer to one Villa identity and QR while ownership remains scoped',async()=>{
  const adminVilla=a.villas.find(v=>v.id===villa.id);assert.equal(adminVilla.qr,villa.qr);assert.equal(adminVilla.document.data,villa.document.data);assert.equal(adminVilla.guestCapacity,villa.guestCapacity)
  const shown=(await req('/public/qr/'+villa.qr,undefined,user)).value;assert.equal(shown.name,villa.name);assert.equal(shown.phone,villa.phone);assert.equal(shown.accountNumber,villa.accountNumber)
  assert.ok(!(await req('/state',undefined,regional)).value.villas.some(v=>v.id===villa.id))
  const docs=await fetch(base.replace('/api','')+villa.document.data,{headers:{Cookie:admin.cookie}});const text=await docs.text();assert.ok(text.includes(villa.id));assert.ok(text.includes(villa.email))
 })
 await t.test('User check outcomes agree with submitted values and Admin sees those exact checks',async()=>{
  const checks=(await req('/user/checks',undefined,user)).value.checks,adminChecks=(await req('/admin/checks',undefined,admin)).value.checks
  for(const check of checks){assert.equal(check.villa_id,villa.id);assert.equal(check.qr,villa.qr);assert.equal(check.status==='MATCHED',check.submitted_account===villa.accountNumber);assert.deepEqual(adminChecks.find(c=>c.id===check.id).reference,check.reference)}
 })
 await t.test('Admin report response propagates to User and owning Merchant without exposing private notes',async()=>{
  const report=(await req('/reports',undefined,user)).value.reports.find(r=>r.status==='NEW');assert.equal(report.villa_id,villa.id)
  assert.equal((await req('/admin/reports/'+report.id,{status:'RESOLVED',publicNote:'DUMMY: reconciled registered bank details',adminNote:'PRIVATE DEMO ADMIN NOTE'},admin)).status,200)
  for(const [path,session]of [['/reports',user],['/merchant/reports',merchant]]){const r=(await req(path,undefined,session)).value.reports.find(r=>r.id===report.id);assert.equal(r.status,'RESOLVED');assert.equal(r.reference,report.reference);assert.equal(r.public_note,'DUMMY: reconciled registered bank details');assert.equal(r.admin_note,undefined)}
  assert.ok(!(await req('/merchant/reports',undefined,regional)).value.reports.some(r=>r.id===report.id))
 })
 await t.test('Admin approval updates the same Merchant Villa and becomes available to User using one QR',async()=>{
  const pending=m.villas.find(v=>v.status==='pending');assert.ok(pending);assert.ok(a.villas.some(v=>v.id===pending.id&&v.status==='pending'))
  assert.equal((await req('/villas/'+pending.id+'/review',{status:'approved',verificationLevel:'VERIFIED'},admin)).status,200)
  const after=(await req('/state',undefined,merchant)).value.villas.find(v=>v.id===pending.id),adminAfter=(await req('/state',undefined,admin)).value.villas.find(v=>v.id===pending.id);assert.equal(after.status,'approved');assert.equal(after.qr,adminAfter.qr);assert.ok(after.qr)
  assert.equal((await req('/public/qr/'+after.qr,undefined,user)).value.name,pending.name)
  await seedDemo(db,{password:'DummyRelations1234'});const preserved=(await req('/state',undefined,merchant)).value.villas.find(v=>v.id===pending.id);assert.equal(preserved.status,'approved');assert.equal(preserved.qr,after.qr)
  assert.equal((await req('/reports',undefined,user)).value.reports.find(r=>r.status==='RESOLVED'&&r.public_note==='DUMMY: reconciled registered bank details')?.public_note,'DUMMY: reconciled registered bank details')
 })
})
