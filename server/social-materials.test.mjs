import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {openTestDatabase} from './test-database.mjs';
import {seedDemo} from './demo-seed.mjs';
import {socialMaterialsApi,socialMaterialFile,socialMaterialLimits,cleanupSocialUploads} from './social-materials.mjs';
import {createApp} from './app.mjs';
import {hashPassword} from './database.mjs';
const month=new Date(Date.now()+7*3600000).toISOString().slice(0,7),origin='http://localhost:3001';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=','base64');
const video=Buffer.alloc(3*1024*1024+35,71);video.writeUInt32BE(24,0);video.write('ftypisom',4,'ascii');
async function fixture(t){const db=await openTestDatabase();await seedDemo(db,{password:'MaterialsDummyPassword123',adminEmail:'materials-admin@example.test',adminPassword:'MaterialsDummyPassword123'});t.after(()=>db.close());const pro=await db.prepare("SELECT * FROM villas WHERE package_id='pro' AND status='approved' AND payments>0").get(),premium=await db.prepare("SELECT * FROM villas WHERE package_id='premium' AND status='approved' AND payments>0").get();const owner=await db.prepare('SELECT * FROM users WHERE id=?').get(pro.owner_id),admin=await db.prepare("SELECT * FROM users WHERE email='materials-admin@example.test'").get();return {db,pro,premium,owner,admin};}
const call=(db,user,data)=>socialMaterialsApi(db,user,{method:'POST'},'/api/'+(user.role==='admin'?'admin':'merchant')+'/social-materials',new URL(origin),async()=>({month,...data}));
async function upload(db,owner,villaId,bytes,mime='image/png',name='ภาพต้นฉบับ.png'){
 const {uploadId,chunkBytes}=await call(db,owner,{action:'start',villaId,size:bytes.length,mime,name});
 for(let offset=0,index=0;offset<bytes.length;offset+=chunkBytes,index++)await call(db,owner,{action:'part',villaId,uploadId,index,base64:bytes.subarray(offset,offset+chunkBytes).toString('base64')});
 return call(db,owner,{action:'finish',villaId,uploadId});
}
const get=(db,user,selectedMonth=month)=>socialMaterialsApi(db,user,{method:'GET'},'/api/'+(user.role==='admin'?'admin':'merchant')+'/social-materials',new URL(origin+'?month='+selectedMonth),()=>{});

test('Social materials: paid Pro and Premium accept private source photos/videos, review and resubmit without granting extra Social jobs',async t=>{
 const {db,pro,premium,owner,admin}=await fixture(t);
 for(const villa of [pro,premium]){
  const user=await db.prepare('SELECT * FROM users WHERE id=?').get(villa.owner_id);
  let {submission}=await upload(db,user,villa.id,png);
  ({submission}=await upload(db,user,villa.id,video,'video/mp4','source.mp4'));
  assert.equal(submission.status,'draft');assert.equal(submission.assets.length,2);
  await assert.rejects(call(db,user,{action:'submit',villaId:villa.id,revision:submission.revision,notes:'brief',confirmed:false}),e=>e.status===400);
  ({submission}=await call(db,user,{action:'submit',villaId:villa.id,revision:submission.revision,notes:'ภาพวิวสระ\nใช้โปรโมทสำหรับครอบครัว',confirmed:true}));
  assert.equal(submission.status,'submitted');assert.match(submission.notes,/ครอบครัว/);
  await assert.rejects(upload(db,user,villa.id,png),e=>e.status===409);
  await assert.rejects(call(db,admin,{action:'changes',villaId:villa.id,revision:submission.revision,adminNote:''}),e=>e.status===400);
  ({submission}=await call(db,admin,{action:'changes',villaId:villa.id,revision:submission.revision,adminNote:'ขอภาพที่ไม่มีลายน้ำเพิ่ม'}));
  assert.equal(submission.status,'changes');
  ({submission}=await upload(db,user,villa.id,png));
  ({submission}=await call(db,user,{action:'submit',villaId:villa.id,revision:submission.revision,notes:'เพิ่มภาพแล้ว',confirmed:true}));
  ({submission}=await call(db,admin,{action:'accepted',villaId:villa.id,revision:submission.revision,adminNote:'รับไฟล์เพื่อเตรียมคอนเทนต์แล้ว'}));
  assert.equal(submission.status,'accepted');assert.equal(submission.assets.length,3);
  assert.ok((await get(db,admin)).submissions.find(s=>s.villaId===villa.id).assets.every(a=>a.url.startsWith('/api/social-material-files/')));
 }
 assert.equal((await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'social_job:%'").all()).length,0);
 assert.ok((await get(db,owner)).submissions.every(s=>s.ownerId===owner.id));
});

test('Social materials enforce ownership, paid rights, source sizes, signatures, revisions and partial-upload quotas',async t=>{
 const {db,pro,owner,admin}=await fixture(t),other=await db.prepare("SELECT * FROM users WHERE role='merchant' AND id<>?").get(owner.id),visitor={id:randomUUID(),role:'user'};
 await assert.rejects(get(db,visitor),e=>e.status===403);
 await assert.rejects(call(db,other,{action:'start',villaId:pro.id,size:png.length,mime:'image/png',name:'x.png'}),e=>e.status===404);
 await assert.rejects(call(db,owner,{action:'start',villaId:pro.id,size:socialMaterialLimits.videoBytes+1,mime:'video/mp4',name:'large.mp4'}),e=>e.status===413);
 await assert.rejects(call(db,owner,{action:'start',villaId:pro.id,size:png.length,mime:'image/svg+xml',name:'x.svg'}),e=>e.status===400);
 await assert.rejects(call(db,owner,{action:'start',villaId:pro.id,month:'1999-01',size:png.length,mime:'image/png',name:'x.png'}),e=>e.status===400);
 for(const plan of ['basic','starter']){await db.prepare('UPDATE villas SET package_id=? WHERE id=?').run(plan,pro.id);await assert.rejects(upload(db,owner,pro.id,png),e=>e.status===403);}
 await db.prepare("UPDATE villas SET package_id='pro',expires='2000-01-01' WHERE id=?").run(pro.id);await assert.rejects(upload(db,owner,pro.id,png),e=>e.status===403);
 await db.prepare('UPDATE villas SET expires=? WHERE id=?').run(new Date(Date.now()+86400000).toISOString(),pro.id);
 const data={action:'start',villaId:pro.id,size:png.length,mime:'image/png',name:'x.png'};
 const one=await call(db,owner,data),two=await call(db,owner,data);
 await assert.rejects(call(db,owner,data),e=>e.status===409);
 await call(db,other,{action:'cancel',uploadId:one.uploadId});assert.ok(await db.prepare('SELECT value FROM system_settings WHERE key=?').get('social_upload:'+owner.id+':'+one.uploadId));
 await assert.rejects(call(db,owner,{action:'finish',villaId:pro.id,uploadId:one.uploadId}),e=>e.status===409);
 await call(db,owner,{action:'cancel',uploadId:one.uploadId});await call(db,owner,{action:'cancel',uploadId:two.uploadId});
 const bad=await call(db,owner,data);await call(db,owner,{action:'part',villaId:pro.id,uploadId:bad.uploadId,index:0,base64:Buffer.alloc(png.length).toString('base64')});await assert.rejects(call(db,owner,{action:'finish',villaId:pro.id,uploadId:bad.uploadId}),e=>e.status===400);await call(db,owner,{action:'cancel',uploadId:bad.uploadId});
 let {submission}=await upload(db,owner,pro.id,png);
 await assert.rejects(call(db,owner,{action:'delete',villaId:pro.id,assetId:submission.assets[0].id,revision:0}),e=>e.status===409);
 await assert.rejects(call(db,other,{action:'delete',villaId:pro.id,assetId:submission.assets[0].id,revision:submission.revision}),e=>e.status===404);
 const id=submission.assets[0].id;await assert.rejects(socialMaterialFile(db,other,id),e=>e.status===404);await assert.rejects(socialMaterialFile(db,null,id),e=>e.status===404);assert.deepEqual((await socialMaterialFile(db,admin,id)).bytes,png);
 ({submission}=await call(db,owner,{action:'draft',villaId:pro.id,revision:submission.revision,notes:'บรีฟที่บันทึกไว้'}));assert.equal(submission.notes,'บรีฟที่บันทึกไว้');
 await call(db,owner,{action:'delete',villaId:pro.id,assetId:id,revision:submission.revision});await assert.rejects(socialMaterialFile(db,admin,id),e=>e.status===404);assert.equal((await db.prepare('SELECT id FROM documents WHERE name=?').all('social-material:'+id)).length,0);
});

test('Chunk retries are idempotent, downloads retain exact bytes across boundaries, and expired staging is removed',async t=>{
 const {db,pro,owner}=await fixture(t),{uploadId,chunkBytes}=await call(db,owner,{action:'start',villaId:pro.id,size:video.length,mime:'video/mp4',name:'คลิปต้นฉบับ.mp4'});
 const part={action:'part',villaId:pro.id,uploadId,index:0,base64:video.subarray(0,chunkBytes).toString('base64')};
 await call(db,owner,part);await call(db,owner,part);
 await assert.rejects(call(db,owner,{...part,base64:Buffer.alloc(chunkBytes).toString('base64')}),e=>e.status===409);
 await assert.rejects(call(db,owner,{...part,index:2}),e=>e.status===400);
 for(let offset=chunkBytes,index=1;offset<video.length;offset+=chunkBytes,index++)await call(db,owner,{...part,index,base64:video.subarray(offset,offset+chunkBytes).toString('base64')});
 const {submission}=await call(db,owner,{action:'finish',villaId:pro.id,uploadId});const id=submission.assets[0].id;
 const chunks=[];for(let start=0;start<video.length;){const f=await socialMaterialFile(db,owner,id,`bytes=${start}-`);assert.ok(f.bytes.length<=1024*1024);assert.equal(f.partial,true);chunks.push(f.bytes);start=f.end+1;}assert.deepEqual(Buffer.concat(chunks),video);
 const cross=await socialMaterialFile(db,owner,id,`bytes=${chunkBytes-3}-${chunkBytes+7}`);assert.deepEqual(cross.bytes,video.subarray(chunkBytes-3,chunkBytes+8));
 assert.deepEqual((await socialMaterialFile(db,owner,id,'bytes=-16')).bytes,video.subarray(-16));
 await assert.rejects(socialMaterialFile(db,owner,id,'bytes=999999999-'),e=>e.status===416);
 const cancelled=await call(db,owner,{action:'start',villaId:pro.id,size:png.length,mime:'image/png',name:'staging.png'});await call(db,owner,{action:'part',villaId:pro.id,uploadId:cancelled.uploadId,index:0,base64:png.toString('base64')});
 const k='social_upload:'+owner.id+':'+cancelled.uploadId,row=JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get(k)).value);row.expiresAt=0;await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(row),k);assert.equal(await cleanupSocialUploads(db),1);assert.equal((await db.prepare('SELECT id FROM documents WHERE name=?').all('social-material:'+cancelled.uploadId)).length,0);assert.deepEqual((await socialMaterialFile(db,owner,id,'bytes=0-7')).bytes,video.subarray(0,8));
});

test('HTTP social upload and ranged files require sessions/CSRF and preserve private bytes',async t=>{
 const {db,pro,owner}=await fixture(t),config={appUrl:origin,allowedOrigins:[origin],fakeHash:hashPassword('fake-password'),serverless:true};const server=createApp(db,config);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/api/merchant/social-materials')).status,401);
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:owner.email,password:'MaterialsDummyPassword123'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],{csrf}=await login.json();
 const post=async(data,token=csrf)=>fetch(base+'/api/merchant/social-materials',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({month,villaId:pro.id,...data})});
 assert.equal((await post({action:'start',name:'x.mp4',mime:'video/mp4',size:video.length},'wrong')).status,403);
 const start=await post({action:'start',name:'คลิป.mp4',mime:'video/mp4',size:video.length});assert.equal(start.status,200);const {uploadId,chunkBytes}=await start.json();
 for(let offset=0,index=0;offset<video.length;offset+=chunkBytes,index++)assert.equal((await post({action:'part',uploadId,index,base64:video.subarray(offset,offset+chunkBytes).toString('base64')})).status,200);
 const finish=await post({action:'finish',uploadId});assert.equal(finish.status,200);const {submission}=await finish.json(),url=base+submission.assets[0].url;
 assert.equal((await fetch(url)).status,401);const range=await fetch(url,{headers:{Cookie:cookie,Range:'bytes=524280-524310'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),`bytes 524280-524310/${video.length}`);assert.equal(range.headers.get('cache-control'),'private, no-store');assert.match(range.headers.get('content-type'),/video\/mp4/);assert.deepEqual(Buffer.from(await range.arrayBuffer()),video.subarray(524280,524311));
});
