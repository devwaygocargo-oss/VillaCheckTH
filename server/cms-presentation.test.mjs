import test from 'node:test'
import assert from 'node:assert/strict'
import {openTestDatabase} from './test-database.mjs'
import {createUser} from './database.mjs'
import {createApp} from './app.mjs'
import {cmsDefaults} from './cms-defaults.mjs'
import {validateCms} from './cms.mjs'
import {copyDefaults} from './cms-presentation.mjs'

test('expanded CMS validates legacy content, structured sections, links and bounded settings',()=>{
 const legacy=structuredClone(cmsDefaults);delete legacy.presentation;const normalized=validateCms(legacy);assert.deepEqual(normalized.presentation.copy,copyDefaults)
 const changed=structuredClone(normalized);changed.presentation.copy['scan.title']='Custom scanner';changed.presentation.services[0].title='Custom service';changed.presentation.footerColumns[0].links[0].label='Custom footer';changed.presentation.bannerSource='mixed';changed.presentation.provinces=['ภูเก็ต'];assert.deepEqual(validateCms(changed).presentation,changed.presentation)
 for(const mutate of [p=>p.copy.unknown='Not allowed',p=>p.copy['scan.title']='<bad>\x00',p=>p.services[0].href='javascript:alert(1)',p=>p.footerColumns[0].links[0].href='data:text/html,bad',p=>p.showcaseLimit=100,p=>p.footerAdLimit=0,p=>p.bannerSource='invalid',p=>p.provinces=['ภูเก็ต','ภูเก็ต'],p=>p.services[0].icon='bad',p=>p.cta.qr='javascript:alert(1)']){const bad=structuredClone(changed);mutate(bad.presentation);assert.throws(()=>validateCms(bad),e=>e.status===400)}
})

test('new CMS sections stay draft until separate Admin approval; service media remains protected',async t=>{
 const db=await openTestDatabase(),password='CmsPresentationDummy123';await createUser(db,'presentation-admin@example.test',password,'Editor','admin');await createUser(db,'presentation-reviewer@example.test',password,'Reviewer','admin');await createUser(db,'presentation-owner@example.test',password,'Owner','merchant')
 const origin='http://localhost:8443',server=createApp(db,{appUrl:origin,allowedOrigins:[origin],serverless:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/api'
 const req=async(path,data,session)=>{const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})},body:data?JSON.stringify(data):undefined});const value=r.headers.get('content-type')?.includes('application/json')?await r.json():null;return{status:r.status,value,cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const login=async(email,admin=true)=>{const r=await req(admin?'/auth/admin-login':'/auth/login',{email,password});assert.equal(r.status,200);return{cookie:r.cookie,csrf:r.value.csrf}}
 try{
 const editor=await login('presentation-admin@example.test'),reviewer=await login('presentation-reviewer@example.test'),merchant=await login('presentation-owner@example.test',false)
 const uploaded=await req('/admin/cms/media',{file:{name:'DUMMY-service.png',type:'image/png',data:'data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64')}},editor);assert.equal(uploaded.status,200);const image=uploaded.value
 const content=structuredClone(cmsDefaults);content.presentation.copy['directory.title']='Custom directory heading';content.presentation.services[0].image=image.url;content.presentation.footerColumns[0].links[0].label='Custom footer link';content.presentation.bannerSource='editorial-first';content.presentation.footerAdLimit=2
 assert.equal((await req('/admin/cms/save',{revision:0,content},merchant)).status,403)
 const saved=await req('/admin/cms/save',{revision:0,content},editor);assert.equal(saved.status,200)
 assert.notEqual((await req('/public/cms')).value.content.presentation.copy['directory.title'],'Custom directory heading');assert.equal((await req(image.url.replace('/api',''))).status,404)
 const proposal=await req('/admin/change-approvals',{kind:'cms',payload:{revision:saved.value.draft.revision}},editor);assert.equal(proposal.status,200)
 assert.equal((await req('/admin/change-approvals/'+proposal.value.request.id+'/approve',{},editor)).status,403)
 assert.equal((await req('/admin/change-approvals/'+proposal.value.request.id+'/approve',{},reviewer)).status,200)
 const live=(await req('/public/cms')).value.content;assert.equal(live.presentation.copy['directory.title'],'Custom directory heading');assert.equal(live.presentation.services[0].image,image.url);assert.equal(live.presentation.footerColumns[0].links[0].label,'Custom footer link');assert.equal(live.presentation.bannerSource,'editorial-first');assert.equal(live.presentation.footerAdLimit,2);assert.equal((await req(image.url.replace('/api',''))).status,200)
 const hidden=structuredClone(saved.value.draft.content);hidden.presentation.services[0].visible=false;assert.equal((await req('/admin/cms/save',{revision:1,content:hidden},editor)).status,200);assert.equal((await req('/admin/cms/media/delete',{id:image.id},editor)).status,409)
 }finally{await new Promise(r=>server.close(r));await db.close()}
})
