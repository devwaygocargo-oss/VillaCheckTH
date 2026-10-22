import test from 'node:test'
import assert from 'node:assert/strict'
import {openTestDatabase} from './test-database.mjs'
import {seedDemo} from './demo-seed.mjs'
import {villaPagesApi,villaPage} from './villa-pages.mjs'
import {advertisingApi} from './advertising.mjs'
import {propertyMediaApi} from './property-media.mjs'
import {cmsChanges} from './cms-change-history.mjs'
test('Each package can edit its own villa page without changing approval or exposing contact fields; history restores and detail ads stay disabled',async()=>{
 const db=await openTestDatabase();try{
 await seedDemo(db,{password:'VillaPageFixture1234',adminEmail:'pages@example.test',adminPassword:'VillaPageFixture1234'})
 const admin=await db.prepare('SELECT * FROM users WHERE email=?').get('pages@example.test')
 const call=(user,method,data,id='')=>villaPagesApi(db,user,{method},'/api/admin/villa-pages',new URL('http://localhost?villaId='+id),async()=>data)
 await assert.rejects(call({role:'merchant'},'GET'),e=>e.status===403)
 for(const tier of ['basic','starter','pro','premium']){
 const v=await db.prepare('SELECT * FROM villas WHERE package_id=? LIMIT 1').get(tier)
 const initial=(await call(admin,'GET',null,v.id)).villas[0];assert(initial);assert.equal(initial.phone,undefined);assert.equal(initial.account_number,undefined)
 const uploaded=await propertyMediaApi(db,admin,{method:'POST'},'/api/admin/property-media',new URL('http://localhost'),async()=>({villaId:v.id,file:{name:'fixture.png',type:'image/png',data:'data:image/png;base64,iVBORw0KGgo='}}));assert.equal(uploaded.media.villaId,v.id)
 const details={...initial.details,description:'Updated '+tier}
 await call(admin,'POST',{id:v.id,details});assert.equal((await villaPage(db,v)).description,'Updated '+tier)
 const after=await db.prepare('SELECT * FROM villas WHERE id=?').get(v.id);assert.deepEqual(after,v)
 const history=(await cmsChanges(db)).entries.find(h=>h.kind==='villa_page'&&h.action==='before_edit'&&h.targetId===v.id);assert(history)
 await call(admin,'POST',{historyId:history.id});assert.deepEqual(await villaPage(db,v),initial.details)
 await assert.rejects(call(admin,'POST',{id:v.id,details:{...details,bedrooms:-1}}),e=>e.status===400)
 }
 assert.deepEqual(await advertisingApi(db,null,{method:'GET'},'/api/public/advertisements',new URL('http://localhost?placement=detail'),()=>{}),{advertisements:[]})
 }finally{await db.close()}
})
