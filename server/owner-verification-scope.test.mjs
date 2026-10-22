import test from 'node:test'
import assert from 'node:assert/strict'
import {openTestDatabase} from './test-database.mjs'
import {seedDemo} from './demo-seed.mjs'
import {seedDemoOwnerVerification} from './demo-owner-verification.mjs'
import {ownerVerificationApi} from './owner-verification.mjs'
test('Villa-specific owner verification shows accepted proofs only for the chosen villa and retains merchant privacy',async()=>{
 const db=await openTestDatabase();try{
 await seedDemo(db,{password:'OwnerScopeFixture123',adminEmail:'scope@example.test',adminPassword:'OwnerScopeFixture123'});await seedDemoOwnerVerification(db)
 const v=await db.prepare("SELECT * FROM villas WHERE id IN (SELECT SUBSTR(key,20) FROM system_settings WHERE key LIKE 'owner_verification:%') LIMIT 1").get()
 assert(v)
 const get=(user,id)=>ownerVerificationApi(db,user,{method:'GET'},user?.role==='admin'?'/api/admin/owner-verification':'/api/merchant/owner-verification',new URL('http://localhost?villaId='+id),()=>{})
 const result=await get({role:'admin'},v.id);assert.equal(result.villas.length,1);assert.equal(result.submissions.length,1);assert.equal(result.submissions[0].villaId,v.id);assert.equal(result.submissions[0].status,'accepted');assert(result.submissions[0].files.face.url);assert(result.submissions[0].files.house.url)
 const other=await db.prepare("SELECT * FROM users WHERE role='merchant' AND id<>? LIMIT 1").get(v.owner_id);assert.deepEqual((await get(other,v.id)).submissions,[]);assert.deepEqual((await get(other,v.id)).villas,[])
 const basic=await db.prepare("SELECT id FROM villas WHERE package_id='basic' LIMIT 1").get();assert.deepEqual((await get({role:'admin'},basic.id)).submissions,[])
 }finally{await db.close()}
})
