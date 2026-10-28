import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {villaStatusBadge} from '../src/villaStatus.ts'
import {setLocale} from '../src/locale.ts'
import PackageComingSoon from '../src/PackageComingSoon.tsx'
import DocumentManagement from '../src/DocumentManagement.tsx'

test('document revision label is distinct from a missing initial submission in both languages without mutating workflow state',()=>{
 const revision=Object.freeze({status:'changes',document:Object.freeze({data:'/api/documents/fixture'})})
 const initial=Object.freeze({status:'pending'})
 setLocale('th');assert.equal(villaStatusBadge(revision).label,'รอการแก้ไข');assert.equal(villaStatusBadge(initial).label,'กรุณาแนบเอกสาร')
 setLocale('en');assert.equal(villaStatusBadge(revision).label,'Revision Required');assert.notEqual(villaStatusBadge(initial).label,'Revision Required')
 assert.equal(revision.status,'changes');assert.equal(initial.status,'pending');assert.equal(villaStatusBadge(revision).tone,'changes')
 setLocale('th')
})
test('package page is presentation-only with no purchase, property creation or expiry disclosure',()=>{
 const html=renderToStaticMarkup(React.createElement(PackageComingSoon))
 assert.match(html,/Coming Soon/);assert.match(html,/สิทธิ์การใช้งานเดิม/)
 assert.doesNotMatch(html,/<form|<button|เพิ่มที่พัก|ใช้งานฟรี สิ้นสุดวันที่|payment|checkout/i)
})
test('document management empty state has no add-property action and keeps private legacy metadata honest',()=>{
 const empty=renderToStaticMarkup(React.createElement(DocumentManagement,{villas:[]}))
 assert.match(empty,/จัดการเอกสาร/);assert.match(empty,/ยังไม่มีที่พักหรือเอกสาร/);assert.doesNotMatch(empty,/<button|เพิ่มที่พัก/)
 const villa={id:'00000000-0000-4000-a000-000000000001',name:'Owner supplied name',status:'changes',reason:'Original reviewer note',document:{name:'Original-file.pdf',type:'application/pdf',data:'/api/documents/00000000-0000-4000-a000-000000000002'}}
 const html=renderToStaticMarkup(React.createElement(DocumentManagement,{villas:[villa]}))
 assert.match(html,/Original-file\.pdf/);assert.match(html,/Original reviewer note/);assert.match(html,/ไม่พบวันที่อัปโหลดในข้อมูลเดิม/);assert.match(html,/รอการแก้ไข/);assert.match(html,/preview=1/);assert.match(html,/rel="noopener noreferrer"/);assert.doesNotMatch(html,/<iframe|เพิ่มที่พัก/)
})
