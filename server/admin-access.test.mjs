import test from 'node:test'
import assert from 'node:assert/strict'
import {openTestDatabase} from './test-database.mjs'
import {seedDemo} from './demo-seed.mjs'
import {createApp} from './app.mjs'

test('Admin login is isolated from public users; Admin can manage User and Merchant access',async t=>{
 const db=await openTestDatabase(),password='AdminPortalDummy123';await seedDemo(db,{password,adminEmail:'portal-admin@example.test',adminPassword:password})
 const server=createApp(db,{appUrl:'http://localhost:8443',allowedOrigins:['http://localhost:8443'],serverless:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/api'
 const req=async(path,data,session,extra={})=>{const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{Origin:'http://localhost:8443',...(data?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{}),...extra},body:data?JSON.stringify(data):undefined});return{status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const login=async(email,admin=false)=>{const r=await req(admin?'/auth/admin-login':'/auth/login',{email,password});assert.equal(r.status,200);return{cookie:r.cookie,csrf:r.value.csrf,user:r.value.user}}
 try{
 let admin,user,merchant
 await t.test('only dedicated password login issues Admin cookie; public login rejects Admin',async()=>{
  const denied=await req('/auth/login',{email:'portal-admin@example.test',password});assert.equal(denied.status,403);assert.equal(denied.cookie,undefined)
  assert.equal((await req('/auth/admin-login',{email:'demo-user@villacheck.example',password})).status,403)
  admin=await login('portal-admin@example.test',true);assert.match(admin.cookie,/^vc_admin_session=/)
  user=await login('demo-user@villacheck.example');merchant=await login('demo-merchant@villacheck.example');assert.match(user.cookie,/^vc_session=/)
  assert.equal((await req('/auth/me',undefined,admin)).status,401)
  assert.equal((await req('/auth/admin-me',undefined,admin)).value.user.role,'admin')
  assert.equal((await req('/auth/admin-me',undefined,user)).status,403)
  assert.equal((await req('/auth/me',undefined,{cookie:admin.cookie.replace('vc_admin_session=','vc_session=')})).status,401)
 })
 await t.test('same browser keeps both identities and public QR ignores Admin-only session',async()=>{
  const both={cookie:admin.cookie+'; '+user.cookie,csrf:admin.csrf}
  assert.equal((await req('/auth/me',undefined,both)).value.user.id,user.user.id)
  assert.equal((await req('/auth/admin-me',undefined,both)).value.user.id,admin.user.id)
  assert.equal((await req('/state',undefined,both,{'X-VillaCheck-Portal':'admin'})).value.user.role,'admin')
  const villa=await db.prepare("SELECT qr FROM villas WHERE status='approved' AND qr IS NOT NULL LIMIT 1").get()
  const publicRow=(await req('/public/qr/'+villa.qr,undefined,admin)).value;assert.equal(publicRow.locked,true);assert.equal(publicRow.viewerRole,'guest')
  assert.equal((await req('/public/qr/'+villa.qr,undefined,both)).value.viewerRole,'user')
  const result=await req('/auth/admin-logout',{},both);assert.equal(result.status,200);assert.match(result.cookie,/^vc_admin_session=/)
  assert.equal((await req('/auth/me',undefined,user)).status,200)
  assert.equal((await req('/auth/admin-me',undefined,admin)).status,401)
  admin=await login('portal-admin@example.test',true)
 })
 await t.test('Admin edits contacts, suspends sessions and restores both account types; roles are immutable',async()=>{
  for(const [role,session] of [['user',user],['merchant',merchant]]){
   const listed=await req('/admin/accounts?role='+role,undefined,admin);assert.equal(listed.status,200);assert.ok(listed.value.accounts.some(r=>r.id===session.user.id));assert.equal(listed.value.accounts[0].password_hash,undefined)
   const path='/admin/accounts/'+session.user.id
   assert.equal((await req(path,{action:'profile',name:'Unauthorized'},session)).status,403)
   assert.equal((await req(path,{action:'profile',name:'Missing CSRF'}, {cookie:admin.cookie,csrf:'bad'})).status,403)
   const changed=await req(path,{action:'profile',name:'Edited '+role,phone:'0812345678',address:'Dummy address',businessName:'บ้านทดสอบ',businessNameEn:'Dummy Company'},admin);assert.equal(changed.status,200)
   assert.equal((await db.prepare('SELECT name FROM users WHERE id=?').get(session.user.id)).name,'Edited '+role)
   assert.equal((await req(path,{action:'access',status:'suspended',reason:''},admin)).status,400)
   assert.equal((await req(path,{action:'access',status:'suspended',reason:'Dummy access suspension'},admin)).status,200)
   assert.equal((await req('/auth/me',undefined,session)).status,401)
   assert.equal((await req('/auth/login',{email:session.user.email,password})).status,403)
   assert.equal((await req(path,{action:'access',status:'active',reason:'Dummy reactivation'},admin)).status,200)
   assert.equal((await login(session.user.email)).user.role,role)
  }
  assert.equal((await req('/admin/accounts/'+admin.user.id,{action:'access',status:'suspended',reason:'Cannot target Admin'},admin)).status,404)
  assert.equal((await req('/auth/admin-me',undefined,admin)).status,200)
 })
 }finally{await new Promise(r=>server.close(r));await db.close()}
})
