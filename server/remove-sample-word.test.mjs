import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDatabase} from './test-database.mjs';
import {createUser} from './database.mjs';
import {removeSampleWord} from './remove-sample-word.mjs';
test('display wording migration removes Thai sample labels, preserves identity and is idempotent',async()=>{
 const db=await openTestDatabase();try{
 const u=await createUser(db,'wording@example.test','UnchangedPassword123','Merchant ตัวอย่าง','merchant');
 const before=await db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('advertisement:wording',JSON.stringify({title:'ที่พักตัวอย่าง',description:'โฆษณาตัวอย่าง ไม่เปิดรับจองจริง',demo:true,href:'#page=verify&item=VC-unchanged'}));
 assert(await removeSampleWord(db)>0);const after=await db.prepare('SELECT * FROM users WHERE id=?').get(u.id);assert.equal(after.name,'Merchant');assert.equal(after.email,before.email);assert.equal(after.password_hash,before.password_hash);
 const ad=JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('advertisement:wording')).value);assert.equal(ad.title,'ที่พัก');assert.equal(ad.demo,true);assert.equal(ad.href,'#page=verify&item=VC-unchanged');assert(ad.description.includes('ไม่เปิดรับจองจริง'));assert.equal(await removeSampleWord(db),0);
 }finally{await db.close()}
});
