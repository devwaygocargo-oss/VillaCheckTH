import test from 'node:test';
import assert from 'node:assert/strict';
import {localizeCheckResponse} from './check-localization.mjs';
const matched='ข้อมูลตรงกับทะเบียน ณ เวลาตรวจสอบ ไม่ใช่การรับประกันการจอง';
const mismatch='บัญชีหรือช่องทางติดต่อไม่ตรง กรุณาตรวจสอบกับที่พักก่อนโอน';
const missing='ไม่พบที่พักที่ระบุในระบบ';
test('exact generated results and formatted QR statuses localize without changing identifiers or source records',()=>{
 for(const [source,expected] of [[matched,'The details match the registry at the time of checking. This does not guarantee a booking.'],[mismatch,'The account or contact details do not match. Check with the property before transferring money.'],[missing,'The specified property was not found.'],['QR ไม่พร้อมใช้งาน: EXPIRED','QR is unavailable: EXPIRED']]){
  const row={id:'check-1',reference:'CHK-original',status:'MATCHED',result:source,user_id:'user-original',submitted_account:'001122',submitted_contact:'ข้อความจากลูกค้า',admin_note:matched};
  const actual=localizeCheckResponse(row,'en-GB');assert.equal(actual.result,expected);assert.deepEqual({...actual,result:source},row);assert.equal(row.result,source);assert.equal(actual.admin_note,matched);assert.notEqual(actual,row);
 }
});
test('unknown, prototype-like and custom authored results are preserved exactly',()=>{
 for(const result of ['toString','constructor','__proto__','hasOwnProperty','ข้อความที่ผู้ดูแลเขียนเอง',matched+' เพิ่มข้อความเอง','QR ไม่พร้อมใช้งาน: EXPIRED custom',null,undefined,42,{result:matched}]){
  const row={result,note:'เนื้อหาของผู้ใช้',status:'REVIEW_REQUIRED'};assert.equal(localizeCheckResponse(row,'en'),row);assert.equal(row.result,result);
 }
 for(const primitive of [null,undefined,42,'raw user text'])assert.equal(localizeCheckResponse(primitive,'en'),primitive);
});
test('flat arrays and actual list/summary/Admin-style checks shapes retain every non-result field',()=>{
 const generated={id:'one',result:matched},authored={id:'two',result:'ผู้ดูแลบันทึกเอง'},rows=[generated,authored],array=localizeCheckResponse(rows,'en');assert.equal(array[0].result,'The details match the registry at the time of checking. This does not guarantee a booking.');assert.equal(array[1],authored);assert.equal(rows[0],generated);assert.equal(generated.result,matched);
 for(const wrapper of [{checks:rows,checkableVillaIds:['villa-original']},{counts:{checks:2,reports:1},checks:rows},{checks:rows,user_name:'ชื่อผู้ใช้',admin_note:'บันทึกของผู้ดูแล'}]){
  const snapshot=structuredClone(wrapper),actual=localizeCheckResponse(wrapper,'en-GB');assert.deepEqual({...actual,checks:rows},wrapper);assert.equal(actual.checks[1],authored);assert.notEqual(actual.checks[0],generated);assert.deepEqual(wrapper,snapshot);
 }
});
test('Thai/default locale leaves original objects and nested authored content untouched',()=>{
 const value={checks:[{id:'original',result:matched,note:'Original customer content'}],counts:{checks:1}};for(const locale of [undefined,'','th','th-TH','fr-FR'])assert.equal(localizeCheckResponse(value,locale),value);assert.equal(localizeCheckResponse({checks:[{result:missing}]},' en-GB').checks[0].result,'The specified property was not found.');
});
