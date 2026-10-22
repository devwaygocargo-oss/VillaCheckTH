import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDatabase} from './test-database.mjs';
import {createUser} from './database.mjs';
import {seedDemo} from './demo-seed.mjs';
import {seedDemoUserActivity} from './demo-user-activity.mjs';
import {trustDto} from './catalog.mjs';
test('demo users receive related Villa activity without changing real accounts or historical records',async t=>{
 const db=await openTestDatabase();t.after(()=>db.close());await seedDemo(db,{password:'ActivityFixture1234'});
 const second=await createUser(db,'demo-user2@villacheck.example','ActivityFixture1234','ผู้ใช้ 2','user');
 const real=await createUser(db,'real@example.com','ActivityFixture1234','Real','user');
 const initial=await seedDemoUserActivity(db);assert.equal(initial.accounts,2);assert.equal(initial.checks,12);assert.equal(initial.reports,6);
 const checks=await db.prepare('SELECT * FROM user_checks WHERE user_id=?').all(second.id);assert.equal(checks.length,6);
 for(const check of checks){const villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(check.villa_id);const trust=await trustDto(db,villa);assert.equal(check.villa_name,villa.name);assert.equal(check.qr,villa.qr);assert.equal(check.submitted_contact,villa.phone);assert.equal(check.status==='MATCHED',check.submitted_account===villa.account_number&&trust.qrStatus==='ACTIVE');assert(check.result.includes(villa.province));}
 const reports=await db.prepare('SELECT * FROM support_reports WHERE user_id=?').all(second.id);assert.deepEqual(reports.map(r=>r.status).sort(),['NEW','RESOLVED','UNDER_REVIEW']);
 for(const r of reports){const villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(r.villa_id);assert.equal(r.villa_name,villa.name);assert(r.detail.includes(villa.name));}
 await db.prepare("UPDATE support_reports SET status='REJECTED',public_note='Actual admin response' WHERE id=?").run(reports[0].id);
 await db.prepare("UPDATE villas SET name='Updated property name' WHERE id=?").run(checks[0].villa_id);
 const again=await seedDemoUserActivity(db);assert.equal(again.checks,0);assert.equal(again.reports,0);assert.equal((await db.prepare('SELECT public_note FROM support_reports WHERE id=?').get(reports[0].id)).public_note,'Actual admin response');assert.equal((await db.prepare('SELECT villa_name FROM user_checks WHERE id=?').get(checks[0].id)).villa_name,checks[0].villa_name);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM user_checks WHERE user_id=?').get(real.id)).n,0);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM support_reports WHERE user_id=?').get(real.id)).n,0);
});
test('Named DEMO User 01–03 accounts receive real listing-linked fixtures regardless of email domain',async t=>{
 const db=await openTestDatabase();t.after(()=>db.close());await seedDemo(db,{password:'ActivityFixture1234'});
 const users=[];for(const n of ['01','02','03'])users.push(await createUser(db,'showcase'+n+'@example.test','ActivityFixture1234','DEMO User '+n,'user'));
 const regular=await createUser(db,'customer@example.test','ActivityFixture1234','Customer','user');
 const before=await db.prepare('SELECT password_hash FROM users WHERE id=?').get(users[0].id);
 const result=await seedDemoUserActivity(db);assert.equal(result.namedDemoAccounts,3);
 for(const user of users){
  const checks=await db.prepare('SELECT * FROM user_checks WHERE user_id=?').all(user.id);assert.equal(checks.length,6);
  for(const check of checks){const villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(check.villa_id);assert.equal(villa.status,'approved');assert.equal(check.qr,villa.qr);assert.equal(check.villa_name,villa.name);}
 }
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM user_checks WHERE user_id=?').get(regular.id)).n,0);
 assert.deepEqual(await db.prepare('SELECT password_hash FROM users WHERE id=?').get(users[0].id),before);
 assert.equal((await seedDemoUserActivity(db)).checks,0);
});
