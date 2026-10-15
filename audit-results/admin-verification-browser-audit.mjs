import EmbeddedPostgres from '../node_modules/embedded-postgres/dist/index.js';
import {chromium,webkit} from '/private/tmp/villacheck-audit-tools/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {openPostgres} from '../server/postgres.mjs';
import {seedDemo} from '../server/demo-seed.mjs';
import {createApp} from '../server/app.mjs';
import {hashPassword} from '../server/database.mjs';
import {publishedCms} from '../server/cms.mjs';
import {otpDestination} from '../server/login-otp.mjs';
const root=process.cwd(),engine=process.env.RESPONSIVE_ENGINE||'chromium',pgPort=engine==='webkit'?55465:55464,port=engine==='webkit'?8562:8560,apiPort=port+1,origin='https://villacheck.test',local=`http://127.0.0.1:${port}`,apiLocal=`http://127.0.0.1:${apiPort}`;
const password=randomBytes(20).toString('hex'),pg=new EmbeddedPostgres({databaseDir:mkdtempSync('/private/tmp/villacheck-merchant-auth-')+'/db',user:'postgres',password,port:pgPort,persistent:true,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
const env={...process.env};for(const line of readFileSync('.env','utf8').split('\n')){const key=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];if(key)env[key]='';}
const codes=new Map(),profiles={google:{},line:{},facebook:{}},results=[],errors=[],layout=[],contexts={},pages={};let db,server,backend,browser;
mkdirSync('audit-results/functional-screenshots',{recursive:true});
const save=()=>writeFileSync(`audit-results/admin-verification-browser-${engine}.json`,JSON.stringify({checkedAt:new Date().toISOString(),engine,dummyOnly:true,realMessageDelivery:false,physicalDeviceTest:false,results,layout,errors,pass:results.filter(x=>x.passed).length,fail:results.filter(x=>!x.passed).length},null,2));
const t=async(name,fn)=>{try{await fn();results.push({name,passed:true});console.log('PASS',name)}catch(e){results.push({name,passed:false,error:e.message});console.log('FAIL',name,e.message.split('\n')[0]);}save();};
let visits=0;const visit=async(p,page)=>{await p.goto(origin+'/?auth-audit='+(++visits)+'#page='+page);await p.locator('h1').waitFor();await p.waitForTimeout(300)};
const api=async(p,path,data)=>p.evaluate(async({path,data})=>{let csrf;if(data!==undefined){const me=await fetch('/api/auth/me');if(me.ok)csrf=(await me.json()).csrf;}const r=await fetch('/api'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...csrf?{'X-CSRF-Token':csrf}:{}},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,value:await r.json().catch(()=>null)};},{path,data});
const otp=async(p,channel,destination,purpose='login')=>{const form=p.locator('.login-otp');await form.getByRole('button',{name:channel==='sms'?'เบอร์โทรศัพท์':'อีเมล',exact:true}).click();await form.getByLabel(channel==='sms'?'เบอร์โทรศัพท์':'อีเมลรับ OTP').fill(destination);await form.getByRole('button',{name:'รับรหัส OTP',exact:true}).click();await form.getByLabel('รหัส OTP').waitFor();await form.getByLabel('รหัส OTP').fill(codes.get(otpDestination(channel,destination)));await form.getByRole('button',{name:purpose==='register'?'ยืนยัน OTP และสร้างบัญชี':purpose==='link_identity'?'ยืนยันช่องทางเข้าสู่ระบบ':'ยืนยัน OTP และเข้าสู่ระบบ',exact:true}).click();};
const seedProfile=(provider,owner='new')=>profiles[provider]={sub:`${owner}-${provider}`,id:`${owner}-${provider}`,name:'Dummy Merchant',email:`${owner}-${provider}@example.test`,email_verified:true};
try{
 await pg.initialise();await pg.start();const client=pg.getPgClient();await client.connect();await client.query('CREATE DATABASE dummy_auth');await client.end();const url=new URL(`postgresql://postgres@127.0.0.1:${pgPort}/dummy_auth`);url.password=password;db=await openPostgres(url.toString());await seedDemo(db,{password:'AuditDummyPassword123',adminEmail:'full-admin@example.com',adminPassword:'AuditDummyPassword123'});
 await db.prepare("UPDATE users SET business_name='Dummy Company',phone='0800000000',address='Dummy Address' WHERE role='merchant'").run();
 const release=await publishedCms(db);release.content.business.facebookLoginEnabled=true;await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('cms_published',JSON.stringify(release));
 const config={appUrl:origin,allowedOrigins:[origin],secureCookies:true,serverless:true,demoMode:true,otpSecret:'dummy-browser-secret-with-more-than-32-characters',smtpFrom:'dummy@example.test',thaiBulkSmsApiKey:'dummy-key',thaiBulkSmsApiSecret:'dummy-secret',thaiBulkSmsSender:'VillaCheck',fakeHash:hashPassword('dummy-fake-password'),googleClientId:'dummy-google',googleClientSecret:'dummy-secret',lineClientId:'dummy-line',lineClientSecret:'dummy-secret',facebookClientId:'dummy-facebook',facebookClientSecret:'dummy-secret',facebookVersion:'v24.0',facebookLoginEnabled:true,smsFetch:async(_url,options)=>{const p=new URLSearchParams(options.body);codes.set('+'+p.get('msisdn'),p.get('message').match(/\b\d{6}\b/)[0]);return {ok:true,status:200,json:async()=>({phone_number_list:[{number:p.get('msisdn'),message_id:'dummy-message'}]})}},oauthFetch:async(url,options)=>{const u=String(url),provider=u.includes('line.me')?'line':u.includes('facebook')?'facebook':'google';return {ok:true,json:async()=>u.includes('/token')||u.includes('access_token')?{access_token:'dummy-token',id_token:'dummy-line-token'}:u.endsWith('/verify')?{...profiles.line,iss:'https://access.line.me',aud:'dummy-line',nonce:new URLSearchParams(options.body).get('nonce'),exp:Date.now()/1000+3600}:profiles[provider]};}};
 backend=createApp(db,config,{sendMail:async m=>codes.set(m.to,m.text.match(/\b\d{6}\b/)[0])});await new Promise(r=>backend.listen(apiPort,'127.0.0.1',r));
 Object.assign(env,{DATABASE_URL:url.toString(),APP_URL:origin,NODE_ENV:'production',ADMIN_EMAIL:'full-admin@example.com',ADMIN_PASSWORD:'AuditDummyPassword123',NEXT_TELEMETRY_DISABLED:'1',SEED_DEMO_ACCOUNTS:'false',DEMO_MODE:'true'});server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port',String(port),'--hostname','127.0.0.1'],{cwd:root,env,stdio:'ignore'});let ready=false;for(let n=0;n<80;n++){try{if((await fetch(local)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}assert.ok(ready);
 browser=engine==='webkit'?await webkit.launch({headless:true}):await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=async name=>{const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await c.route(origin+'/**',async route=>{const target=route.request().url().replace(origin,new URL(route.request().url()).pathname.startsWith('/api/')?apiLocal:local);const response=await route.fetch({url:target,maxRedirects:0});if(response.status()===302){await route.fulfill({response,status:200,contentType:'text/html',body:'<script>location.replace('+JSON.stringify(response.headers().location)+')</script>'});}else await route.fulfill({response});});for(const [host,provider]of [['accounts.google.com','google'],['access.line.me','line'],['www.facebook.com','facebook']])await c.route('https://'+host+'/**',async route=>{const state=new URL(route.request().url()).searchParams.get('state');await route.fulfill({status:200,contentType:'text/html',body:'<script>location.replace('+JSON.stringify(origin+`/api/auth/oauth/${provider}/callback?state=${state}&code=dummy-code`)+')</script>'});});contexts[name]=c;const p=await c.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push({context:name,message:e.message}));pages[name]=p;return p;};


 const adminPage=await context('admin');let initialPending=0;
 await t('Dedicated Admin login enters CMS directly with no social or signup buttons',async()=>{
 await adminPage.goto(origin+'/admin/login');await adminPage.getByRole('heading',{name:'เข้าสู่ระบบ Admin',exact:true}).waitFor();
 assert.equal(await adminPage.locator('.oauth-button,.login-bottom').count(),0);
 await adminPage.getByLabel('อีเมล Admin').fill('full-admin@example.com');await adminPage.getByLabel('รหัสผ่าน',{exact:true}).fill('AuditDummyPassword123');await adminPage.getByRole('button',{name:'เข้าสู่ระบบ Admin',exact:true}).click();await adminPage.getByRole('heading',{name:'จัดการเว็บไซต์ CMS',exact:true}).waitFor();assert.equal(new URL(adminPage.url()).pathname,'/admin');
 const pending=await db.prepare("SELECT count(*) AS n FROM villas WHERE status='pending'").get();initialPending=Number(pending.n);
 await adminPage.getByRole('region',{name:'รายการ Villa รออนุมัติ'}).getByRole('status').filter({hasText:`Villa รออนุมัติ ${initialPending} รายการ`}).waitFor();
 });
 await t('Guest CMS redirects to dedicated login and public logins do not link to Admin',async()=>{
 const p=await context('guest');await p.goto(origin+'/admin');await p.getByRole('heading',{name:'เข้าสู่ระบบ Admin',exact:true}).waitFor();assert.equal(new URL(p.url()).pathname,'/admin/login');
 for(const route of ['login','owner-auth']){await visit(p,route);assert.equal(await p.getByRole('button',{name:/Admin/}).count(),0);assert.equal(await p.locator('a[href*="admin"]').count(),0);}
 });
 await t('Merchant credentials cannot enter CMS via Admin login',async()=>{
 const p=await context('denied');await p.goto(origin+'/admin/login');await p.getByLabel('อีเมล Admin').fill('demo-merchant@villacheck.example');await p.getByLabel('รหัสผ่าน',{exact:true}).fill('AuditDummyPassword123');await p.getByRole('button',{name:'เข้าสู่ระบบ Admin',exact:true}).click();await p.getByRole('alert').filter({hasText:'บัญชีนี้ไม่มีสิทธิ์ Admin'}).waitFor();assert.equal((await api(p,'/admin/cms')).status,401);
 });
 const owner=await context('owner');await visit(owner,'owner-auth');
 assert.equal((await api(owner,'/auth/login',{email:'demo-merchant@villacheck.example',password:'AuditDummyPassword123'})).status,200);
 const villa=await db.prepare("SELECT * FROM villas WHERE name='Sea Sky Demo Villa'").get();
 const edit=async()=>{await owner.goto(origin+'/#page=owner-villa-edit&item='+villa.id);await owner.getByRole('heading',{name:'แก้ไขข้อมูล Villa',exact:true}).waitFor();};
 await t('Edits survive background refresh and save persists with original QR',async()=>{
 await edit();const form=owner.locator('form').filter({has:owner.getByRole('heading',{name:'แก้ไขข้อมูล Villa',exact:true})});
 await form.getByLabel('name',{exact:true}).fill('Saved Dummy Villa');await form.getByLabel('จำนวนผู้พักสูงสุด').fill('8');
 await owner.waitForTimeout(11000);assert.equal(await form.getByLabel('name',{exact:true}).inputValue(),'Saved Dummy Villa');
 await form.getByRole('button',{name:'บันทึกและส่งตรวจใหม่',exact:true}).click();await form.getByRole('status').filter({hasText:'บันทึกสำเร็จ'}).waitFor();
 const saved=await db.prepare('SELECT name,status,qr,guest_capacity FROM villas WHERE id=?').get(villa.id);
 assert.deepEqual(saved,{name:'Saved Dummy Villa',status:'pending',qr:villa.qr,guest_capacity:8});
 await owner.reload();await form.getByLabel('name',{exact:true}).waitFor();assert.equal(await form.getByLabel('name',{exact:true}).inputValue(),'Saved Dummy Villa');
 });
 await t('API save error stays visible at submit and retains entered values',async()=>{
 await owner.route(origin+'/api/merchant/villas/'+villa.id,route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Dummy validation error'})}));
 const form=owner.locator('form').filter({has:owner.getByRole('heading',{name:'แก้ไขข้อมูล Villa',exact:true})});await form.getByLabel('name',{exact:true}).fill('Retry Dummy Villa');await form.getByRole('button',{name:'บันทึกและส่งตรวจใหม่',exact:true}).click();await form.getByRole('status').filter({hasText:'Dummy validation error'}).waitFor();assert.equal(await form.getByLabel('name',{exact:true}).inputValue(),'Retry Dummy Villa');assert.equal(await form.getByRole('button',{name:'บันทึกและส่งตรวจใหม่',exact:true}).isEnabled(),true);
 await owner.unroute(origin+'/api/merchant/villas/'+villa.id);
 });
 await t('Photo upload and retry resubmit successfully without duplicate clicks',async()=>{
 const form=owner.locator('form').filter({has:owner.getByRole('heading',{name:'แก้ไขข้อมูล Villa',exact:true})});await form.locator('input[type=file]').setInputFiles({name:'dummy.jpg',mimeType:'image/jpeg',buffer:readFileSync('public/demo/villas/villa-1.jpg')});await form.getByText('dummy.jpg',{exact:true}).waitFor();
 let posts=0;await owner.route(origin+'/api/merchant/villas/'+villa.id,async route=>{posts++;await new Promise(r=>setTimeout(r,500));await route.fallback();});
 const button=form.getByRole('button',{name:'บันทึกและส่งตรวจใหม่',exact:true});await button.click();assert.equal(await form.getByRole('button',{name:'กำลังบันทึกและส่งตรวจ…'}).isDisabled(),true);await form.getByRole('status').filter({hasText:'บันทึกสำเร็จ'}).waitFor();assert.equal(posts,1);
 const saved=await db.prepare('SELECT name,status,qr,photo_url FROM villas WHERE id=?').get(villa.id);assert.equal(saved.name,'Retry Dummy Villa');assert.equal(saved.status,'pending');assert.equal(saved.qr,villa.qr);assert.match(saved.photo_url,/^\/api\/public\/villa-photo\//);
 });
 await t('Saving another field retains the newly uploaded photo without reloading',async()=>{
 const before=await db.prepare('SELECT photo_url FROM villas WHERE id=?').get(villa.id);
 const form=owner.locator('form').filter({has:owner.getByRole('heading',{name:'แก้ไขข้อมูล Villa',exact:true})});
 await form.getByLabel('phone',{exact:true}).fill('0811111111');await form.getByRole('button',{name:'บันทึกและส่งตรวจใหม่',exact:true}).click();await form.getByRole('status').filter({hasText:'บันทึกสำเร็จ'}).waitFor();
 assert.equal((await db.prepare('SELECT photo_url FROM villas WHERE id=?').get(villa.id)).photo_url,before.photo_url);
 });

 await t('Dedicated approval page shows actual changes, full Admin data, documents and approve controls',async()=>{
 await owner.getByText('สถานะ: รออนุมัติจาก Admin',{exact:true}).waitFor();await owner.reload();await owner.getByText('สถานะ: รออนุมัติจาก Admin',{exact:true}).waitFor();
 const notice=adminPage.getByRole('region',{name:'รายการ Villa รออนุมัติ'});await notice.getByRole('status').filter({hasText:`Villa รออนุมัติ ${initialPending+1} รายการ`}).waitFor({timeout:15000});
 await notice.getByRole('button',{name:'เปิดหน้ารายการ Villa รออนุมัติ',exact:true}).click();await adminPage.getByRole('heading',{name:'Villa รออนุมัติ',exact:true}).waitFor();assert.ok(adminPage.url().includes('page=admin-pending-villas'));
 const card=adminPage.getByRole('article',{name:'รออนุมัติ Retry Dummy Villa',exact:true});await card.waitFor();
 const row=card.getByRole('row').filter({has:adminPage.getByRole('rowheader',{name:'จำนวนผู้เข้าพักสูงสุด',exact:true})});assert.equal(await row.getByRole('cell').nth(0).innerText(),String(villa.guest_capacity));assert.equal(await row.getByRole('cell').nth(1).innerText(),'8');
 await card.locator('dl').getByText('0811111111',{exact:true}).waitFor();await card.locator('dl').getByText(villa.account_number,{exact:true}).waitFor();await card.getByText(/DUMMY \/ เอกสารจำลอง/).waitFor();
 assert.ok((await card.getByRole('link',{name:'เปิดดูเอกสารที่แนบ',exact:true}).getAttribute('href')).includes('?preview=1'));
 const sample=await adminPage.evaluate(async()=>{const r=await fetch('/api/admin/review-sample-document');return {status:r.status,text:await r.text()}});assert.equal(sample.status,200);assert.match(sample.text,/dummy document/i);
 const registration=adminPage.getByRole('article',{name:'รออนุมัติ Hua Hin Demo Villa',exact:true});await registration.getByText(/สาเหตุที่รออนุมัติ:.*รอตรวจเอกสารกรรมสิทธิ์/).waitFor();
 for(const [width,height]of [[375,812],[820,1180],[1280,900]]){await adminPage.setViewportSize({width,height});await adminPage.waitForTimeout(200);assert.ok(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}
 await adminPage.setViewportSize({width:390,height:844});
 await card.getByRole('button',{name:'อนุมัติ Villa',exact:true}).click();await card.waitFor({state:'hidden'});
 await notice.getByRole('status').filter({hasText:`Villa รออนุมัติ ${initialPending} รายการ`}).waitFor({timeout:15000});
 assert.equal((await db.prepare('SELECT status FROM villas WHERE id=?').get(villa.id)).status,'approved');
 await owner.getByText('สถานะ: รออนุมัติจาก Admin',{exact:true}).waitFor({state:'hidden',timeout:15000});
 });

 await t('Admin QR registry opens dedicated full verification without User login or registration',async()=>{
 let userCheckPosts=0;adminPage.on('request',r=>{if(r.url().includes('/api/user/checks')&&r.method()==='POST')userCheckPosts++;});
 await visit(adminPage,'admin-qr');const row=adminPage.locator('article').filter({has:adminPage.getByRole('heading',{name:'Retry Dummy Villa',exact:true})});await row.getByRole('button',{name:'เปิดหน้าตรวจสอบ',exact:true}).click();await adminPage.getByText('ข้อมูลเต็มสำหรับ Admin',{exact:true}).waitFor();assert.ok(adminPage.url().includes('page=admin-verify'));assert.equal(new URL(adminPage.url()).pathname,'/admin');
 const contact=adminPage.locator('.verification-contact');await contact.getByText('0811111111',{exact:true}).waitFor();await contact.getByText(villa.account_number,{exact:true}).waitFor();assert.equal(await contact.getByText('ข้อมูลถูกซ่อน',{exact:true}).count(),0);assert.equal(await adminPage.getByRole('button',{name:'สมัครสมาชิก User',exact:true}).count(),0);assert.equal(await adminPage.getByRole('button',{name:'เข้าสู่ระบบเพื่อดูข้อมูล',exact:true}).count(),0);assert.equal(await adminPage.getByText('สำหรับสมาชิก User',{exact:true}).count(),0);assert.equal(userCheckPosts,0);
 await adminPage.reload();await adminPage.getByText('ข้อมูลเต็มสำหรับ Admin',{exact:true}).waitFor();assert.equal(await contact.locator('dd').last().innerText(),villa.account_number);
 for(const [width,height]of [[375,812],[820,1180],[1280,900]]){await adminPage.setViewportSize({width,height});await adminPage.waitForTimeout(200);assert.ok(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}await adminPage.setViewportSize({width:390,height:844});
 await adminPage.getByRole('button',{name:'กลับทะเบียน QR',exact:true}).click();await adminPage.getByRole('heading',{name:'จัดการ Villa Verification QR',exact:true}).waitFor();
 });
 await t('Admin using a legacy public QR URL still sees full details and no User signup',async()=>{
 await adminPage.goto(origin+'/#page=verify&item='+encodeURIComponent(villa.qr));await adminPage.getByText('ข้อมูลเต็มสำหรับ Admin',{exact:true}).waitFor();assert.equal(await adminPage.locator('.verification-login').count(),0);await adminPage.locator('.verification-contact').getByText(villa.account_number,{exact:true}).waitFor();await visit(adminPage,'admin-cms');
 });
 await t('Admin logout returns to dedicated login and remains protected on reload',async()=>{
 await adminPage.getByRole('button',{name:'เมนู ☰',exact:true}).click();await adminPage.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();await adminPage.getByRole('heading',{name:'เข้าสู่ระบบ Admin',exact:true}).waitFor();assert.equal(new URL(adminPage.url()).pathname,'/admin/login');await adminPage.reload();await adminPage.getByRole('heading',{name:'เข้าสู่ระบบ Admin',exact:true}).waitFor();assert.equal((await api(adminPage,'/admin/cms')).status,401);
 });

 await t('Admin login and CMS approval notice fit mobile, tablet and desktop widths',async()=>{
 for(const [width,height]of [[375,812],[820,1180],[1280,900]]){await adminPage.setViewportSize({width,height});assert.ok(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}
 await adminPage.getByLabel('อีเมล Admin').fill('full-admin@example.com');await adminPage.getByLabel('รหัสผ่าน',{exact:true}).fill('AuditDummyPassword123');await adminPage.getByRole('button',{name:'เข้าสู่ระบบ Admin',exact:true}).click();await adminPage.getByRole('heading',{name:'จัดการเว็บไซต์ CMS',exact:true}).waitFor();
 for(const [width,height]of [[375,812],[820,1180],[1280,900]]){await adminPage.setViewportSize({width,height});await adminPage.waitForTimeout(200);assert.ok(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}
 });
 assert.equal(results.filter(x=>!x.passed).length,0);assert.equal(errors.length,0);console.log(JSON.stringify({engine,passed:results.length,errors}));save();
}finally{await browser?.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}if(backend)await new Promise(r=>backend.close(r));await db?.close();await pg.stop().catch(()=>{});}
