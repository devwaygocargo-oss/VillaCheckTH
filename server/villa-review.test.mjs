import test from 'node:test'
import assert from 'node:assert/strict'
import {openTestDatabase} from './test-database.mjs'
import {seedDemo} from './demo-seed.mjs'
import {createApp} from './app.mjs'
import {hashPassword} from './database.mjs'

test('Villa approval requests retain actual changes, documents, permissions and stale review protection',async t=>{
 const db=await openTestDatabase();await seedDemo(db,{password:'DummyPassword1234',adminEmail:'review-admin@example.test',adminPassword:'DummyPassword1234'})
 const origin='http://localhost:8443',app=createApp(db,{appUrl:origin,allowedOrigins:[origin],fakeHash:hashPassword('dummy-placeholder'),serverless:true},null)
 await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.close(r));await db.close()})
 const base=`http://127.0.0.1:${app.address().port}/api`
 const request=async(path,data,session)=>{const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const login=async email=>{const r=await request(((await db.prepare("SELECT role FROM users WHERE email=?").get(email))?.role === "admin" ? "/auth/admin-login" : "/auth/login"),{email,password:'DummyPassword1234'});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf}}
 const admin=await login('review-admin@example.test'),merchant=await login('demo-merchant@villacheck.example')
 const villa=await db.prepare("SELECT * FROM villas WHERE name='Sea Sky Demo Villa'").get()
 const edit={name:villa.name,nameEn:villa.name,province:villa.province,merchant:villa.merchant,phone:villa.phone,bankName:villa.bank_name,accountName:villa.account_name,accountNumber:villa.account_number,photoUrl:villa.photo_url,guestCapacity:20}
 const state=async()=>(await request('/state',undefined,admin)).value.villas.find(v=>v.id===villa.id)
 let submission
 await t.test('capacity update records before and after, and Admin sees full contact/bank data',async()=>{
  assert.equal((await request('/merchant/villas/'+villa.id,edit,merchant)).status,200)
  const v=await state();submission=v.reviewRequest.id;assert.equal(v.status,'pending');assert.equal(v.qr,villa.qr);assert.match(v.reviewRequest.summary,/จำนวนผู้เข้าพัก/)
  assert.deepEqual(v.reviewRequest.changes.find(c=>c.field==='guest_capacity'),{field:'guest_capacity',label:'จำนวนผู้เข้าพักสูงสุด',before:String(villa.guest_capacity),after:'20'})
  assert.equal(v.phone,villa.phone);assert.equal(v.accountNumber,villa.account_number)
 })
 await t.test('successive pending edits compare against original submission baseline',async()=>{
  await request('/merchant/villas/'+villa.id,{...edit,guestCapacity:22},merchant)
  const v=await state();assert.equal(v.reviewRequest.changes.find(c=>c.field==='guest_capacity').before,String(villa.guest_capacity));assert.equal(v.reviewRequest.changes.find(c=>c.field==='guest_capacity').after,'22')
 })
 await t.test('stale approval cannot approve changed data',async()=>{
  const r=await request('/villas/'+villa.id+'/review',{status:'approved',verificationLevel:'VERIFIED',expectedReviewId:submission},admin);assert.equal(r.status,409);assert.equal((await state()).status,'pending')
 })
 await t.test('current approval rotates QR and rejects duplicate review',async()=>{
  const v=await state(),input={status:'approved',verificationLevel:'VERIFIED',expectedReviewId:v.reviewRequest.id};assert.equal((await request('/villas/'+villa.id+'/review',input,merchant)).status,403);assert.equal((await request('/villas/'+villa.id+'/review',input,admin)).status,200);assert.equal((await request('/villas/'+villa.id+'/review',input,admin)).status,409);assert.notEqual((await state()).qr,villa.qr);assert.equal((await request("/public/qr/"+villa.qr)).status,200);villa.qr=(await state()).qr
 })
 await t.test('Admin session stays separate from the public QR profile',async()=>{
  const detail=(await request('/admin/qr-verification/'+villa.qr,undefined,admin)).value;assert.equal(detail.locked,false);assert.equal(detail.villaId,villa.id);assert.equal(detail.phone,villa.phone);assert.equal(detail.accountNumber,villa.account_number);assert(detail.propertyDetails.description)
  assert.equal((await request('/admin/qr-verification/'+villa.qr)).status,401)
  assert.equal((await request('/admin/qr-verification/'+villa.qr,undefined,merchant)).status,403)
  for(const [id,villaId] of [['scope-this-villa',villa.id],['scope-other-villa','different-villa']])await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('customer_review:'+id,JSON.stringify({id,villaId,status:'pending',createdAt:new Date().toISOString(),content:'Private review',rating:4,author:'Fixture'}))
  const reviews=(await request('/admin/reviews?qr='+encodeURIComponent(villa.qr),undefined,admin)).value.reviews;assert(reviews.some(r=>r.id==='scope-this-villa'));assert(reviews.every(r=>r.villaId===villa.id));assert.equal((await request('/admin/reviews?qr=missing',undefined,admin)).value.reviews.length,0)
  assert.equal((await request('/admin/reviews?qr='+encodeURIComponent(villa.qr),undefined,merchant)).status,403)
  const full=(await request('/public/qr/'+villa.qr,undefined,admin)).value;assert.equal(full.locked,true);assert.equal(full.accountNumber,undefined);assert.equal(full.phone,undefined)
  const guest=(await request('/public/qr/'+villa.qr)).value;assert.equal(guest.locked,true);assert.equal(guest.accountNumber,undefined)
 })
 await t.test('dedicated Admin verification requires Admin and returns full pending Villa details',async()=>{
  assert.equal((await fetch(base+'/admin/documents/'+villa.document_id+'?preview=1',{headers:{Cookie:admin.cookie+'; '+merchant.cookie}})).status,200)
  assert.equal((await fetch(base+'/admin/documents/'+villa.document_id+'?preview=1',{headers:{Cookie:merchant.cookie}})).status,403)
  assert.equal((await fetch(base+'/admin/documents/'+villa.document_id+'?preview=1')).status,401)
  const path='/admin/qr-verification/'+encodeURIComponent(villa.qr)
  assert.equal((await request(path)).status,401);assert.equal((await request(path,undefined,merchant)).status,403)
  const full=(await request(path,undefined,admin)).value;assert.equal(full.viewerRole,'admin');assert.equal(full.locked,false);assert.equal(full.phone,villa.phone);assert.equal(full.accountNumber,villa.account_number)
 })
 await t.test('explicit document resubmission records real document filename changes',async()=>{
  await request('/merchant/villas/'+villa.id,edit,merchant);await request('/villas/'+villa.id+'/review',{status:'changes',reason:'Dummy test: ownership proof needs replacement'},admin)
  assert.equal((await request('/villas/'+villa.id+'/resubmit',{document:{name:'DUMMY-replacement.pdf',type:'application/pdf',data:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4 Dummy test ownership').toString('base64')}},merchant)).status,200)
  const v=await state();assert.equal(v.reviewRequest.kind,'document_resubmission');assert.equal(v.reviewRequest.changes.find(c=>c.field==='document').after,'DUMMY-replacement.pdf')
 })
 await t.test('attached document preview and dummy example require correct permissions',async()=>{
  const v=await state();const doc=await fetch(base.replace('/api','')+v.document.data+'?preview=1',{headers:{Cookie:admin.cookie}});assert.equal(doc.status,200);assert.match(doc.headers.get('content-disposition'),/^inline/)
  assert.equal((await fetch(base+'/admin/review-sample-document')).status,401);assert.equal((await fetch(base+'/admin/review-sample-document',{headers:{Cookie:merchant.cookie}})).status,403)
  const sample=await fetch(base+'/admin/review-sample-document',{headers:{Cookie:admin.cookie}});assert.equal(sample.status,200);assert.equal(sample.headers.get('content-type'),'application/pdf');assert.match(await sample.text(),/dummy document - NOT legal evidence/i)
 })
 await t.test('legacy modified records disclose missing history without invented changes',async()=>{
  await db.prepare('DELETE FROM system_settings WHERE key=?').run('villa_review:'+villa.id);await db.prepare("UPDATE villas SET reason='Information changed; pending Admin review' WHERE id=?").run(villa.id)
  const v=await state();assert.equal(v.reviewRequest.kind,'legacy_update');assert.deepEqual(v.reviewRequest.changes,[]);assert.equal(v.reviewRequest.submittedAt,null)
 })
})
