import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {openTestDatabase} from './test-database.mjs'
import {seedDemo} from './demo-seed.mjs'
import {createUser,hashPassword} from './database.mjs'
import {createApp} from './app.mjs'
import {preserveApprovedVilla} from './approval-history.mjs'

test('Admin toggles DB demo listing without deletion, payment-mode changes or eligibility bypass',async t=>{
 const db=await openTestDatabase();t.after(()=>db.close())
 const password='DemoVisibilityLocal1234'
 await seedDemo(db,{password})
 await db.prepare("UPDATE system_settings SET value='false' WHERE key='demo_mode'").run()
 const admin=await createUser(db,'visibility-admin@example.test',password,'QA Admin','admin')
 const owner=await db.prepare("SELECT * FROM users WHERE email='demo-merchant@villacheck.example'").get()
 const doc=await db.prepare("SELECT document_id FROM villas WHERE owner_id=? LIMIT 1").get(owner.id)
 const normalIds=Array.from({length:16},()=>randomUUID()),normalId=normalIds[0]
 for(const normalId of normalIds)await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,created) VALUES (?,?,'Demo name is not proof','ชลบุรี','Actual Business','actual@example.test','basic',?,'approved',?,'2000-01-01')").run(normalId,owner.id,doc.document_id,'VC-real-'+normalId)
 const tryIds=[]
 for(const [packageId,label] of [['pro','Social Verify'],['starter','Online Verify'],['basic','Basic Verify'],['premium','Premium Verify']]){
  const id=randomUUID();tryIds.push(id)
  await db.prepare("INSERT INTO villas(id,owner_id,name,name_en,province,merchant,email,package_id,document_id,status,qr,created) VALUES (?,?,?,?,?,?,?,?,?,'approved',?,'2026-10-24')").run(id,owner.id,'บ้านเดโม '+label+' — ข้อมูลสาธิต','DEMO '+label+' Villa','ชลบุรี','ธุรกิจสาธิต — ไม่ใช่ที่พักจริง','try-'+packageId+'@villacheck.example',packageId,doc.document_id,'VC-DEMO-'+id)
 }
 const pending=await db.prepare("SELECT * FROM villas WHERE email LIKE 'demo-free-%' LIMIT 1").get()
 await preserveApprovedVilla(db,pending)
 await db.prepare("UPDATE villas SET status='pending',name='PRIVATE DRAFT' WHERE id=?").run(pending.id)
 await db.prepare("UPDATE villas SET package_id='premium',payments=1,expires='2999-01-01' WHERE id=?").run(normalId)
 await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run('advertisement:real',JSON.stringify({id:'real',villaId:normalId,placement:'home',approved:true,visible:true,startsAt:'2000-01-01',endsAt:'2999-01-01',order:0,title:'Demo in a real ad title is not classification',image:'/real.jpg'}))
 const before=await db.prepare('SELECT * FROM villas ORDER BY id').all()
 const invoices=await db.prepare('SELECT * FROM invoices ORDER BY id').all()
 const app=createApp(db,{serverless:true,paymentAccessMode:'DISABLED',allowedOrigins:['http://localhost'],appUrl:'http://localhost',fakeHash:hashPassword('placeholder')})
 await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)))
 const root=`http://127.0.0.1:${app.address().port}/api`
 const request=async(path,data,session,csrf=true)=>{
 const r=await fetch(root+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(session?{Cookie:session.cookie,...(csrf?{'X-CSRF-Token':session.csrf}:{})}:{})},body:data?JSON.stringify(data):undefined})
 return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}
 }
 const login=async(email,isAdmin)=>{const r=await request(isAdmin?'/auth/admin-login':'/auth/login',{email,password});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.body.csrf}}
 const a=await login(admin.email,true),m=await login(owner.email,false)
 const path='/admin/settings/demo-villas'
 assert.equal((await request(path)).status,401)
 assert.equal((await request(path,{visible:false},m)).status,403)
 assert.equal((await request(path,{visible:false},a,false)).status,403)
 assert.equal((await request(path,{visible:'false'},a)).status,400)
 assert.equal((await request(path,undefined,a)).body.visible,true)
 const list=async query=>(await request('/public/villas'+(query||''))).body.villas
 const initial=await list()
 assert.equal(initial.length,55);assert.equal(initial.filter(v=>v.isDemo).length,39);assert(tryIds.every(id=>initial.some(v=>v.id===id&&v.isDemo)));assert(initial.some(v=>v.id===pending.id));assert(initial.every(v=>v.qrStatus==='ACTIVE'))
 assert(!JSON.stringify(initial).includes('PRIVATE DRAFT'))
 assert(!JSON.stringify(initial).includes('demo-merchant@'))
 const adsBefore=(await request('/public/advertisements?placement=home')).body.advertisements
 assert(adsBefore.length>1)
 assert.equal((await request(path,{visible:false},a)).status,200)
 assert.deepEqual((await request('/public/advertisements?placement=home')).body.advertisements.map(ad=>ad.id),['real'])
 const hidden=await list();assert.equal(hidden.length,16);assert(tryIds.every(id=>!hidden.some(v=>v.id===id)));assert.equal(hidden.filter(v=>v.isDemo).length,0);assert.deepEqual(hidden.map(v=>v.id).sort(),[...normalIds].sort());assert.equal(hidden[0].isDemo,false)
 assert.deepEqual((await list('?limit=1&province='+encodeURIComponent('ชลบุรี'))).map(v=>v.id),[hidden[0].id])
 assert.equal((await request('/public/qr/'+pending.qr)).body.valid,true)
 assert.equal((await request(path,{visible:false},a)).status,200)
 assert.equal((await db.prepare("SELECT count(*) AS n FROM audits WHERE action='demo-villas.visibility'").get()).n,1)
 // Fresh server/request reads persisted DB setting, not a browser-only switch.
 const {demoVillasVisible}=await import('./demo-villa-visibility.mjs')
 assert.equal(await demoVillasVisible(db),false)
 assert.equal((await request(path,{visible:true},a)).status,200)
 assert.deepEqual(await list(),initial)
 assert.deepEqual((await request('/public/advertisements?placement=home')).body.advertisements,adsBefore)
 assert.equal((await db.prepare("SELECT value FROM system_settings WHERE key='demo_mode'").get()).value,'false')
 assert.equal((await request('/config')).body.paymentAccessMode,'DISABLED')
 assert.deepEqual(await db.prepare('SELECT * FROM villas ORDER BY id').all(),before)
 assert.deepEqual(await db.prepare('SELECT * FROM invoices ORDER BY id').all(),invoices)
})
