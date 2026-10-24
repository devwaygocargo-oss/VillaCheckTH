import {testReceivingBank} from "./test-receiving-bank.mjs"
import {legacyVilla} from "./test-legacy-villa.mjs";
import {openTestDatabase} from './test-database.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './app.mjs';
import {createUser,hashPassword,packages,addMonths} from './database.mjs';
test('four monthly packages: first property and legacy additional property retain independent purchases',async t=>{
 const db=await openTestDatabase(),password='Merchant-password-123';
 await createUser(db,'admin@example.com',password,'Admin','admin');
 await testReceivingBank(db);
 const server=createApp(db,{appUrl:'http://localhost:3001',allowedOrigins:[],paymentInstructions:'Bank',fakeHash:hashPassword('fake-password-placeholder')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await db.close()});
 const request=async(path,data,auth)=>{
  const r=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrf}:{})},body:data===undefined?undefined:JSON.stringify(data)});
  const value=await r.json();return {status:r.status,value,cookie:r.headers.get('set-cookie')?.split(';')[0],csrf:value.csrf};
 };
 const admin=await request("/auth/admin-login",{email:'admin@example.com',password});
 const document={name:'proof.pdf',type:'application/pdf',data:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4\nfixture').toString('base64')};
 for(const [planId,plan] of Object.entries(packages))await t.test(plan.name,async()=>{
  await createUser(db,`${planId}@example.com`,password,plan.name);
  const owner=await request('/auth/login',{email:`${planId}@example.com`,password});
  assert.equal((await request('/subscription',{packageId:planId},owner)).status,409);
  const ids=[];
  for(let i=0;i<2;i++){
   let r=await request('/villas',{name:`บ้าน ${i}`,nameEn:`Villa ${i}`,province:'ชลบุรี',merchant:plan.name,email:`${planId}@example.com`,document,packageId:planId},owner);
   if(i===1){assert.equal(r.status,409);r={status:201,value:{createdId:await legacyVilla(db,ids[0],'Legacy Villa 2')}};}
   assert.equal(r.status,201);ids.push(r.value.createdId);
   assert.equal((await request(`/villas/${r.value.createdId}/review`,{status:'approved',verificationLevel:'BASIC_CHECKED'},admin)).status,200);
  }
  let state=(await request('/state',undefined,owner)).value;
  assert.equal(new Set(state.villas.map(v=>v.qr)).size,2);assert.ok(state.villas.every(v=>v.trialUnlimited&&v.qr));
  assert.equal(state.villas.flatMap(v=>v.invoices).length,0);
  const buy=await request('/merchant/villa-package',{villaId:ids[0],packageId:planId},owner);assert.equal(buy.status,200);
  if(planId==='basic'){assert.equal(buy.value.villas.flatMap(v=>v.invoices).length,0);assert(buy.value.villas.every(v=>v.trialUnlimited));return}
  const invoice=buy.value.villas.find(v=>v.id===ids[0]).invoices[0];assert.equal(invoice.amount,plan.amount/100);assert.equal(invoice.months,1);assert.equal(invoice.scope,'villa');
  assert.equal((await request(`/invoices/${invoice.id}/proof`,{document:{...document,data:"data:application/pdf;base64,"+Buffer.from("%PDF-1.4 Test receipt "+invoice.id).toString("base64")},reference:`BUY-${invoice.id}`},owner)).status,200);
  assert.equal((await request(`/invoices/${invoice.id}/confirm`,{},admin)).status,200);
  assert.equal((await request(`/villas/${ids[0]}/review`,{status:'approved',verificationLevel:'BASIC_CHECKED'},admin)).status,200);
  state=(await request('/state',undefined,owner)).value;
  let villa=state.villas.find(v=>v.id===ids[0]),free=state.villas.find(v=>v.id===ids[1]);
  assert.equal(villa.packageId,planId);assert.equal(villa.verificationLevel,'BASIC_CHECKED');assert.equal(villa.trialUnlimited,false);assert.equal(free.trialUnlimited,true);assert.equal(free.expires,'');
  const qr=villa.qr,expires=villa.expires;
  await Promise.all([request(`/villas/${villa.id}/renew`,{},owner),request(`/villas/${villa.id}/renew`,{},owner)]);
  state=(await request('/state',undefined,owner)).value;const pending=state.villas.find(v=>v.id===villa.id).invoices.filter(i=>i.status!=='paid');assert.equal(pending.length,1);assert.equal(pending[0].months,1);
  assert.equal((await request(`/payments/${pending[0].id}/slip`,{document:{...document,data:"data:application/pdf;base64,"+Buffer.from("%PDF-1.4 Test receipt "+invoice.id).toString("base64")},reference:`BUY-${invoice.id}`},owner)).status,409);
  assert.equal((await request('/admin/payments',undefined,owner)).status,403);
  await request(`/invoices/${pending[0].id}/proof`,{document:{...document,data:"data:application/pdf;base64,"+Buffer.from("%PDF-1.4 Test receipt "+pending[0].id).toString("base64")},reference:`RENEW-${pending[0].id}`},owner);
  assert.equal((await request(`/payments/${pending[0].id}/status`,undefined,owner)).value.paymentStatus,'PENDING_REVIEW');
  await request(`/invoices/${pending[0].id}/confirm`,{},admin);
  const confirmed=await request(`/invoices/${pending[0].id}/confirm`,{},admin);
  villa=confirmed.value.villas.find(v=>v.id===ids[0]);free=confirmed.value.villas.find(v=>v.id===ids[1]);
  assert.equal(villa.qr,qr);assert.equal(villa.expires,addMonths(expires,1));assert.equal(villa.payments,2);assert.equal(free.trialUnlimited,true);
  assert.equal((await request(`/payments/${pending[0].id}/status`,undefined,owner)).value.paymentStatus,'VERIFIED');
 });
});
