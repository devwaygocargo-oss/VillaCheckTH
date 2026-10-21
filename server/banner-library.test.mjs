import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDatabase} from './test-database.mjs';
import {adminCms} from './cms.mjs';
import {cmsDefaults} from './cms-defaults.mjs';
test('Admin media library reuses existing desktop/mobile banners and ads without duplicates or private documents',async()=>{
 const db=await openTestDatabase();try{
 const content=structuredClone(cmsDefaults);content.home.banners=[{title:'Hero',image:'https://example.com/hero.png',mobileImage:'https://example.com/mobile.png'}];content.home.images=['https://example.com/hero.png'];
 for(const key of ['cms_draft','cms_published'])await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify({content}));
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('advertisement:library-test',JSON.stringify({title:'Footer',placement:'footer',image:'https://example.com/footer.png',mobileImage:'https://example.com/mobile.png'}));
 const result=await adminCms(db,{role:'admin'},{method:'GET'},'/api/admin/cms/media',()=>{});
 for(const url of ['https://example.com/hero.png','https://example.com/mobile.png','https://example.com/footer.png'])assert.equal(result.media.filter(m=>m.url===url).length,1);
 assert(result.media.every(m=>m.source==='banner'||m.name.startsWith('cms-image:')));
 await assert.rejects(()=>adminCms(db,{role:'merchant'},{method:'GET'},'/api/admin/cms/media',()=>{}),e=>e.status===403);
 }finally{await db.close()}
});
