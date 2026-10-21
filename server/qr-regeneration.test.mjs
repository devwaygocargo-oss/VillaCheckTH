import {readFileSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { openTestDatabase } from './test-database.mjs'
import { createApp } from './app.mjs'
import { createUser, hashPassword } from './database.mjs'
import { seedDemo } from './demo-seed.mjs'
import { getPlan } from './catalog.mjs'

test('QR regeneration invalidates old codes, preserves controls and rejects stale requests',async t=>{
 const db=await openTestDatabase();await seedDemo(db,{password:'DummyPassword1234'});await createUser(db,'operations-admin@test.com','AdminPassword123','Admin','admin');await createUser(db,'other-user@test.com','UserPassword123','Other','user');await createUser(db,'other-merchant@test.com','MerchantPassword123','Other Merchant','merchant')
 const config={appUrl:'http://localhost:8443',allowedOrigins:['http://localhost:8443'],fakeHash:hashPassword('placeholder-password'),serverless:true};let sends=0
 const app=createApp(db,config,{sendMail:async()=>{sends++}});await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(async()=>{await app.runMail();await new Promise(r=>app.close(r));await db.close()});const base=`http://127.0.0.1:${app.address().port}`
 const request=async(path,data,session)=>{const r=await fetch(base+'/api'+path,{method:data?'POST':'GET',headers:{Origin:config.appUrl,'Content-Type':'application/json',...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const login=async(email,password='DummyPassword1234')=>{const r=await request(((await db.prepare("SELECT role FROM users WHERE email=?").get(email))?.role === "admin" ? "/auth/admin-login" : "/auth/login"),{email,password});assert.equal(r.status,200);return{cookie:r.cookie,csrf:r.value.csrf}}
 const a=await login('operations-admin@test.com','AdminPassword123'),u=await login('demo-user@villacheck.example'),m=await login('demo-merchant@villacheck.example'),other=await login('other-user@test.com','UserPassword123'),outsider=await login('other-merchant@test.com','MerchantPassword123'),payer=await login('demo-payment@villacheck.example'),trial=await login('demo-trial@villacheck.example')
 const villa=await db.prepare("SELECT * FROM villas WHERE name='Sea Sky Demo Villa'").get()
 const endpoint='/admin/qr/'+villa.id,old=villa.qr;
 assert.equal((await request(endpoint,{action:'regenerate',expectedQr:old,reason:'Replace printed code'},m)).status,403);
 assert.equal((await request(endpoint,{action:'regenerate',expectedQr:old,reason:''},a)).status,400);
 await request(endpoint,{status:'SUSPENDED'},a);
 const next=await request(endpoint,{action:'regenerate',expectedQr:old,reason:'Replace printed code'},a);assert.equal(next.status,200);assert.notEqual(next.value.qr,old);
 assert.equal((await request('/public/qr/'+old)).status,404);
 assert.equal((await request('/public/qr/'+next.value.qr)).value.qrStatus,'SUSPENDED');
 assert.equal((await request(endpoint,{action:'regenerate',expectedQr:old,reason:'Stale browser'},a)).status,409);
 await request(endpoint,{status:'DEFAULT'},a);assert.equal((await request('/public/qr/'+next.value.qr)).value.qrStatus,'ACTIVE');
 const stored=await db.prepare('SELECT * FROM villas WHERE id=?').get(villa.id);assert.equal(stored.payments,villa.payments);assert.equal(stored.expires,villa.expires);assert.equal(stored.package_id,villa.package_id);
 await db.prepare("UPDATE villas SET payments=1,expires='2000-01-01' WHERE id=?").run(villa.id);await request(endpoint,{status:'DEFAULT'},a);assert.equal((await request('/public/qr/'+next.value.qr)).value.qrStatus,'EXPIRED');
 assert.equal((await db.prepare("SELECT count(*) AS n FROM system_settings WHERE key LIKE 'qr_rotation:%'").get()).n,1);
});
