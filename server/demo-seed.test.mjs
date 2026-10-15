import test from 'node:test';import assert from 'node:assert/strict';
import {openTestDatabase} from './test-database.mjs';import{seedDemo}from'./demo-seed.mjs';import{trustDto}from'./catalog.mjs';
test('dummy seed is idempotent, private documents follow ownership and expired QR stays stable',async()=>{
 const db=await openTestDatabase();try{
  await seedDemo(db,{password:'DemoTestPassword123'});const first=await db.prepare('SELECT id,qr FROM villas ORDER BY id').all();
  await seedDemo(db,{password:'DemoTestPassword123'});assert.equal(first.length,14);assert.equal((await db.prepare("SELECT count(*) AS n FROM villas WHERE photo_url LIKE '/demo/villas/%'").get()).n,14);assert.deepEqual(await db.prepare('SELECT id,qr FROM villas ORDER BY id').all(),first);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM villas WHERE status='approved'").get()).n,10);
  const owners=await db.prepare('SELECT owner_id,count(*) AS n FROM villas GROUP BY owner_id').all();assert.ok(owners.every(x=>x.n<=10));
  const expired=await db.prepare("SELECT * FROM villas WHERE name='Expired Demo Villa'").get();assert.equal((await trustDto(db,expired)).qrStatus,'EXPIRED');
  assert.equal((await db.prepare('SELECT owner_id FROM documents WHERE id=?').get(expired.document_id)).owner_id,expired.owner_id);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM mails').get()).n,0);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM invoices').get()).n,0);
 }finally{await db.close();}
});

test('dummy relationships agree across owners, documents, reports and check outcomes and preserve edited data',async()=>{
 const db=await openTestDatabase();try{
  await seedDemo(db,{password:'DemoTestPassword123'})
  const villas=await db.prepare('SELECT * FROM villas').all()
  for(const villa of villas){
   const owner=await db.prepare('SELECT * FROM users WHERE id=?').get(villa.owner_id)
   assert.equal(owner.role,'merchant');assert.equal(villa.email,owner.email);assert.equal(villa.merchant,owner.business_name);assert.ok(owner.phone);assert.ok(owner.address)
   const doc=await db.prepare('SELECT * FROM documents WHERE id=?').get(villa.document_id);assert.equal(doc.owner_id,owner.id);const text=Buffer.from(doc.bytes).toString();assert.ok(text.includes(villa.id));assert.ok(text.includes(owner.email));assert.match(text,/dummy document - NOT legal evidence/)
   if(villa.status==='pending')assert.equal(villa.verification_level,'REGISTERED')
   if(villa.status==='changes')assert.match(villa.reason,/DUMMY/)
  }
  const checks=await db.prepare('SELECT * FROM user_checks').all()
  for(const check of checks){const villa=villas.find(v=>v.id===check.villa_id);assert.equal(check.villa_name,villa.name);assert.equal(check.qr,villa.qr);assert.equal(check.status==='MATCHED',check.submitted_account===villa.account_number);assert.equal(check.submitted_contact,villa.phone)}
  for(const report of await db.prepare('SELECT * FROM support_reports').all()){
   const user=await db.prepare('SELECT * FROM users WHERE id=?').get(report.user_id);assert.equal(user.role,'user');assert.equal(report.reporter,user.name);assert.equal(report.contact,user.email);assert.equal(report.villa_name,villas.find(v=>v.id===report.villa_id).name)
  }
  const edited=villas.find(v=>v.name==='Sea Sky Demo Villa'),document=await db.prepare('SELECT bytes FROM documents WHERE id=?').get(edited.document_id)
  await db.prepare('UPDATE villas SET name=?,guest_capacity=NULL,reason=? WHERE id=?').run('Edited Dummy Villa','Real Admin review result',edited.id)
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('villa_review:'+edited.id,JSON.stringify({kind:'information_update',changes:[]}))
  const owner=await db.prepare('SELECT * FROM users WHERE id=?').get(edited.owner_id);await db.prepare('UPDATE users SET business_name=? WHERE id=?').run('Edited Dummy Company',owner.id)
  await seedDemo(db,{password:'DemoTestPassword123'})
  const saved=await db.prepare('SELECT * FROM villas WHERE id=?').get(edited.id);assert.equal(saved.name,'Edited Dummy Villa');assert.equal(saved.guest_capacity,null);assert.equal(saved.reason,'Real Admin review result');assert.equal((await db.prepare('SELECT business_name FROM users WHERE id=?').get(owner.id)).business_name,'Edited Dummy Company');assert.deepEqual((await db.prepare('SELECT bytes FROM documents WHERE id=?').get(edited.document_id)).bytes,document.bytes)
  assert.equal((await db.prepare("SELECT count(*) AS n FROM mails").get()).n,0)
 }finally{await db.close()}
})
