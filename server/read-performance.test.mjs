import test from "node:test";
import assert from "node:assert/strict";
import {openTestDatabase} from "./test-database.mjs";
import {seedDemo} from "./demo-seed.mjs";
import {trustDto,listPlans,getPlan} from "./catalog.mjs";
import {loadTrustContext,selectByIds} from "./villa-read-context.mjs";
import {createApp} from "./app.mjs";
import {hashPassword} from "./database.mjs";
function instrument(db){const queries=[];return {queries,db:{...db,prepare(sql){const statement=db.prepare(sql);return Object.fromEntries(["get","all","run"].map(method=>[method,async(...args)=>{queries.push({sql,args});return statement[method](...args);}]))}}};}
test("Batched trust reads preserve statuses with constant query count and fresh request context",async()=>{
 const db=await openTestDatabase();try{
  await seedDemo(db,{password:"PerformanceDummy123"});const rows=await db.prepare("SELECT * FROM villas ORDER BY id").all(),meter=instrument(db);
  const expected=await Promise.all(rows.map(v=>trustDto(meter.db,v)));assert.equal(meter.queries.length,rows.length*3);
  meter.queries.length=0;const context=await loadTrustContext(meter.db,rows);const result=await Promise.all(rows.map(v=>trustDto(meter.db,v,context)));assert.deepEqual(result,expected);assert.equal(meter.queries.length,3);
  const active=rows.find((v,i)=>expected[i].qrStatus==="ACTIVE");await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("villa_qr:"+active.id,"SUSPENDED");
  const fresh=await loadTrustContext(meter.db,[active]);assert.equal((await trustDto(meter.db,active,fresh)).qrStatus,"SUSPENDED");assert.equal((await trustDto(meter.db,active,context)).qrStatus,"ACTIVE");
  const plans=await listPlans(db);meter.queries.length=0;assert.deepEqual(await listPlans(meter.db),plans);assert.equal(meter.queries.length,1);assert.deepEqual(plans[0],await getPlan(db,plans[0].id));
 }finally{await db.close();}
});
test("Batch queries bound parameters, deduplicate IDs and skip empty lists",async()=>{
 const calls=[],db={prepare(sql){return {all:async(...args)=>{calls.push({sql,args});return args.map(id=>({id}));}}}};
 assert.deepEqual(await selectByIds(db,"SELECT id FROM villas WHERE id",[]),[]);assert.equal(calls.length,0);
 const ids=Array.from({length:451},(_,i)=>String(i));const rows=await selectByIds(db,"SELECT id FROM villas WHERE id",[...ids,...ids,null]);assert.equal(rows.length,451);assert.equal(calls.length,3);assert.ok(calls.every(q=>q.args.length<=200));assert.equal(calls[0].sql.match(/\?/g).length,200);
});
test("Public listing uses four reads; Member Room batches metadata and retains owner isolation",async(t)=>{
 const db=await openTestDatabase();await seedDemo(db,{password:"PerformanceDummy123"});const meter=instrument(db),config={appUrl:"http://localhost:3001",allowedOrigins:["http://localhost:3001"],fakeHash:hashPassword("fake-password"),serverless:true};const server=createApp(meter.db,config);await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});const base=`http://127.0.0.1:${server.address().port}`;
 meter.queries.length=0;const response=await fetch(base+"/api/public/villas"),publicData=await response.json();assert.equal(response.status,200);assert.equal(meter.queries.length,4);assert.ok(publicData.villas.length>5);assert.ok(publicData.villas.every(v=>!('accountNumber'in v)&&!('email'in v)));
 const limited=await fetch(base+"/api/public/villas?limit=4");assert.equal(limited.status,200);assert.deepEqual((await limited.json()).villas,publicData.villas.slice(0,4));for(const limit of ['0','101','abc','4 OR 1=1'])assert.equal((await fetch(base+'/api/public/villas?limit='+encodeURIComponent(limit))).status,400);
 const login=await fetch(base+"/api/auth/login",{method:"POST",headers:{Origin:config.appUrl,"Content-Type":"application/json"},body:JSON.stringify({email:"demo-merchant@villacheck.example",password:"PerformanceDummy123"})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];meter.queries.length=0;
 const stateResponse=await fetch(base+"/api/state",{headers:{Cookie:cookie}}),state=await stateResponse.json();assert.equal(stateResponse.status,200);assert.ok(state.villas.length>0);assert.ok(state.villas.every(v=>v.email==="demo-merchant@villacheck.example"));assert.ok(meter.queries.length<=20,`State queries: ${meter.queries.length}`);assert.equal(meter.queries.filter(q=>/SELECT name,mime FROM documents WHERE id=\?/.test(q.sql)).length,0);assert.equal(meter.queries.filter(q=>/SELECT \* FROM invoices WHERE villa_id=\?/.test(q.sql)).length,0);assert.ok(state.villas.every(v=>v.document.name&&v.reviewRequest));
});

test("Homepage advertising batches entitlements without caching visibility or suspension",async()=>{
 const {advertisingApi}=await import('./advertising.mjs');const db=await openTestDatabase();try{await seedDemo(db,{password:"PerformanceDummy123"});const meter=instrument(db);const read=()=>advertisingApi(meter.db,null,{method:"GET"},"/api/public/advertisements",new URL("http://localhost?placement=home"),()=>{});const ads=await read();assert.equal(ads.advertisements.length,3);assert.equal(meter.queries.length,4);await db.prepare("UPDATE subscriptions SET lifecycle='SUSPENDED'").run();assert.equal((await read()).advertisements.length,0);}finally{await db.close();}
});
