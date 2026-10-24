import test from "node:test"
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {openTestDatabase} from "./test-database.mjs"
import {createUser,hashPassword} from "./database.mjs"
import {createApp} from "./app.mjs"

test("pending cover bytes are private across roles and become public only after approval",async t=>{
 const db=await openTestDatabase(),password="Phase2Password123"
 const owner=await createUser(db,"cover-owner@example.test",password,"Owner")
 await createUser(db,"cover-other@example.test",password,"Other")
 await createUser(db,"cover-admin@example.test",password,"Admin","admin")
 const id=randomUUID(),villaId=randomUUID(),path="/api/public/villa-photo/"+id,bytes=Buffer.from([255,216,255,0])
 await db.prepare("INSERT INTO documents VALUES (?,?,?,?,?)").run(id,owner.id,"villa-photo","image/jpeg",bytes)
 await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,created,photo_url) VALUES (?,?,'Cover','Bangkok','Owner',?,'basic',?,'pending','now',?)").run(villaId,owner.id,owner.email,id,path)
 const app=createApp(db,{serverless:true,allowedOrigins:["http://localhost"],fakeHash:hashPassword("placeholder")})
 await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(async()=>{await new Promise(r=>app.close(r));await db.close()})
 const base=`http://127.0.0.1:${app.address().port}`
 const login=async(email,admin=false)=>{const r=await fetch(base+"/api/auth/"+(admin?"admin-login":"login"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});assert.equal(r.status,200);return r.headers.get("set-cookie").split(";")[0]}
 const own=await login(owner.email),other=await login("cover-other@example.test"),admin=await login("cover-admin@example.test",true)
 for(const cookie of ["",other])assert.equal((await fetch(base+path,{headers:{cookie}})).status,404)
 for(const cookie of [own,admin]){const r=await fetch(base+path,{headers:{cookie}});assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"private, no-store");assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes)}
 await db.prepare("UPDATE villas SET status='approved',qr='VC-cover-fixture' WHERE id=?").run(villaId)
 assert.equal((await fetch(base+path)).status,200)
 await db.prepare("UPDATE villas SET status='rejected' WHERE id=?").run(villaId)
 assert.equal((await fetch(base+path)).status,404)
})
test("Nest/standalone callers cannot reset auth quota by forging proxy headers",async t=>{
 const db=await openTestDatabase(),app=createApp(db,{serverless:true,allowedOrigins:["http://localhost"],fakeHash:hashPassword("placeholder")})
 await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(async()=>{await new Promise(r=>app.close(r));await db.close()})
 const url=`http://127.0.0.1:${app.address().port}/api/auth/login`
 for(let i=0;i<31;i++){
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","X-Forwarded-For":`192.0.2.${i}`,"X-Vercel-Forwarded-For":`198.51.100.${i}`},body:JSON.stringify({email:"missing@example.test",password:"wrong"})})
  assert.equal(r.status,i<30?401:429)
 }
})
