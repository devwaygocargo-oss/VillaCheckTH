import { randomUUID } from "node:crypto"
import { cmsDefaults } from "./cms-defaults.mjs"
const prefix = "cms_change:"
const setting = async (db,key,fallback) => {const row=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key);return row?JSON.parse(row.value):fallback}
export async function recordCmsChange(db,{kind,action,snapshot,user,previous=false,legacy=false}) {
  const time=legacy?(Date.parse(snapshot.updatedAt)||0):previous?Date.now()-1:Date.now()
  const id=prefix+String(time).padStart(13,"0")+":"+(legacy?"legacy-"+snapshot.revision:randomUUID())
  const entry={id,kind,action,revision:kind==="cms"?snapshot.revision:null,targetId:snapshot.id||null,title:snapshot.title||snapshot.name||"",updatedAt:legacy?snapshot.updatedAt||null:new Date(time).toISOString(),updatedBy:user?.name||snapshot.updatedBy||"ระบบ",snapshot}
  await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run(id,JSON.stringify(entry))
  return entry
}
export async function initializeCmsChanges(db) {
  if(await setting(db,"cms_change_initialized",false))return
  const published=await setting(db,"cms_published",{revision:0,content:cmsDefaults,updatedAt:null,updatedBy:null})
  const draft=await setting(db,"cms_draft",published)
  const versions=new Map((await setting(db,"cms_history",[])).map(v=>[v.revision,v]))
  versions.set(published.revision,published);versions.set(draft.revision,draft)
  for(const snapshot of versions.values())await recordCmsChange(db,{kind:"cms",action:snapshot.revision===published.revision?"import_published":"import_draft",snapshot,legacy:true})
  await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run("cms_change_initialized","true")
}
export async function cmsChangeById(db,id) {
  if(typeof id!=="string"||!/^cms_change:[0-9]{13}:[a-z0-9-]+$/.test(id))return null
  return setting(db,id,null)
}
export async function cmsChanges(db,cursor="") {
  if(cursor&&!/^cms_change:[0-9]{13}:[a-z0-9-]+$/.test(cursor))throw Object.assign(Error("รหัสหน้าประวัติไม่ถูกต้อง"),{status:400})
  const rows=await db.prepare("SELECT value FROM system_settings WHERE key LIKE ? AND key < ? ORDER BY key DESC LIMIT 51").all(prefix+"%",cursor||prefix+"~")
  const entries=rows.slice(0,50).map(row=>{const {snapshot,...meta}=JSON.parse(row.value);return meta})
  if(!rows.length&&!cursor&&!await setting(db,"cms_change_initialized",false)) {
    const legacy=await setting(db,"cms_history",[])
    return {entries:legacy.map(({revision,updatedAt,updatedBy})=>({id:"legacy:"+revision,kind:"cms",action:"import_published",revision,updatedAt,updatedBy})),nextCursor:null}
  }
  return {entries,nextCursor:rows.length>50?entries.at(-1).id:null}
}
export async function archivedCmsMediaUsed(db,url) {
  const rows=await db.prepare("SELECT value FROM system_settings WHERE key LIKE ?").all(prefix+"%")
  const includes=value=>typeof value==="string"?value===url:Array.isArray(value)?value.some(includes):value&&typeof value==="object"?Object.values(value).some(includes):false
  return rows.some(row=>{const entry=JSON.parse(row.value);return entry.kind!=="media"&&includes(entry.snapshot)})
}
