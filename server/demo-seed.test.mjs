import {readFileSync,existsSync} from 'node:fs';
import test from 'node:test';import assert from 'node:assert/strict';
import {openTestDatabase} from './test-database.mjs';import{seedDemo}from'./demo-seed.mjs';import{trustDto}from'./catalog.mjs';
test('dummy seed is idempotent, private documents follow ownership and expired QR stays stable',async()=>{
 const db=await openTestDatabase();try{
  await seedDemo(db,{password:'DemoTestPassword123'});const first=await db.prepare('SELECT id,qr FROM villas ORDER BY id').all();
  await seedDemo(db,{password:'DemoTestPassword123'});assert.equal(first.length,17);assert.equal((await db.prepare("SELECT count(*) AS n FROM villas WHERE photo_url LIKE '/demo/villas/%'").get()).n,17);assert.deepEqual(await db.prepare('SELECT id,qr FROM villas ORDER BY id').all(),first);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM villas WHERE status='approved'").get()).n,13);
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

 test('all ten provinces displayed on the website have active linked dummy Villas and existing photos',async()=>{
 const db=await openTestDatabase();try{
  await seedDemo(db,{password:'DemoTestPassword123'})
  const source=readFileSync('src/ProvinceExplorer.tsx','utf8'),provinces=JSON.parse(source.match(/popularProvinces = (\[[^;]+\]);/)[1]);assert.equal(provinces.length,10)
  const villas=await db.prepare('SELECT * FROM villas').all(),active=[]
  for(const villa of villas){assert.ok(existsSync('public'+villa.photo_url));if((await trustDto(db,villa)).qrStatus==='ACTIVE')active.push(villa)}
  for(const province of provinces)assert.ok(active.some(v=>v.province===province),'Missing active dummy Villa in '+province)
  const regional=await db.prepare("SELECT u.id,s.expires FROM users u JOIN subscriptions s ON s.owner_id=u.id WHERE u.email='demo-regional@villacheck.example'").get()
  for(const name of ['Bangkok Garden Demo Villa','Samui Island Demo Villa']){const villa=villas.find(v=>v.name===name);assert.equal(villa.owner_id,regional.id);assert.equal(villa.expires,regional.expires)}
 }finally{await db.close()}
 })

test('Premium demo carousel uses eligible ad records, retains admin edits and removes expired ads',async()=>{
 const {advertisingApi}=await import('./advertising.mjs');
 const db=await openTestDatabase();try{
  await seedDemo(db,{password:'DemoTestPassword123'});
  const getAds=()=>advertisingApi(db,null,{method:'GET'},'/api/public/advertisements',new URL('http://localhost?placement=home'),()=>{});
  const {cmsUrl}=await import('./cms.mjs');assert.equal(cmsUrl('/demo/villas/villa-1.jpg',true),'/demo/villas/villa-1.jpg');assert.throws(()=>cmsUrl('/demo/villas/../secret',true));
  const {advertisements}=await getAds();assert.equal(advertisements.length,8);assert.ok(advertisements.every(a=>a.demo&&a.sponsored&&a.href.startsWith('#page=verify&item=VC-DEMO-')));
  assert.equal(new Set(advertisements.map(a=>a.id)).size,8);assert.equal(new Set(advertisements.map(a=>a.title)).size,8);for(const ad of advertisements)assert.ok(existsSync('public'+ad.image));
  const key='advertisement:'+advertisements[0].id,row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key),ad=JSON.parse(row.value);ad.title='Admin edited';ad.visible=false;await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(ad),key);
  await seedDemo(db,{password:'DemoTestPassword123'});assert.equal(JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key)).value).title,'Admin edited');assert.equal((await getAds()).advertisements.length,7);
  const other=(await getAds()).advertisements[0];const stored=JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('advertisement:'+other.id)).value);await db.prepare("UPDATE villas SET expires='2000-01-01T00:00:00.000Z' WHERE id=?").run(stored.villaId);assert.equal((await getAds()).advertisements.length,6);
 }finally{await db.close();}
});

test('Eight carousel examples use existing paid Premium fixtures when legacy dummy Villas have lower plans',async()=>{
 const {advertisingApi}=await import('./advertising.mjs'),db=await openTestDatabase();try{
  await seedDemo(db,{password:'DemoTestPassword123'});
  await db.prepare("DELETE FROM system_settings WHERE key LIKE 'advertisement:%'").run();
  for(const [before,after] of [['Sea Sky Demo Villa','Chiang Mai Pool Villa Online Dummy'],['Khao Yai Forest Demo Villa','Khao Yai Pool Villa Online Dummy 3'],['Phuket Demo Villa','Krabi Pool Villa Online Dummy 4'],['Cha Am Garden Demo Villa','Phang Nga Pool Villa Online Dummy 5']])await db.prepare('UPDATE villas SET name=? WHERE name=?').run(after,before);
  const legacy=['Chiang Mai Demo Villa','Krabi Cliff Demo Villa','Rayong Ocean Demo Villa','Phang Nga Lagoon Demo Villa','Bangkok Garden Demo Villa'];
  for(const name of legacy)await db.prepare("UPDATE villas SET package_id='starter' WHERE name=?").run(name);
  await seedDemo(db,{password:'DemoTestPassword123'});
  const {advertisements}=await advertisingApi(db,null,{method:'GET'},'/api/public/advertisements',new URL('http://localhost?placement=home'),()=>{});
  assert.equal(advertisements.length,8);assert.equal(new Set(advertisements.map(a=>a.id)).size,8);
  for(const name of legacy)assert.equal((await db.prepare('SELECT package_id FROM villas WHERE name=?').get(name)).package_id,'starter');
 }finally{await db.close();}
});
