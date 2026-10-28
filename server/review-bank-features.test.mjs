import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,createUser} from './database.mjs';
import {seedDemo} from './demo-seed.mjs';
import {reviewsApi} from './reviews.mjs';
import {publicReviewPage,privateReviewerLabel} from './review-presentation.mjs';
import {merchantReceivingBankApi} from './merchant-receiving-bank.mjs';
const fixture=async()=>{const db=openDatabase(':memory:');await seedDemo(db,{password:'LocalReviewFeature123',adminEmail:'feature-admin@example.test',adminPassword:'LocalReviewFeature123'});return db};

test('public review pages aggregate only published records, filter without changing summary and expose privacy-safe names',async()=>{
 const db=await fixture();try{
  const villa=await db.prepare("SELECT * FROM villas WHERE status='approved' AND qr IS NOT NULL LIMIT 1").get(),admin=await db.prepare("SELECT * FROM users WHERE role='admin' LIMIT 1").get(),owner=await db.prepare('SELECT * FROM users WHERE id=?').get(villa.owner_id),user=await createUser(db,'feature-reviewer@example.test','LocalReviewFeature123','Private Full Name','user');
  const ratings=[1,2,3,4,5,5,3];for(const [index,rating]of ratings.entries())await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('customer_review:feature-'+index,JSON.stringify({id:'feature-'+index,villaId:villa.id,userId:user.id,author:'Private Full Name',rating,content:'Original content '+index,status:'published',createdAt:'2026-10-'+String(index+10).padStart(2,'0')+'T00:00:00Z',reply:{content:'Original owner response',author:'Owner Private Name',at:'2026-10-20T00:00:00Z'}}));
  for(const [id,foreign,status]of [['pending',false,'pending'],['foreign',true,'published']])await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('customer_review:'+id,JSON.stringify({id,villaId:foreign?'another-villa':villa.id,userId:user.id,author:'Hidden Name',rating:5,content:'Must not appear',status,createdAt:'2026-10-28'}));
  const call=async(path,actor=null)=>{const url=new URL('http://local/api'+path);return reviewsApi(db,actor,{method:'GET'},url.pathname,url,async()=>{})};
  const page=await call('/public/reviews?qr='+villa.qr+'&pageSize=2&sort=lowest');assert.equal(page.summary.count,7);assert.equal(page.summary.average,3.3);assert.equal(page.summary.distribution[5],2);assert.deepEqual(page.reviews.map(r=>r.rating),[1,2]);assert.equal(page.pagination.total,7);assert.equal(page.pagination.totalPages,4);assert.equal(page.pagination.hasNext,true);assert.equal(page.reviews[0].author,'P…');assert.equal(page.reviews[0].reply.author,'O…');assert.equal(page.reviews[0].content,'Original content 0');assert(!JSON.stringify(page).includes('Private Full Name'));assert(!JSON.stringify(page).includes('userId'));assert(!JSON.stringify(page).includes('verifiedStay'));
  const filtered=await call('/public/reviews?qr='+villa.qr+'&rating=5&sort=oldest');assert.equal(filtered.pagination.total,2);assert.equal(filtered.summary.count,7);assert(filtered.reviews.every(r=>r.rating===5));assert.deepEqual(filtered.reviews.map(r=>r.id),['feature-4','feature-5']);
  const second=await call('/public/reviews?qr='+villa.qr+'&page=2&pageSize=2&sort=lowest');assert.equal(second.reviews.length,2);assert(!second.reviews.some(r=>page.reviews.some(first=>first.id===r.id)));
  assert.equal((await call('/reviews',user)).reviews.find(r=>r.id==='feature-0').author,'Private Full Name');assert.equal((await call('/admin/reviews',admin)).reviews.find(r=>r.id==='feature-0').author,'Private Full Name');const merchant=(await call('/merchant/reviews',owner)).reviews.find(r=>r.id==='feature-0');assert.equal(merchant.author,'P…');assert.equal(merchant.userId,undefined);assert.equal(merchant.history,undefined);
 }finally{await db.close()}
});

test('review filtering validates query bounds and empty summaries do not fabricate scores',()=>{
 for(const query of ['page=0','pageSize=25','rating=0','rating=5.0','sort=unknown','page=Infinity'])assert.throws(()=>publicReviewPage([],new URLSearchParams(query)),{status:400,code:'REVIEW_QUERY_INVALID'});
 const empty=publicReviewPage([],new URLSearchParams());assert.equal(empty.summary.average,null);assert.equal(empty.summary.count,0);assert.equal(empty.pagination.hasNext,false);assert.equal(privateReviewerLabel(''), 'Member');assert.equal(privateReviewerLabel('คน ทดสอบ'),'ค…');
});

test('Merchant bank details are own-account only, masked, revision protected and independent of platform/property bank records',async()=>{
 const db=await fixture();try{
  const merchant=await createUser(db,'bank-owner@example.test','LocalReviewFeature123','Merchant Owner','merchant'),other=await createUser(db,'bank-other@example.test','LocalReviewFeature123','Other Merchant','merchant'),user=await createUser(db,'bank-user@example.test','LocalReviewFeature123','User','user'),admin=await db.prepare("SELECT * FROM users WHERE role='admin' LIMIT 1").get();
  const oldVillas=await db.prepare('SELECT id,bank_name,account_name,account_number FROM villas ORDER BY id').all(),platform=await db.prepare("SELECT value FROM system_settings WHERE key='receiving_bank'").get();
  const call=(actor,data,query='',method=data===undefined?'GET':'POST')=>{const url=new URL('http://local/api/merchant/receiving-bank'+query);return merchantReceivingBankApi(db,actor,{method},url.pathname,url,async()=>data)};
  assert.equal((await call(merchant)).configured,false);for(const actor of [user,admin])await assert.rejects(call(actor),{status:403});await assert.rejects(call(null),{status:401});
  const input={bankName:'Synthetic test bank',accountName:'Synthetic test holder',accountNumber:'0000000000',revision:0},saved=await call(merchant,input);assert.equal(saved.revision,1);assert.equal(saved.maskedAccountNumber,'•••• 0000');assert.equal(saved.accountNumber,undefined);assert(!JSON.stringify(saved).includes(input.accountNumber));assert.equal((await call(other)).configured,false);
  await assert.rejects(call(merchant,{...input,ownerId:other.id}),{status:400});await assert.rejects(call(merchant,undefined,'?userId='+other.id),{status:400});await assert.rejects(call(merchant,input),{status:409});
  const before=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('merchant_receiving_bank:'+merchant.id);for(const invalid of [{...input,revision:1,accountNumber:'123'},{...input,revision:1,bankName:'Bad\nBank'},{...input,revision:1,accountNumber:'<script>'}])await assert.rejects(call(merchant,invalid),{status:400});assert.deepEqual(await db.prepare('SELECT value FROM system_settings WHERE key=?').get('merchant_receiving_bank:'+merchant.id),before);
  const edited=await call(merchant,{bankName:'Updated synthetic bank',accountName:'Synthetic test holder',accountNumber:'',revision:1});assert.equal(edited.revision,2);assert.equal(edited.maskedAccountNumber,'•••• 0000');assert.equal(JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('merchant_receiving_bank:'+merchant.id)).value).accountNumber,'0000000000');
  await assert.rejects(call({...merchant,token_hash:'revoked'}, {...input,revision:2}),{status:401});assert.equal((await call(merchant)).revision,2);assert.deepEqual(await db.prepare('SELECT id,bank_name,account_name,account_number FROM villas ORDER BY id').all(),oldVillas);assert.deepEqual(await db.prepare("SELECT value FROM system_settings WHERE key='receiving_bank'").get(),platform);const audits=await db.prepare("SELECT action,target_id FROM audits WHERE actor_id=? AND action='merchant.receiving_bank.updated'").all(merchant.id);assert.equal(audits.length,2);assert(audits.every(a=>a.target_id===merchant.id));
 }finally{await db.close()}
});
