import test from 'node:test';import assert from 'node:assert/strict';
import {openTestDatabase} from './test-database.mjs';import {seedDemo} from './demo-seed.mjs';import {seedDemoOwnerVerification} from './demo-owner-verification.mjs';import {publicOwnerVerification,ownerVerificationApi} from './owner-verification.mjs';
test('paid demo tiers receive labelled successful owner verification; Basic and existing decisions stay intact',async t=>{
 const db=await openTestDatabase();t.after(()=>db.close());await seedDemo(db,{password:'OwnerDummyFixture1234'});
 const targets=await db.prepare("SELECT * FROM villas WHERE status='approved' ORDER BY id LIMIT 4").all();for(const [index,plan] of ['basic','starter','pro','premium'].entries())await db.prepare('UPDATE villas SET package_id=?,payments=1,expires=? WHERE id=?').run(plan,new Date(Date.now()+30*86400000).toISOString(),targets[index].id);
 const result=await seedDemoOwnerVerification(db);for(const tier of ['starter','pro','premium'])assert(result[tier]>=1);
 for(const [index,plan] of ['basic','starter','pro','premium'].entries()){
  const villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(targets[index].id);const record=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('owner_verification:'+villa.id);
  if(plan==='basic'){assert.equal(record,undefined);assert.equal(await publicOwnerVerification(db,villa),null);continue;}
  const row=JSON.parse(record.value);assert.equal(row.status,'accepted');assert.equal(row.demo,true);assert.equal(row.reviewedBy,null);assert.deepEqual(row.checks,{faceMatched:true,houseMatched:true,ownerConfirmed:true});
  for(const slot of ['face','house']){const doc=await db.prepare('SELECT * FROM documents WHERE id=?').get(row.files[slot].id);assert.equal(doc.owner_id,villa.owner_id);assert(doc.name.includes('DUMMY'));assert(doc.bytes.length>0);}
  const publicValue=await publicOwnerVerification(db,villa);assert(publicValue.method.includes('DUMMY'));assert(!JSON.stringify(publicValue).includes('/api/documents/'));assert.equal(publicValue.status,'accepted');
  const merchant=await ownerVerificationApi(db,{id:villa.owner_id,role:'merchant'},{method:'GET'},'/api/merchant/owner-verification',new URL('http://localhost'),()=>{});assert(merchant.submissions.some(s=>s.villaId===villa.id&&s.status==='accepted'));
 }
 const row=JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('owner_verification:'+targets[1].id)).value);row.status='changes';row.reason='Admin requests real replacement';await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(row),'owner_verification:'+row.villaId);
 assert.deepEqual(await seedDemoOwnerVerification(db),{starter:0,pro:0,premium:0});assert.equal(JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('owner_verification:'+row.villaId)).value).reason,row.reason);
 await db.prepare("UPDATE villas SET expires='2000-01-01T00:00:00.000Z' WHERE id=?").run(targets[2].id);assert.equal(await publicOwnerVerification(db,await db.prepare('SELECT * FROM villas WHERE id=?').get(targets[2].id)),null);
});
