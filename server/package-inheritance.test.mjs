import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDatabase} from './test-database.mjs';
import {seedCatalog,getPlan,listPlans} from './catalog.mjs';
import {packageContent,premiumGuaranteeFeature} from './package-content.mjs';
test('all four package tiers inherit lower features even with legacy catalog wording and inactive lower tiers',async()=>{
 const db=await openTestDatabase();try{
 await seedCatalog(db);
 await db.prepare("UPDATE package_catalog SET features=? WHERE id='basic'").run(JSON.stringify(['QR ประจำที่พัก','ตรวจเอกสารเบื้องต้น']));
 await db.prepare("UPDATE package_catalog SET features=? WHERE id='starter'").run(JSON.stringify(['รูปภาพและวิดีโอ','ตรวจสอบออนไลน์']));
 await db.prepare("UPDATE package_catalog SET features=? WHERE id='pro'").run(JSON.stringify(['ภาพเดี่ยว 1 โพสต์ต่อเดือน']));
 await db.prepare("UPDATE package_catalog SET features=? WHERE id='premium'").run(JSON.stringify(['สิทธิ์ทั้งหมดของ Social Verify']));
 const ids=['basic','starter','pro','premium'],plans=await listPlans(db,true);
 for(let i=0;i<ids.length;i++){const plan=plans.find(p=>p.id===ids[i]);assert.deepEqual((await getPlan(db,ids[i])).features,plan.features);for(let j=0;j<=i;j++)for(const feature of packageContent[ids[j]].features)assert(plan.features.includes(feature),ids[i]+' missing '+feature);if(i>0)for(const feature of plans.find(p=>p.id===ids[i-1]).features)assert(plan.features.includes(feature));if(i<3)assert(!plan.features.includes(premiumGuaranteeFeature));assert.equal(new Set(plan.features).size,plan.features.length);}
 await db.prepare("UPDATE package_catalog SET active=0 WHERE id='starter'").run();const publicPlans=await listPlans(db);assert(!publicPlans.some(p=>p.id==='starter'));assert(publicPlans.find(p=>p.id==='premium').features.includes('ตรวจสอบออนไลน์'));
 }finally{await db.close()}
});

test('Social Verify normalizes legacy video promotion to a single image post; Premium retains video',async()=>{
 const db=await openTestDatabase();try{
 await seedCatalog(db);await db.prepare("DELETE FROM system_settings WHERE key='social_single_post_v1'").run();
 await db.prepare("UPDATE package_catalog SET features=?,description=? WHERE id='pro'").run(JSON.stringify(['วิดีโอ 1 ชิ้นต่อเดือนบนทุก Social ของ VillaCheck','video 1 post','อัปโหลดวิดีโอ','ภาพเดี่ยว 1 โพสต์ต่อเดือนบนทุก Social ของ VillaCheck']),'วิดีโอ 1 ชิ้นต่อเดือน');
 const validate=async()=>{const pro=await getPlan(db,'pro'),premium=await getPlan(db,'premium');assert(pro.description.includes('Single Post'));assert(pro.features.includes('ภาพเดี่ยว (Single Post) 1 โพสต์ต่อเดือนบนทุก Social ของ VillaCheck'));assert(pro.features.includes('อัปโหลดวิดีโอ'));assert(!pro.features.some(f=>/วิดีโอ 1|video 1/.test(f)));assert(premium.features.includes('วิดีโอ 1 ชิ้นต่อเดือนบนทุก Social ของ VillaCheck'));};
 await validate();await seedCatalog(db);await validate();const stored=await db.prepare("SELECT features FROM package_catalog WHERE id='pro'").get();assert(!stored.features.includes('video 1'));assert(!stored.features.includes('วิดีโอ 1 ชิ้น'));
 }finally{await db.close()}
});
