import test from "node:test"
import assert from "node:assert/strict"
import { openTestDatabase } from "./test-database.mjs"
import { seedDemo } from "./demo-seed.mjs"
import { createApp } from "./app.mjs"
import { hashPassword } from "./database.mjs"

test("CMS change history retains every draft and ad snapshot, paginates, restores safely and protects archived media",async t=>{
 const db=await openTestDatabase(),password="HistoryFixturePassword123",origin="http://localhost:8443"
 await seedDemo(db,{password,adminEmail:"history-admin@example.test",adminPassword:password})
 const app=createApp(db,{appUrl:origin,allowedOrigins:[origin],fakeHash:hashPassword("fixture"),serverless:true})
 await new Promise(r=>app.listen(0,"127.0.0.1",r));t.after(async()=>{await new Promise(r=>app.close(r));await db.close()})
 let cookie,csrf
 const req=async(path,data,authenticated=true)=>{const r=await fetch("http://127.0.0.1:"+app.address().port+"/api"+path,{method:data?"POST":"GET",headers:{Origin:origin,"Content-Type":"application/json",...(authenticated&&cookie?{Cookie:cookie,"X-CSRF-Token":csrf}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get("set-cookie")?.split(";")[0]}}
 const login=await req("/auth/admin-login",{email:"history-admin@example.test",password});cookie=login.cookie;csrf=login.data.csrf
 assert.equal((await req("/admin/cms/history",undefined,false)).status,401)
 const initial=(await req("/admin/cms")).data
 for(let i=1;i<=55;i++){
  const content=structuredClone(initial.draft.content);content.home.eyebrow="Saved draft "+i
  const r=await req("/admin/cms/save",{revision:initial.draft.revision+i-1,content});assert.equal(r.status,200)
 }
 const first=(await req("/admin/cms/history")).data;assert.equal(first.entries.length,50);assert(first.nextCursor)
 const second=(await req("/admin/cms/history?cursor="+encodeURIComponent(first.nextCursor))).data
 const all=[...first.entries,...second.entries];assert.equal(all.filter(e=>e.action==="save").length,55);assert.equal(new Set(all.map(e=>e.id)).size,all.length)
 assert(all.every(e=>!("snapshot" in e)&&!("content" in e)));assert.equal(second.nextCursor,null)
 assert.equal((await req("/admin/cms/history?cursor=invalid")).status,400)
 const early=all.find(e=>e.action==="save"&&e.revision===initial.draft.revision+1)
 assert(early)
 const stale=await req("/admin/cms/save",{revision:0,content:initial.draft.content});assert.equal(stale.status,409)
 assert.deepEqual((await req("/admin/cms/history")).data,first)
 const revision=initial.draft.revision+55
 assert.equal((await req("/admin/cms/publish",{revision})).status,200)
 const restored=await req("/admin/cms/restore",{revision,historyId:early.id});assert.equal(restored.status,200);assert.equal(restored.data.draft.content.home.eyebrow,"Saved draft 1");assert.equal(restored.data.draft.revision,revision+1)
 assert.equal((await req("/public/cms")).data.content.home.eyebrow,"Saved draft 55")
 assert.equal((await req("/admin/cms/history")).data.entries[0].action,"restore")
 const ad=(await req("/admin/advertisements")).data.advertisements.find(a=>a.placement==="home")
 assert(ad)
 assert.equal((await req("/admin/advertisements",{...ad,title:"First ad edit"})).status,200)
 const adHistory=(await req("/admin/cms/history")).data.entries.filter(e=>e.kind==="advertisement")
 assert.equal(adHistory.length,2);assert(adHistory.some(e=>e.action==="before_edit"))
 const saved=adHistory.find(e=>e.action==="save")
 assert.equal((await req("/admin/advertisements",{...ad,title:"Second ad edit"})).status,200)
 assert.equal((await req("/admin/advertisements",{historyId:saved.id})).status,200)
 const current=(await req("/admin/advertisements")).data.advertisements.find(a=>a.id===ad.id)
 assert.equal(current.title,"First ad edit");assert.equal(current.visible,false);assert.equal(current.approved,false)
 assert.equal((await req("/admin/cms/restore",{revision:revision+1,historyId:saved.id})).status,404)
 const media=await req("/admin/cms/media",{file:{name:"history.png",type:"image/png",data:"data:image/png;base64,"+Buffer.from("89504e470d0a1a0a00000000","hex").toString("base64")}})
 assert.equal(media.status,200)
 let state=(await req("/admin/cms")).data;state.draft.content.home.images[0]=media.data.url
 assert.equal((await req("/admin/cms/save",{revision:state.draft.revision,content:state.draft.content})).status,200)
 state=(await req("/admin/cms")).data;state.draft.content.home.images=initial.draft.content.home.images
 assert.equal((await req("/admin/cms/save",{revision:state.draft.revision,content:state.draft.content})).status,200)
 assert.equal((await req("/admin/cms/media/delete",{id:media.data.id})).status,409)
 assert((await req("/admin/cms/history")).data.entries.some(e=>e.kind==="media"&&e.action==="upload"))
})
