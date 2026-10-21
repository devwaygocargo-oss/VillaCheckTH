import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openTestDatabase} from './test-database.mjs';
import {seedDemo} from './demo-seed.mjs';
import {advertisingApi,advertisingEntitlement} from './advertising.mjs';
import {getPlan,seedCatalog} from './catalog.mjs';
import {footerAdFeature} from './package-content.mjs';
test('Footer advertising supports paid Pro and Premium, one simultaneous creative, preserved dummy edits and expiry',async()=>{
 const db=await openTestDatabase();try{
  await seedDemo(db,{password:'FooterDummyPassword123',adminEmail:'footer-admin@example.test',adminPassword:'FooterDummyPassword123'});
  const admin=await db.prepare('SELECT * FROM users WHERE email=?').get('footer-admin@example.test'),villa=await db.prepare("SELECT * FROM villas WHERE name='Hua Hin Footer Ad Demo Villa'").get();
  await db.prepare("UPDATE villas SET package_id='basic' WHERE id=?").run(villa.id);assert.equal(await advertisingEntitlement(db,villa.id,'footer'),false);
  await db.prepare("UPDATE villas SET package_id='premium' WHERE id=?").run(villa.id);assert.equal(await advertisingEntitlement(db,villa.id,'footer'),true);
  await db.prepare("UPDATE villas SET package_id='pro' WHERE id=?").run(villa.id);assert.equal(await advertisingEntitlement(db,villa.id,'footer'),true);assert.equal(await advertisingEntitlement(db,villa.id,'home'),false);
  await seedDemo(db,{password:'FooterDummyPassword123'});
  const read=()=>advertisingApi(db,null,{method:'GET'},'/api/public/advertisements',new URL('http://localhost?placement=footer'),()=>{});
  const ads=(await read()).advertisements;assert.equal(ads.length,4);assert.equal(new Set(ads.map(a=>a.id)).size,4);for(const ad of ads){const saved=JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('advertisement:'+ad.id)).value);assert.equal((await db.prepare('SELECT package_id FROM villas WHERE id=?').get(saved.villaId)).package_id,'pro');}assert.equal(ads[0].demo,true);assert.ok(ads[0].href.includes(villa.qr));
  const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('advertisement:'+ads[0].id),fixture=JSON.parse(row.value);
  const save=ad=>advertisingApi(db,admin,{method:'POST'},'/api/admin/advertisements',new URL('http://localhost'),async()=>ad);
  await assert.rejects(save({...fixture,id:randomUUID()}),e=>e.status===409);
  await save({...fixture,visible:false,title:'Admin edited footer'});await db.prepare('UPDATE villas SET name=? WHERE id=?').run('Renamed Pro Dummy',villa.id);await seedDemo(db,{password:'FooterDummyPassword123'});assert.equal((await read()).advertisements.length,3);assert.equal(JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('advertisement:'+fixture.id)).value).title,'Admin edited footer');
  const outcomes=await Promise.allSettled([save({...fixture,id:randomUUID()}),save({...fixture,id:randomUUID()})]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.find(r=>r.status==='rejected').reason.status,409);assert.equal((await read()).advertisements.length,4);
  await db.prepare("UPDATE villas SET expires='2000-01-01' WHERE id=?").run(villa.id);assert.equal((await read()).advertisements.length,3);
  for(const id of ['pro','premium'])assert.ok((await getPlan(db,id)).features.includes(footerAdFeature));
 }finally{await db.close();}
});
test('Footer package feature migration appends once and preserves other catalog content',async()=>{
 const db=await openTestDatabase();try{await seedCatalog(db);await db.prepare("UPDATE package_catalog SET features=? WHERE id='pro'").run(JSON.stringify(['Custom service']));await db.prepare("DELETE FROM system_settings WHERE key='package_footer_ad_v1'").run();await seedCatalog(db);assert.deepEqual((await getPlan(db,'pro')).features,['Custom service',footerAdFeature]);await db.prepare("UPDATE package_catalog SET features=? WHERE id='pro'").run(JSON.stringify(['Edited after migration']));await seedCatalog(db);assert.deepEqual((await getPlan(db,'pro')).features,['Edited after migration']);}finally{await db.close();}
});
