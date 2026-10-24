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
 const normalId=randomUUID()
 await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,created) VALUES (?,?,'Demo name is not proof','ชลบุรี','Actual Business','actual@example.test','basic',?,'approved','VC-real-visibility','2000-01-01')").run(normalId,owner.id,doc.document_id)
 const pending=await db.prepare("SELECT * FROM villas WHERE email LIKE 'demo-free-%' LIMIT 1").get()
 await preserveApprovedVilla(db,pending)
 await db.prepare("UPDATE villas SET status='pending',name='PRIVATE DRAFT' WHERE id=?").run(pending.id)
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
 assert(initial.some(v=>v.isDemo));assert(initial.some(v=>v.id===pending.id));assert(initial.every(v=>v.qrStatus==='ACTIVE'))
 assert(!JSON.stringify(initial).includes('PRIVATE DRAFT'))
 assert(!JSON.stringify(initial).includes('demo-merchant@'))
 assert.equal((await request(path,{visible:false},a)).status,200)
 const hidden=await list();assert.deepEqual(hidden.map(v=>v.id),[normalId]);assert.equal(hidden[0].isDemo,false)
 assert.deepEqual((await list('?limit=1&province='+encodeURIComponent('ชลบุรี'))).map(v=>v.id),[normalId])
 assert.equal((await request('/public/qr/'+pending.qr)).body.valid,true)
 assert.equal((await request(path,{visible:false},a)).status,200)
 assert.equal((await db.prepare("SELECT count(*) AS n FROM audits WHERE action='demo-villas.visibility'").get()).n,1)
 // Fresh server/request reads persisted DB setting, not a browser-only switch.
 const {demoVillasVisible}=await import('./demo-villa-visibility.mjs')
 assert.equal(await demoVillasVisible(db),false)
 assert.equal((await request(path,{visible:true},a)).status,200)
 assert.deepEqual(await list(),initial)
 assert.equal((await db.prepare("SELECT value FROM system_settings WHERE key='demo_mode'").get()).value,'false')
 assert.equal((await request('/config')).body.paymentAccessMode,'DISABLED')
 assert.deepEqual(await db.prepare('SELECT * FROM villas ORDER BY id').all(),before)
 assert.deepEqual(await db.prepare('SELECT * FROM invoices ORDER BY id').all(),invoices)
})
