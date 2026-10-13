import test from "node:test"
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {openTestDatabase} from "./test-database.mjs"
import {createUser,hashPassword,createInvoice} from "./database.mjs"
import {createApp} from "./app.mjs"
import {cmsDefaults} from "./cms-defaults.mjs"
import {createLoginOtp} from "./login-otp.mjs"
import {createMailWorker} from "./mail.mjs"

test("Document requirements: OTP copy, pending Facebook, Admin-only readiness and immutable payment instructions",async t=>{
 const db=await openTestDatabase(),admin=await createUser(db,'doc-admin@example.test','DummyPassword123','Admin','admin'),owner=await createUser(db,'doc-owner@example.test','DummyPassword123','Owner','merchant'),member=await createUser(db,'doc-user@example.test','DummyPassword123','Member','user');
 const delivered=[],sms=[],transport={sendMail:async m=>delivered.push(m)},config={appUrl:'http://localhost:3001',allowedOrigins:['http://localhost:3001'],fakeHash:hashPassword('dummy-fake'),serverless:true,smtpFrom:'dummy@example.test',paymentInstructions:'ENV BANK',otpSecret:'dummy-otp-secret-with-more-than-32-characters',thaiBulkSmsApiKey:'dummy-key',thaiBulkSmsApiSecret:'dummy-secret',thaiBulkSmsSender:'Dummy',facebookClientId:'dummy-id',facebookClientSecret:'dummy-secret',facebookVersion:'v24.0'};
 const server=createApp(db,config,transport);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await db.close()});const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(path,data,session)=>{const r=await fetch(base+path,{redirect:'manual',method:data===undefined?'GET':'POST',headers:{Origin:config.appUrl,'Content-Type':'application/json',...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,value:await r.json().catch(()=>null),location:r.headers.get('location'),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
 const login=async user=>{const r=await request('/api/auth/login',{email:user.email,password:'DummyPassword123'});return {cookie:r.cookie,csrf:r.value.csrf}};
 const a=await login(admin),o=await login(owner),u=await login(member);let revision=0;
 const publish=async content=>{const saved=await request('/api/admin/cms/save',{revision,content},a);assert.equal(saved.status,200);revision=saved.value.draft.revision;assert.equal((await request('/api/admin/cms/publish',{revision},a)).status,200)};
 await t.test('Facebook remains off while pending; only an Admin publication can enable it',async()=>{
  assert.equal((await request('/api/config')).value.oauth.facebook,false)
  assert.match((await request('/api/auth/oauth/facebook/start')).location,/pending_approval/)
  const c=structuredClone(cmsDefaults);c.business.facebookLoginEnabled=true;await publish(c)
  assert.equal((await request('/api/config')).value.oauth.facebook,true)
  assert.match((await request('/api/auth/oauth/facebook/start')).location,/facebook\.com/)
  c.business.facebookLoginEnabled=false;await publish(c)
  assert.equal((await request('/api/config')).value.oauth.facebook,false)
 });
 await t.test('CMS email/SMS templates render the real generated code without changing expiry or replay protection',async()=>{
  const c=structuredClone(cmsDefaults);c.business.emailOtpSubject='Dummy sign-in';c.business.emailOtpBody='Email {{code}} expires {{minutes}} min';c.business.smsOtpBody='SMS {{code}} expires {{minutes}} min';await publish(c)
  const otp=createLoginOtp(db,config,transport,async(url,options)=>{const params=new URLSearchParams(options.body);sms.push(params.get('message'));return {ok:true,status:200,json:async()=>({phone_number_list:[{number:params.get('msisdn'),message_id:'dummy-id'}]})}})
  const mailChallenge=await otp.request({channel:'email',destination:member.email}),mail=delivered.at(-1);assert.equal(mail.subject,'Dummy sign-in');assert.match(mail.text,/Email \d{6} expires 5 min/)
  assert.equal((await otp.verify({challengeId:mailChallenge.challengeId,code:mail.text.match(/\d{6}/)[0]})).id,member.id)
  await assert.rejects(()=>otp.verify({challengeId:mailChallenge.challengeId,code:mail.text.match(/\d{6}/)[0]}),e=>e.status===401)
  const smsChallenge=await otp.request({channel:'sms',destination:'0812345678'});assert.match(sms[0],/SMS \d{6} expires 5 min/);assert.equal((await otp.verify({challengeId:smsChallenge.challengeId,code:sms[0].match(/\d{6}/)[0]})).role,'user')
  const unsafe=structuredClone(c);unsafe.business.smsOtpBody='No code here';assert.equal((await request('/api/admin/cms/save',{revision,content:unsafe},a)).status,400)
  const pub=(await request('/api/public/cms')).value.content.business;assert.equal(pub.emailOtpBody,'');assert.equal(pub.smsOtpBody,'');assert.equal(pub.emailOtpTemplateId,'')
 });
 await t.test('Changing CMS bank instructions cannot alter an existing invoice or its delivered email',async()=>{
  const c=structuredClone(cmsDefaults);c.site.paymentInstructions='DUMMY BANK A';await publish(c)
  const doc=randomUUID(),id=randomUUID();await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(doc,owner.id,'dummy.pdf','application/pdf',Buffer.from('%PDF-1.4 Dummy'));await db.prepare('INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,created) VALUES (?,?,?,?,?,?,?,?,?)').run(id,owner.id,'Payment Snapshot Villa','ชลบุรี','Owner',owner.email,'starter',doc,new Date().toISOString())
  const invoice=await createInvoice(db,await db.prepare('SELECT * FROM villas WHERE id=?').get(id),config.appUrl,config.paymentInstructions)
  c.site.paymentInstructions='DUMMY BANK B';await publish(c)
  assert.equal((await db.prepare('SELECT payment_instructions FROM mails WHERE invoice_id=?').get(invoice)).payment_instructions,'DUMMY BANK A')
  const state=(await request('/api/state',undefined,o)).value;assert.equal(state.paymentInstructions,'DUMMY BANK B');assert.equal(state.villas[0].invoices[0].paymentInstructions,'DUMMY BANK A')
  const worker=createMailWorker(db,config,transport);await worker.run();worker.stop()
  const msg=delivered.find(m=>m.text.includes(invoice));assert.ok(msg.text.includes('DUMMY BANK A'));assert.ok(!msg.text.includes('DUMMY BANK B'));assert.ok(!msg.text.includes('ENV BANK'))
 });
 await t.test('Readiness is Admin-only and distinguishes configured services from actual acceptance',async()=>{
  assert.equal((await request('/api/admin/readiness')).status,401);assert.equal((await request('/api/admin/readiness',undefined,o)).status,403);assert.equal((await request('/api/admin/readiness',undefined,u)).status,403)
  const r=await request('/api/admin/readiness',undefined,a);assert.equal(r.status,200);assert.equal(r.value.facebookStatus,'waiting-approval');assert.equal(r.value.paymentMode,'MANUAL');assert.equal(r.value.otp.emailVerification.accepted,true);assert.equal(r.value.otp.smsVerification.accepted,true)
  assert.equal(r.value.acceptance.physicalDevices,'manual-review-required');assert.ok(!JSON.stringify(r.value).includes(config.otpSecret));assert.ok(!JSON.stringify(r.value).includes(config.facebookClientSecret))
 });
})
