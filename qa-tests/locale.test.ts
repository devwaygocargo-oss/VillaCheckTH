import test from 'node:test'
import assert from 'node:assert/strict'
import {getLocale,setLocale,tr,t,localeTag,formatDate,formatNumber,localeStorageKey} from '../src/locale'
import {englishSystemText} from '../src/systemTranslations'
test('Thai default, exact source text, English fallback and placeholders do not alter authored content',()=>{
 assert.equal(getLocale(),'th');assert.equal(localeTag(),'th-TH');assert.equal(t('otp.method'),'เลือกวิธีเข้าสู่ระบบ');assert.equal(tr('en','เบอร์โทร'),'Phone number');assert.equal(tr('en','otp.resend',{seconds:30}),'Resend in 30s');englishSystemText['test.fallback']='English fallback';assert.equal(tr('th','test.fallback'),'English fallback');delete englishSystemText['test.fallback'];assert.equal(tr('en','ชื่อเฉพาะที่ผู้ใช้ป้อน'),'ชื่อเฉพาะที่ผู้ใช้ป้อน');
})
test('locale choice persists, updates document language and supports locale-aware dates and styles',()=>{
 const data=new Map<string,string>();Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:(k:string)=>data.get(k),setItem:(k:string,v:string)=>data.set(k,v)}}});Object.defineProperty(globalThis,'document',{configurable:true,value:{documentElement:{lang:'th'}}});setLocale('en');assert.equal(data.get(localeStorageKey),'en');assert.equal(document.documentElement.lang,'en');assert.equal(localeTag(),'en-GB');assert.equal(formatNumber(1250),'1,250');assert.match(formatDate('2026-01-01',{dateStyle:'long'}),/January/);assert.equal(formatDate('bad-date'),'Not provided');setLocale('th');assert.equal(getLocale(),'th');assert.equal(document.documentElement.lang,'th');delete (globalThis as {window?:unknown}).window;delete (globalThis as {document?:unknown}).document;
})
