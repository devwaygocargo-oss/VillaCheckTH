import test from "node:test"
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {openTestDatabase} from "./test-database.mjs"
import {createApp} from "./app.mjs"
import {createUser,hashPassword} from "./database.mjs"
import {preserveApprovedVilla} from "./approval-history.mjs"

test("Phase 1 public eligibility applies before pagination; suspension closes old QR, media and financial fields",async t=>{
 const db=await openTestDatabase({launchPromotion:true});t.after(()=>db.close())
 const password="Phase1LocalOnly123",owner=await createUser(db,"p1-owner@example.test",password,"Owner"),admin=await createUser(db,"p1-admin@example.test",password,"Admin","admin")
 await db.prepare("INSERT INTO subscriptions(owner_id,package_id,created) VALUES (?,'basic','now')").run(owner.id)
 const photoId=randomUUID(),photo="/api/public/villa-photo/"+photoId,ids=[]
 await db.prepare("INSERT INTO documents VALUES (?,?,?,?,?)").run(photoId,owner.id,"villa-photo","image/jpeg",Buffer.from([255,216,255,0]))
 for(let i=0;i<3;i++){const id=randomUUID();ids.push(id);await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,created,photo_url,bank_name) VALUES (?,?,?,?,?,?,'basic',?,'approved',?,?,?,'PRIVATE BANK')").run(id,owner.id,"Public "+i,"Bangkok","Business",owner.email,photoId,"VC-phase1-"+i,"2026-10-"+(25-i),photo)}
 await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run("villa_qr:"+ids[0],"SUSPENDED")
 await preserveApprovedVilla(db,await db.prepare("SELECT * FROM villas WHERE id=?").get(ids[1]))
 const app=createApp(db,{serverless:true,paymentAccessMode:"DISABLED",allowedOrigins:["http://localhost"],appUrl:"http://localhost",fakeHash:hashPassword("placeholder")})
 await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(()=>new Promise(r=>app.close(r)))
 const base=`http://127.0.0.1:${app.address().port}/api`,get=async path=>{const r=await fetch(base+path);return {status:r.status,value:await r.json()}}
 const one=(await get("/public/villas?limit=1")).value.villas;assert.equal(one.length,1);assert.equal(one[0].id,ids[1]);assert.equal(one[0].qrStatus,"ACTIVE")
 const data=(await get("/public/qr/VC-phase1-1")).value;assert.equal(data.name,"Public 1");assert.equal(data.bankName,undefined)
 await db.prepare("UPDATE villas SET status='rejected',name='PRIVATE REJECTED DRAFT' WHERE id=?").run(ids[1])
 assert.equal((await get("/public/qr/VC-phase1-1")).value.name,"Public 1")
 assert(!(JSON.stringify((await get("/public/villas")).value)).includes("PRIVATE REJECTED DRAFT"))
 await db.prepare("UPDATE subscriptions SET lifecycle='SUSPENDED' WHERE owner_id=?").run(owner.id)
 assert.deepEqual((await get("/public/villas")).value.villas,[])
 const blocked=(await get("/public/qr/VC-phase1-1")).value;assert.equal(blocked.valid,false);assert.equal(blocked.name,undefined);assert.equal(blocked.photoUrl,undefined)
 assert.equal((await fetch(base.replace(/\/api$/,"")+photo)).status,404)
 assert.equal((await get("/public/property-media?qr=VC-phase1-1")).status,404)
 await db.prepare("UPDATE subscriptions SET lifecycle='ACTIVE' WHERE owner_id=?").run(owner.id)
 await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run("account_status:"+owner.id,JSON.stringify({status:"suspended"}))
 assert.deepEqual((await get("/public/villas")).value.villas,[])
 assert.equal((await get("/public/qr/VC-phase1-1")).value.valid,false)
 const login=await fetch(base+"/auth/admin-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:admin.email,password})});assert.equal(login.status,200)
 const cookie=login.headers.get("set-cookie").split(";")[0]
 assert.equal((await fetch(base.replace(/\/api$/,"")+photo,{headers:{cookie}})).status,200)
})

test("Owner media removal is private, replay-safe and publishes only after Admin approval without deleting history",async t=>{
 const db=await openTestDatabase();t.after(()=>db.close());const password="RemoveMediaLocal123"
 const owner=await createUser(db,"remove-owner@example.test",password,"Owner"),other=await createUser(db,"remove-other@example.test",password,"Other"),admin=await createUser(db,"remove-admin@example.test",password,"Admin","admin"),id=randomUUID(),mediaId=randomUUID()
 await db.prepare("INSERT INTO subscriptions(owner_id,package_id,created) VALUES (?,'basic','now')").run(owner.id)
 await db.prepare("INSERT INTO documents VALUES (?,?,?,?,?)").run(mediaId,owner.id,"property-media","image/jpeg",Buffer.from([255,216,255,0]))
 await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,created) VALUES (?,?,'Media Villa','Bangkok','Owner',?,'basic',?,'approved','VC-remove-media','now')").run(id,owner.id,owner.email,mediaId)
 const file="/api/public/property-media-file/"+mediaId,key="property_media:"+id+":"+mediaId
 await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run(key,JSON.stringify({id:mediaId,villaId:id,name:"approved.jpg",kind:"image",url:file,reviewedAt:"2026-10-24"}))
 const app=createApp(db,{serverless:true,paymentAccessMode:"DISABLED",allowedOrigins:["http://localhost"],appUrl:"http://localhost",fakeHash:hashPassword("placeholder")});await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(()=>new Promise(r=>app.close(r)))
 const root=`http://127.0.0.1:${app.address().port}`,request=async(path,data,s)=>{const r=await fetch(root+"/api"+path,{method:data?"POST":"GET",headers:{"Content-Type":"application/json",...(s?{cookie:s.cookie,"X-CSRF-Token":s.csrf}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,value:await r.json(),cookie:r.headers.get("set-cookie")?.split(";")[0]}}
 const login=async u=>{const r=await request(u.role==="admin"?"/auth/admin-login":"/auth/login",{email:u.email,password});return {cookie:r.cookie,csrf:r.value.csrf}}
 const m=await login(owner),o=await login(other),a=await login(admin),input={villaId:id,mediaId,action:"remove"}
 assert.equal((await request("/merchant/property-media",input,o)).status,404)
 assert.equal((await request("/merchant/property-media",input,m)).status,200)
 assert.equal((await request("/merchant/property-media",input,m)).status,200)
 assert.equal((await request("/merchant/property-media?villaId="+id,undefined,m)).value.media.length,0)
 assert.equal((await request("/public/property-media?qr=VC-remove-media")).value.media.length,1)
 assert.equal((await fetch(root+file)).status,200)
 assert.equal((await request(`/villas/${id}/review`,{status:"approved"},a)).status,200)
 assert.equal((await request("/public/property-media?qr=VC-remove-media")).value.media.length,0)
 assert.equal((await fetch(root+file)).status,404)
 assert(await db.prepare("SELECT id FROM documents WHERE id=?").get(mediaId))
 assert.equal((await db.prepare("SELECT count(*) AS n FROM audits WHERE action='media.remove_requested' AND target_id=?").get(mediaId)).n,1)
 assert.equal((await db.prepare("SELECT count(*) AS n FROM invoices").get()).n,0)
})
