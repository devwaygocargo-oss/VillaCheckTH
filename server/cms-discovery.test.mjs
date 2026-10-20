import test from "node:test";
import assert from "node:assert/strict";
import { cmsDefaults } from "./cms-defaults.mjs";
import { validateCms, publishedCms } from "./cms.mjs";
import { openTestDatabase } from "./test-database.mjs";
import { shortcutMediaUrls } from "./cms-home-config.mjs";
const fresh=()=>structuredClone(cmsDefaults);
test("CMS discovery preserves editable content, visibility, order and media references",()=>{
 const data=fresh(),d=data.home.discovery;
 d.placeholder="ค้นหาวิลล่าที่ต้องการ";d.background="#123456";d.shortcuts.reverse();d.shortcuts[0].icon="scan";d.shortcuts[0].image="/api/public/cms-media/abc-123";d.shortcuts[1].visible=false;
 const result=validateCms(data);assert.deepEqual(result.home.discovery,d);assert.deepEqual(shortcutMediaUrls(result,true),[d.shortcuts[0].image]);d.visible=false;assert.deepEqual(shortcutMediaUrls(data,true),[]);assert.equal(shortcutMediaUrls(data).length,1);
});
test("CMS rejects unsafe shortcuts and malformed display configuration",()=>{
 for(const mutate of [d=>d.shortcuts[0].href="javascript:alert(1)",d=>d.shortcuts[0].href="#page=admin-dashboard",d=>d.shortcuts[0].icon="unknown",d=>d.background="red",d=>d.shortcuts.push({...d.shortcuts[0]}),d=>d.shortcuts[0].image="data:image/svg+xml,evil",d=>d.visible="yes",d=>d.buttonLabel=""]){const data=fresh();mutate(data.home.discovery);assert.throws(()=>validateCms(data),e=>e.status===400);}
});
test("Legacy CMS reads gain matching defaults and navigation without rewriting revisions",async()=>{
 const db=await openTestDatabase();try{const data=fresh();delete data.home.discovery;delete data.home.buttonLabel;delete data.home.buttonHref;data.navigation.push({id:"how",label:"วิธีการทำงาน",href:"#how",visible:true});data.navigation=data.navigation.filter(x=>x.href!=="#page=contact");const saved=JSON.stringify({revision:37,content:data,updatedAt:"2026-01-01",updatedBy:"editor"});await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run("cms_published",saved);const release=await publishedCms(db);assert.equal(release.revision,37);assert.equal(release.content.home.discovery.shortcuts.length,6);assert.ok(!release.content.navigation.some(x=>x.id==="how"));assert.ok(release.content.navigation.some(x=>x.href==="#page=contact"&&x.visible));assert.equal((await db.prepare("SELECT value FROM system_settings WHERE key=?").get("cms_published")).value,saved);}finally{await db.close();}
});
