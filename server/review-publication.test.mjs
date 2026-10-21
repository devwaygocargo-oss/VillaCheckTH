import test from 'node:test'
import assert from 'node:assert/strict'
import { openTestDatabase } from './test-database.mjs'
import { seedDemo } from './demo-seed.mjs'
import { createUser } from './database.mjs'
import { reviewsApi } from './reviews.mjs'

test('review publication follows each property package at submission, independent of rating', async t => {
 const db=await openTestDatabase()
 try {
  await seedDemo(db,{password:'DummyReviewPassword123',adminEmail:'review-policy-admin@example.test',adminPassword:'DummyReviewPassword123'})
  const admin=await db.prepare("SELECT * FROM users WHERE email=?").get('review-policy-admin@example.test')
  const merchant=await db.prepare("SELECT * FROM users WHERE role='merchant' LIMIT 1").get()
  const villa=await db.prepare("SELECT * FROM villas WHERE status='approved' AND qr IS NOT NULL LIMIT 1").get()
  const call=(path,user=null,data,method=data===undefined?'GET':'POST')=>reviewsApi(db,user,{method},new URL('http://test/api'+path).pathname,new URL('http://test/api'+path),async()=>data)
  for(const packageId of ['basic','starter','pro','premium'])for(const rating of [1,5])await t.test(`${packageId} ${rating} stars`,async()=>{
   await db.prepare('UPDATE villas SET package_id=? WHERE id=?').run(packageId,villa.id)
   const user=await createUser(db,`${packageId}-${rating}@review.example.test`,'DummyReviewPassword123','Reviewer','user')
   const expected=['pro','premium'].includes(packageId)
   assert.equal((await call('/public/reviews?qr='+villa.qr)).moderationRequired,expected)
   const {review}=await call('/reviews',user,{qr:villa.qr,rating,content:'ประสบการณ์เข้าพัก '+packageId+' '+rating,status:'published',moderationRequired:false})
   assert.equal(review.status,expected?'pending':'published')
   assert.equal(review.moderationRequired,expected)
   assert.equal(review.packageId,packageId)
   assert.equal(Boolean(review.publishedAt),!expected)
   const visible=async()=> (await call('/public/reviews?qr='+villa.qr)).reviews.find(r=>r.id===review.id)
   assert.equal(Boolean(await visible()),!expected)
   assert.equal((await call('/reviews',user)).reviews[0].status,review.status)
   await assert.rejects(call(`/admin/reviews/${review.id}/moderate`,merchant,{status:'published'}),{status:403})
   await assert.rejects(call('/reviews',user,{qr:villa.qr,rating,content:'Duplicate'}),{status:409})
   if(expected){
    await db.prepare("UPDATE villas SET package_id='basic' WHERE id=?").run(villa.id)
    assert.equal(await visible(),undefined,'Downgrade must not expose pending review')
    const approved=await call(`/admin/reviews/${review.id}/moderate`,admin,{status:'published'})
    assert.equal(approved.review.reviewedBy,admin.id)
    assert.ok((await visible()).publishedAt)
   }
   await assert.rejects(call(`/admin/reviews/${review.id}/moderate`,admin,{status:'rejected',reasonCode:'low_score',reason:'คะแนนต่ำ'}),{status:400})
   await call(`/admin/reviews/${review.id}/moderate`,admin,{status:'more_info',reasonCode:'insufficient_evidence',reason:'กรุณาแนบข้อมูลเพิ่มเติม'})
   assert.equal(await visible(),undefined)
   const appealed=await call(`/reviews/${review.id}/appeal`,user,{detail:'ข้อมูลประกอบเพิ่มเติม'})
   assert.equal(appealed.review.status,'pending')
   assert.equal(await visible(),undefined,'Appeals always return to Admin review')
  })
  assert.equal((await call('/admin/reviews',admin)).reviews.length,8)
 }finally{await db.close()}
})
