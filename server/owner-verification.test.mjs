import {getPlan} from './catalog.mjs'
import {onlineVerificationFeatures} from './package-content.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {openTestDatabase} from './test-database.mjs'
import {createUser} from './database.mjs'
import {seedDemo,dummyPdf} from './demo-seed.mjs'
import {createApp} from './app.mjs'

test('private owner evidence requires two files, consent, current package, and manual Admin checks',async t=>{
 const db=await openTestDatabase(),password='OwnerProofDummy123'
 await seedDemo(db,{password,adminEmail:'proof-admin@example.test',adminPassword:password})
 await createUser(db,'proof-other@example.test',password,'Other','merchant')
 const server=createApp(db,{appUrl:'http://localhost:8443',allowedOrigins:['http://localhost:8443'],serverless:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/api'
 const request=async(path,data,session)=>{const response=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{Origin:'http://localhost:8443',...(data?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})},body:data?JSON.stringify(data):undefined});const value=(response.headers.get('content-type')||'').includes('application/json')?await response.json():null;return {status:response.status,value,response}}
 const login=async email=>{const r=await request('/auth/login',{email,password});assert.equal(r.status,200);return {cookie:r.response.headers.get('set-cookie').split(';')[0],csrf:r.value.csrf}}
 try{
 const admin=await login('proof-admin@example.test'),merchant=await login('demo-merchant@villacheck.example'),other=await login('proof-other@example.test'),user=await login('demo-user@villacheck.example')
 const owner=await db.prepare("SELECT id FROM users WHERE email='demo-merchant@villacheck.example'").get();const villa=await db.prepare('SELECT * FROM villas WHERE owner_id=? LIMIT 1').get(owner.id)
 await db.prepare("UPDATE villas SET package_id='basic',status='approved',payments=0 WHERE id=?").run(villa.id)
 let revision=0,faceId
 const act=(data,session=merchant)=>request('/'+(session===admin?'admin':'merchant')+'/owner-verification',{villaId:villa.id,expectedRevision:revision,...data},session)
 const face={name:'DUMMY-face.png',type:'image/png',data:'data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64')}
 const house={name:'DUMMY-house.pdf',type:'application/pdf',data:'data:application/pdf;base64,'+dummyPdf().toString('base64')}
 await t.test('eligible active per-property plan, owner-only mutations and private files',async()=>{
  for(const id of ['starter','pro','premium'])for(const feature of onlineVerificationFeatures)assert.ok((await getPlan(db,id)).features.includes(feature))
  assert.ok(!(await getPlan(db,'basic')).features.includes(onlineVerificationFeatures[1]))
  assert.equal((await act({action:'upload',slot:'face',file:face})).status,403)
  await db.prepare("UPDATE villas SET package_id='starter',payments=1,expires=? WHERE id=?").run(new Date(Date.now()+86400000).toISOString(),villa.id)
  assert.equal((await request('/merchant/owner-verification',undefined,user)).status,403)
  assert.equal((await act({action:'upload',slot:'face',file:face},other)).status,404)
  assert.equal((await act({action:'upload',slot:'face',file:{...face,data:'data:image/png;base64,YmFk'}})).status,400)
  const r=await act({action:'upload',slot:'face',file:face});assert.equal(r.status,200);revision=r.value.submission.revision;faceId=r.value.submission.files.face.id
  assert.equal((await request('/documents/'+faceId)).status,401)
  assert.equal((await request('/documents/'+faceId,undefined,other)).status,404)
  assert.equal((await request('/documents/'+faceId,undefined,merchant)).status,200)
  const preview=await request('/documents/'+faceId+'?preview=1',undefined,admin);assert.equal(preview.status,200);assert.equal(preview.response.headers.get('cache-control'),'private, no-store')
  assert.equal((await request('/public/qr/'+villa.qr)).value.ownerVerification,null)
 })
 await t.test('two files, consent, revision checks, and submitted evidence is immutable',async()=>{
  assert.equal((await act({action:'submit',ownerName:'Dummy Owner',consent:true})).status,400)
  let r=await act({action:'upload',slot:'house',file:house});assert.equal(r.status,200);revision=r.value.submission.revision
  assert.equal((await act({action:'submit',ownerName:'Dummy Owner',consent:false})).status,400)
  assert.equal((await act({action:'submit',expectedRevision:0,ownerName:'Dummy Owner',consent:true})).status,409)
  r=await act({action:'submit',ownerName:'Dummy Owner',consent:true});assert.equal(r.status,200);revision=r.value.submission.revision;assert.equal(r.value.submission.status,'pending')
  assert.equal((await act({action:'upload',slot:'face',file:face})).status,409)
  assert.equal((await request('/public/qr/'+villa.qr)).value.ownerVerification,null)
 })
 await t.test('Admin confirms face, register and owner separately; only approved summary is public',async()=>{
  assert.equal((await act({action:'review',status:'accepted'},admin)).status,400)
  let r=await act({action:'review',status:'accepted',faceMatched:true,houseMatched:true,ownerConfirmed:true},admin);assert.equal(r.status,200);revision=r.value.submission.revision
  const publicRow=(await request('/public/qr/'+villa.qr)).value.ownerVerification;assert.equal(publicRow.status,'accepted');assert.ok(publicRow.reviewedAt);assert.equal(publicRow.files,undefined);assert.equal(publicRow.ownerName,undefined)
  const subscription=await db.prepare('SELECT lifecycle FROM subscriptions WHERE owner_id=?').get(owner.id);assert.ok(subscription)
  await db.prepare("UPDATE subscriptions SET lifecycle='SUSPENDED' WHERE owner_id=?").run(owner.id);assert.equal((await request('/public/qr/'+villa.qr)).value.ownerVerification,null)
  assert.equal((await request('/merchant/owner-verification',undefined,merchant)).value.villas.find(v=>v.id===villa.id).eligible,false)
  await db.prepare('UPDATE subscriptions SET lifecycle=? WHERE owner_id=?').run(subscription.lifecycle,owner.id)
  await db.prepare("UPDATE villas SET expires=? WHERE id=?").run('2000-01-01',villa.id);assert.equal((await request('/public/qr/'+villa.qr)).value.ownerVerification,null)
  await db.prepare("UPDATE villas SET expires=? WHERE id=?").run(new Date(Date.now()+86400000).toISOString(),villa.id)
  assert.equal((await act({action:'review',status:'changes',reason:''},admin)).status,400)
  r=await act({action:'review',status:'changes',reason:'กรุณาส่งภาพใหม่'},admin);assert.equal(r.status,200);revision=r.value.submission.revision
  assert.equal((await request('/public/qr/'+villa.qr)).value.ownerVerification,null)
  r=await act({action:'upload',slot:'face',file:face});assert.equal(r.status,200);revision=r.value.submission.revision;assert.equal((await request('/documents/'+faceId,undefined,merchant)).status,404)
  r=await act({action:'submit',ownerName:'Dummy Owner',consent:true});assert.equal(r.status,200);revision=r.value.submission.revision
  r=await act({action:'review',status:'rejected',reason:'หลักฐานยังไม่ตรงกัน'},admin);assert.equal(r.status,200)
  assert.equal((await request('/public/qr/'+villa.qr)).value.ownerVerification,null)
 })
 }finally{await new Promise(r=>server.close(r));await db.close()}
})
