import test from "node:test"
import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {createServer} from "node:http"
import {existsSync} from "node:fs"
import {openTestDatabase} from "./test-database.mjs"
import {seedDemo} from "./demo-seed.mjs"
test("Next production serves React and routes API through NestJS/Prisma",{skip:!process.env.TEST_DATABASE_URL || !existsSync('.next/BUILD_ID'),timeout:45000},async t=>{
 const db=await openTestDatabase();await seedDemo(db,{password:"NextMaterialsPassword123"});const reservation=createServer();await new Promise(r=>reservation.listen(0,"127.0.0.1",r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--port",String(port),"--hostname","127.0.0.1"],{env:{...process.env,NODE_ENV:"production",DATABASE_URL:db.testConnectionString,APP_URL:"https://villacheck.test",ADMIN_EMAIL:"admin@next.test",ADMIN_PASSWORD:"AdminPassword123",NEXT_TELEMETRY_DISABLED:"1"},stdio:"ignore"});
 t.after(async()=>{if(child.exitCode===null){child.kill("SIGTERM");await new Promise(r=>child.once("exit",r));}await db.close()});
 const base=`http://127.0.0.1:${port}`;let ready=false;
 for(let n=0;n<60;n++){try{if((await fetch(base)).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
 assert.ok(ready,"Next production started");assert.match(await (await fetch(base)).text(),/VillaCheck/);
 const image=await fetch(base+'/demo/villas/villa-1.jpg');assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/image\/jpeg/);
 const health=await fetch(base+"/api/health");assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true});
 const packages=await fetch(base+"/api/packages");assert.equal(packages.status,401);
 const admin=await fetch(base+"/api/auth/admin-login",{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://villacheck.test"},body:JSON.stringify({email:"admin@next.test",password:"AdminPassword123"})});assert.equal(admin.status,200);const adminCookie=admin.headers.get('set-cookie').split(';')[0];
 const memberPackages=await fetch(base+"/api/packages",{headers:{Cookie:adminCookie}});assert.equal(memberPackages.status,200);assert.equal((await memberPackages.json()).packages.length,4);
 const r=await fetch(base+"/api/auth/register-user",{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://villacheck.test"},body:JSON.stringify({name:"Customer",email:"customer@next.test",password:"CustomerPassword123"})});assert.equal(r.status,200);const session=await r.json();assert.equal(session.user.role,"user");const cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/Secure/);
 const blocked=await fetch(base+"/api/admin/users",{headers:{Cookie:cookie}});assert.equal(blocked.status,403);
 // Exercise private, chunked document storage through the actual Next -> Nest
 // -> Prisma adapter, including PostgreSQL bytea reads and session protection.
 const villa=await db.prepare("SELECT * FROM villas WHERE name='Hua Hin Footer Ad Demo Villa'").get(),owner=await db.prepare("SELECT email FROM users WHERE id=?").get(villa.owner_id);
 const merchantLogin=await fetch(base+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://villacheck.test"},body:JSON.stringify({email:owner.email,password:"NextMaterialsPassword123"})});assert.equal(merchantLogin.status,200);const merchantCookie=merchantLogin.headers.get('set-cookie').split(';')[0],merchantSession=await merchantLogin.json();
 const month=new Date(Date.now()+7*3600000).toISOString().slice(0,7),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=','base64');
 const send=async data=>{const response=await fetch(base+'/api/merchant/social-materials',{method:'POST',headers:{Cookie:merchantCookie,Origin:'https://villacheck.test','Content-Type':'application/json','X-CSRF-Token':merchantSession.csrf},body:JSON.stringify({month,villaId:villa.id,...data})});assert.equal(response.status,200);return response.json();};
 const {uploadId}=await send({action:'start',name:'social-source.png',mime:'image/png',size:png.length});await send({action:'part',uploadId,index:0,base64:png.toString('base64')});const {submission}=await send({action:'finish',uploadId});
 const fileUrl=base+submission.assets[0].url;assert.equal((await fetch(fileUrl)).status,401);const file=await fetch(fileUrl,{headers:{Cookie:merchantCookie}});assert.equal(file.status,200);assert.deepEqual(Buffer.from(await file.arrayBuffer()),png);
 const review=await send({action:'submit',revision:submission.revision,confirmed:true,notes:'Source brief through Next/Nest/Prisma'});assert.equal(review.submission.status,'submitted');
})
