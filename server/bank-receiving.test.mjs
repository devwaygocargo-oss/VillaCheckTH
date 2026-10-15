import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {PNG} from 'pngjs'
import zxing from '@zxing/library'
import {openTestDatabase} from './test-database.mjs'
import {createUser,hashPassword,createInvoice} from './database.mjs'
import {createApp} from './app.mjs'
import {receivingBank} from './payment-account.mjs'

const decode=buffer=>{
 const png=PNG.sync.read(buffer),pixels=new Uint8ClampedArray(png.width*png.height)
 for(let i=0;i<pixels.length;i++)pixels[i]=(png.data[i*4]+png.data[i*4+1]+png.data[i*4+2])/3
 return new zxing.QRCodeReader().decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(pixels,png.width,png.height)))).getText()
}
const crc=text=>{let value=0xffff;for(const b of Buffer.from(text)){value^=b<<8;for(let i=0;i<8;i++)value=value&0x8000?(value<<1)^0x1021:value<<1;value&=0xffff;}return value.toString(16).toUpperCase().padStart(4,'0')}
const tlv=payload=>{const result={};for(let i=0;i<payload.length;){const tag=payload.slice(i,i+2),length=Number(payload.slice(i+2,i+4));result[tag]=payload.slice(i+4,i+4+length);i+=length+4;}return result}

test('Admin receiving bank uses stable decodable PromptPay QR, scoped email outbox and immutable invoice snapshots',async t=>{
 const db=await openTestDatabase(),password='DummyBankPassword123',sent=[];let smtpFailure=false
 const admin=await createUser(db,'bank-admin@example.test',password,'Bank Admin','admin')
 const merchant=await createUser(db,'bank-merchant@example.test',password,'Bank Merchant','merchant')
 const other=await createUser(db,'bank-other@example.test',password,'Other Merchant','merchant')
 await createUser(db,'bank-user@example.test',password,'Bank User','user')
 const config={appUrl:'http://localhost:8443',allowedOrigins:['http://localhost:8443'],fakeHash:hashPassword('fake-bank-password'),serverless:true,smtpFrom:'dummy-sender@example.test',demoMode:false}
 const server=createApp(db,config,{sendMail:async mail=>{if(smtpFailure)throw Object.assign(Error('secret-provider-detail'),{code:'EAUTH'});if(mail.messageId.startsWith("<bank-"))sent.push(mail)}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await server.runMail();await new Promise(r=>server.close(r));await db.close()})
 const req=async(path,data,session,csrf=true)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:data===undefined?'GET':'POST',headers:{Origin:config.appUrl,'Content-Type':'application/json',...(session?{Cookie:session.cookie,...csrf?{'X-CSRF-Token':session.csrf}:{}}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,value:r.headers.get('content-type')?.includes('json')?await r.json():Buffer.from(await r.arrayBuffer()),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const login=async email=>{const r=await req('/auth/login',{email,password});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf}}
 const a=await login(admin.email),m=await login(merchant.email),u=await login('bank-user@example.test')
 const fields={bankName:'DUMMY BANK - NO REAL MONEY',accountName:'DUMMY ACCOUNT',accountNumber:'0000000000',promptpayType:'phone',promptpayId:'0812345678',instructions:'DUMMY ONLY',confirmedBinding:true}
 let saved,first,invoice
 await t.test('Only Admin reads and writes receiving accounts; CSRF and validation are enforced',async()=>{
  assert.equal((await req('/admin/receiving-bank')).status,401)
  assert.equal((await req('/admin/receiving-bank',undefined,m)).status,403)
  assert.equal((await req('/admin/receiving-bank',{...fields,revision:0},u)).status,403)
  assert.equal((await req('/admin/receiving-bank',{...fields,revision:0},a,false)).status,403)
  for(const bad of [{promptpayId:'123'},{confirmedBinding:false},{accountNumber:'not-a-number'},{promptpayType:'taxId',promptpayId:'1234567890123'}])assert.equal((await req('/admin/receiving-bank',{...fields,...bad,revision:0},a)).status,400)
  saved=await req('/admin/receiving-bank',{...fields,revision:0},a);assert.equal(saved.status,200);first=saved.value.bank
  assert.equal((await req('/admin/receiving-bank',{...fields,revision:0},a)).status,409)
 })
 await t.test('PNG decodes to a static amount-free PromptPay payload with a valid CRC',async()=>{
  const image=await req(first.qrImage.replace('/api',''),undefined,m);assert.equal(image.status,200)
  assert.equal(decode(image.value),first.payload);assert.equal(first.payload.slice(-4),crc(first.payload.slice(0,-4)))
  const tags=tlv(first.payload);assert.equal(tags['01'],'11');assert.equal(tags['53'],'764');assert.equal(tags['58'],'TH');assert.equal(tags['54'],undefined)
  assert.equal(tlv(tags['29'])['01'],'0066812345678')
  assert.equal((await req(first.qrImage.replace('/api',''))).status,401)
  assert.equal((await req(first.qrImage.replace('/api',''),undefined,u)).status,403)
 })
 await t.test('Saving the same receiver preserves the exact QR; invoices keep bank and QR snapshots',async()=>{
  const same=await req('/admin/receiving-bank',{...fields,accountName:'DUMMY UPDATED',revision:first.revision},a);assert.equal(same.status,200);saved=same.value.bank
  assert.equal(saved.qrImage,first.qrImage);assert.equal(saved.payload,first.payload);assert.equal(saved.generatedAt,first.generatedAt)
  const villaId=randomUUID(),documentId=randomUUID();await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(documentId,merchant.id,'dummy.pdf','application/pdf',Buffer.from('%PDF-1.4 dummy'))
  await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,created) VALUES (?,?,?,?,?,?,?,?,?,?)").run(villaId,merchant.id,'Bank Snapshot Dummy Villa','ชลบุรี','Dummy Merchant',merchant.email,'starter',documentId,'approved',new Date().toISOString())
  invoice=await createInvoice(db,await db.prepare('SELECT * FROM villas WHERE id=?').get(villaId),config.appUrl)
  await db.prepare("UPDATE invoices SET subscription_owner=?,package_id='starter' WHERE id=?").run(merchant.id,invoice)
  const otherVilla=randomUUID();await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,created) VALUES (?,?,?,?,?,?,?,?,?,?)").run(otherVilla,other.id,'Other Dummy Villa','ชลบุรี','Other Dummy',other.email,'pro',documentId,'approved',new Date().toISOString())
  const otherInvoice=await createInvoice(db,await db.prepare('SELECT * FROM villas WHERE id=?').get(otherVilla),config.appUrl)
  await db.prepare("UPDATE invoices SET subscription_owner=?,package_id='pro' WHERE id=?").run(other.id,otherInvoice)
  const state=(await req('/state',undefined,m)).value;assert.equal(state.paymentBankQrImage,first.qrImage);assert.equal(state.villas[0].invoices[0].bankQrImage,first.qrImage)
  const publicCms=(await req('/public/cms')).value;assert.equal(publicCms.content.site.paymentInstructions,'');assert.equal(publicCms.content.site.paymentQrImage,'')
 })
 const email=(ids=[merchant.id],extra={})=>({requestId:randomUUID(),revision:saved.revision,merchantIds:ids,subject:'DUMMY bank account details',message:'DUMMY - NO PAYMENT',...extra})
 await t.test('Only selected Merchants receive separate PNG messages; retries of one request do not duplicate sends',async()=>{
  const payload=email([merchant.id,other.id]);const [r,duplicate]=await Promise.all([req('/admin/receiving-bank/email',payload,a),req('/admin/receiving-bank/email',payload,a)]);assert.equal(r.status,200);assert.equal(duplicate.status,200);assert.deepEqual(r.value.queuedIds,duplicate.value.queuedIds);await server.runMail()
  assert.equal(sent.length,2);assert.deepEqual(sent.map(x=>x.to).sort(),[merchant.email,other.email].sort())
  for(const mail of sent){assert.equal(mail.cc,undefined);assert.equal(mail.bcc,undefined);const tags=tlv(decode(mail.attachments[0].content));assert.equal(tags['29'],tlv(first.payload)['29']);const expected=await db.prepare("SELECT amount FROM invoices WHERE subscription_owner=?").get(mail.to===merchant.email?merchant.id:other.id);assert.equal(tags['54'],(expected.amount/100).toFixed(2));assert.ok(mail.text.includes('DUMMY UPDATED'));assert.ok(mail.text.includes('เลขที่ใบแจ้งชำระ'))}
  assert.equal((await req('/admin/receiving-bank/email',payload,a)).status,200);await server.runMail();assert.equal(sent.length,2)
  assert.equal((await req('/admin/receiving-bank/email',{...payload,message:'different'},a)).status,409)
  const history=(await req('/admin/receiving-bank',undefined,a)).value.notifications;assert.equal(history.filter(x=>x.status==='sent').length,2)
 })
 await t.test('Invalid recipient batches fail atomically and cannot target a User',async()=>{
  const user=await db.prepare("SELECT id FROM users WHERE email='bank-user@example.test'").get()
  for(const ids of [[merchant.id,user.id],[merchant.id,merchant.id],[],Array(51).fill(merchant.id)])assert.equal((await req('/admin/receiving-bank/email',email(ids),a)).status,400)
  assert.equal((await req('/admin/receiving-bank/email',email([merchant.id],{subject:'Bad\nsubject'}),a)).status,400)
  assert.equal((await req('/admin/receiving-bank/email',email(),m)).status,403)
  assert.equal((await req('/admin/receiving-bank',undefined,a)).value.notifications.length,2)
 })
 await t.test('Editing PromptPay creates a new QR; old invoices and failed-email retries retain the old receiver',async()=>{
  smtpFailure=true;const r=await req('/admin/receiving-bank/email',email(),a);await server.runMail();const id=r.value.queuedIds[0]
  let history=(await req('/admin/receiving-bank',undefined,a)).value.notifications;assert.equal(history.find(x=>x.id===id).status,'failed');assert.ok(!JSON.stringify(history).includes('secret-provider-detail'))
  const changed=await req('/admin/receiving-bank',{...fields,promptpayId:'0898765432',revision:saved.revision},a);assert.equal(changed.status,200);saved=changed.value.bank;assert.notEqual(saved.qrImage,first.qrImage)
  assert.equal(decode((await req(first.qrImage.replace('/api',''),undefined,m)).value),first.payload)
  const state=(await req('/state',undefined,m)).value;assert.equal(state.paymentBankQrImage,saved.qrImage);assert.equal(state.villas[0].invoices.find(i=>i.id===invoice).bankQrImage,first.qrImage);assert.ok(state.villas[0].invoices[0].paymentInstructions.includes('0812345678'))
  smtpFailure=false;assert.equal((await req(`/admin/receiving-bank/notifications/${id}/retry`,{},a)).status,200);await server.runMail();assert.equal(sent.length,3);assert.equal(tlv(decode(sent[2].attachments[0].content))['29'],tlv(first.payload)['29'])
  assert.equal((await req(`/admin/receiving-bank/notifications/${id}/retry`,{},a)).status,409)
 })
 await t.test('Demo emails never invoke SMTP, and stale account revisions cannot be sent',async()=>{
  await db.prepare("INSERT INTO system_settings(key,value) VALUES ('demo_mode','true') ON CONFLICT(key) DO UPDATE SET value=excluded.value").run()
  assert.equal((await req('/admin/receiving-bank/email',email([merchant.id],{revision:first.revision}),a)).status,409)
  const r=await req('/admin/receiving-bank/email',email(),a);assert.equal(r.status,200);await server.runMail();assert.equal(sent.length,3)
  assert.equal((await req('/admin/receiving-bank',undefined,a)).value.notifications.find(x=>x.id===r.value.queuedIds[0]).status,'demo')
  assert.equal((await receivingBank(db)).revision,saved.revision)
 })

 await t.test('Only outstanding paid-package buyers appear; free, paid, submitted and unpurchased recipients are excluded',async()=>{
  const unpurchased=await createUser(db,'unpurchased@example.test',password,'No purchase','merchant')
  let view=(await req('/admin/receiving-bank',undefined,a)).value
  assert.deepEqual(view.merchants.map(x=>x.id).sort(),[merchant.id,other.id].sort())
  assert.ok(view.merchants.every(x=>x.amount>0&&x.invoiceId&&x.packageName))
  assert.equal((await req('/admin/receiving-bank/email',email([unpurchased.id]),a)).status,400)
  assert.equal((await req('/admin/receiving-bank/email',email([merchant.id],{invoiceIds:['stale-invoice']}),a)).status,409)
  await db.prepare("UPDATE invoices SET status='submitted' WHERE id=?").run(invoice)
  assert.equal((await req('/admin/receiving-bank/email',email(),a)).status,400)
  assert.ok(!(await req('/admin/receiving-bank',undefined,a)).value.merchants.some(x=>x.id===merchant.id))
  await db.prepare("UPDATE invoices SET status='paid' WHERE id=?").run(invoice)
  assert.ok(!(await req('/admin/receiving-bank',undefined,a)).value.merchants.some(x=>x.id===merchant.id))
  await db.prepare("UPDATE invoices SET status='pending',amount=0 WHERE id=?").run(invoice)
  assert.ok(!(await req('/admin/receiving-bank',undefined,a)).value.merchants.some(x=>x.id===merchant.id))
 })

 await t.test('Validated tax IDs generate a static PromptPay tax-ID QR',async()=>{
  const prefix='123456789012',sum=[...prefix].reduce((n,d,i)=>n+Number(d)*(13-i),0),taxId=prefix+String((11-sum%11)%10)
  const r=await req('/admin/receiving-bank',{...fields,promptpayType:'taxId',promptpayId:taxId,revision:saved.revision},a);assert.equal(r.status,200)
  assert.equal(tlv(tlv(r.value.bank.payload)['29'])['02'],taxId);assert.equal(tlv(r.value.bank.payload)['01'],'11')
  assert.equal(decode((await req(r.value.bank.qrImage.replace('/api',''),undefined,m)).value),r.value.bank.payload)
 })
})

test('Receiving-bank email explicitly requires SMTP outside Demo mode',async t=>{
 const db=await openTestDatabase(),password='MissingSmtpDummy123';await createUser(db,'missing-smtp-admin@example.test',password,'Admin','admin')
 const server=createApp(db,{appUrl:'http://localhost:8443',allowedOrigins:['http://localhost:8443'],fakeHash:hashPassword('fake'),serverless:true,demoMode:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await db.close()})
 const base=`http://127.0.0.1:${server.address().port}/api`;const login=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:'http://localhost:8443','Content-Type':'application/json'},body:JSON.stringify({email:'missing-smtp-admin@example.test',password})});const value=await login.json()
 const r=await fetch(base+'/admin/receiving-bank/email',{method:'POST',headers:{Origin:'http://localhost:8443','Content-Type':'application/json',Cookie:login.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':value.csrf},body:'{}'});assert.equal(r.status,409);assert.match((await r.json()).error,/SMTP/)
})
