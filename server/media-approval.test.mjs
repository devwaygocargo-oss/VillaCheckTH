import {ownerVerificationApi} from "./owner-verification.mjs"
import test from "node:test"
import assert from "node:assert/strict"
import {openTestDatabase} from "./test-database.mjs"
import {seedDemo} from "./demo-seed.mjs"
import {propertyMediaApi,propertyMediaFile} from "./property-media.mjs"

test("unreviewed media is private; explicit Admin approval rotates QR once and preserves paid rights",async t=>{
 const db=await openTestDatabase();t.after(()=>db.close())
 await seedDemo(db,{password:"MediaApproval123",adminEmail:"media-admin@example.test",adminPassword:"MediaApproval123"})
 const villa=await db.prepare("SELECT * FROM villas WHERE name='Sea Sky Demo Villa'").get(),owner=await db.prepare("SELECT * FROM users WHERE id=?").get(villa.owner_id),admin=await db.prepare("SELECT * FROM users WHERE email='media-admin@example.test'").get()
 const existing=await db.prepare("SELECT value FROM system_settings WHERE key=?").get("owner_verification:"+villa.id)
 const revision=existing?JSON.parse(existing.value).revision:0
 await assert.rejects(ownerVerificationApi(db,owner,{method:"POST"},"/api/merchant/owner-verification",new URL("http://test"),async()=>({villaId:villa.id,expectedRevision:revision,action:"upload",slot:"face",file:{name:"cms-image:forged",type:"image/png",data:"data:image/png;base64,iVBORw0KGgo="}})),{status:400})
 const call=(user,path,data)=>propertyMediaApi(db,user,{method:data?"POST":"GET"},path,new URL("http://test?qr="+villa.qr),async()=>data)
 const uploaded=await call(owner,"/api/merchant/property-media",{villaId:villa.id,file:{name:"pending.png",type:"image/png",data:"data:image/png;base64,iVBORw0KGgo="}})
 assert(!(await call(null,"/api/public/property-media")).media.some(m=>m.id===uploaded.media.id))
 await assert.rejects(propertyMediaFile(db,uploaded.media.id,null),{status:404})
 assert.equal((await propertyMediaFile(db,uploaded.media.id,owner)).mime,"image/png")
 await assert.rejects(call(owner,"/api/admin/property-media",{villaId:villa.id,mediaId:uploaded.media.id}),{status:403})
 const reviewed=await call(admin,"/api/admin/property-media",{villaId:villa.id,mediaId:uploaded.media.id})
 assert.notEqual(reviewed.qr,villa.qr)
 await assert.rejects(call(admin,"/api/admin/property-media",{villaId:villa.id,mediaId:uploaded.media.id}),{status:409})
 assert.equal((await propertyMediaFile(db,uploaded.media.id,null)).mime,"image/png")
 const after=await db.prepare("SELECT * FROM villas WHERE id=?").get(villa.id)
 for(const key of ["package_id","expires","payments","status"])assert.equal(after[key],villa[key])
 const publicData=await propertyMediaApi(db,null,{method:"GET"},"/api/public/property-media",new URL("http://test?qr="+after.qr))
 assert(publicData.media.some(m=>m.id===uploaded.media.id));assert(publicData.media.every(m=>m.reviewedBy===undefined))
 const snapshot=JSON.parse((await db.prepare("SELECT value FROM system_settings WHERE key=?").get("villa_approved:"+villa.id)).value)
 assert.equal(snapshot.villa.qr,after.qr);assert(snapshot.media.some(m=>m.id===uploaded.media.id))
 const notice=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'owner_notification:%'").all();assert(notice.some(row=>JSON.parse(row.value).result==="MEDIA_APPROVED"))
})
