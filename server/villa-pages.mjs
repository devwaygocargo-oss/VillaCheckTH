import {preserveApprovedVilla,rotateApprovedRevision} from "./approval-history.mjs"
import {dummyPropertyDetails} from './property-details.mjs'
import {audit} from './database.mjs'
import {recordCmsChange,cmsChangeById} from './cms-change-history.mjs'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
export async function villaPage(db,villa){const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_page:'+villa.id);return row?JSON.parse(row.value).details:dummyPropertyDetails(villa)}
export async function villaPagesApi(db,user,req,path,url,body){
 if(path!=='/api/admin/villa-pages')return undefined
 if(!user||user.role!=='admin')fail(403,'เฉพาะ Admin')
 if(req.method==='GET'){
  const requested=url.searchParams.get('villaId')
  const villas=await db.prepare('SELECT id,name,name_en,province,package_id,status,qr,photo_url,guest_capacity,merchant,email FROM villas WHERE id=? ORDER BY name,id').all(requested||'')
  const saved=new Map((await db.prepare('SELECT key,value FROM system_settings WHERE key=?').all('villa_page:'+(requested||''))).map(r=>[r.key,JSON.parse(r.value)]))
  return {villas:villas.map(v=>({...v,details:saved.get('villa_page:'+v.id)?.details||dummyPropertyDetails(v)}))}
 }
 if(req.method!=='POST')fail(405,'ไม่รองรับคำสั่งนี้')
 return db.transaction(async()=>{
  let data=await body(req)
  const restoring=Boolean(data.historyId)
  if(data.historyId){const entry=await cmsChangeById(db,data.historyId);if(entry?.kind!=='villa_page')fail(404,'ไม่พบประวัติหน้าที่พัก');data=entry.snapshot}
  const villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(data.id);if(!villa)fail(404,'ไม่พบที่พัก')
  const d=data.details;if(!d||typeof d!=='object')fail(400,'ข้อมูลรายละเอียดไม่ถูกต้อง')
  const details={isDemo:Boolean(dummyPropertyDetails(villa))}
  for(const k of ['description','location','checkIn','checkOut','notice']){if(typeof d[k]!=='string'||d[k].length>5000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(d[k]))fail(400,'ข้อความไม่ถูกต้อง');details[k]=d[k].trim()}
  for(const k of ['guestCapacity','bedrooms','bathrooms']){if(!Number.isInteger(d[k])||d[k]<0||d[k]>10000)fail(400,'จำนวนไม่ถูกต้อง');details[k]=d[k]}
  for(const k of ['amenities','rules']){if(!Array.isArray(d[k])||d[k].length>100||d[k].some(v=>typeof v!=='string'||v.length>500||/[\x00-\x1f]/.test(v)))fail(400,'รายการไม่ถูกต้อง');details[k]=d[k].map(v=>v.trim()).filter(Boolean)}
  await preserveApprovedVilla(db,villa)
  const previous=await villaPage(db,villa)
  if(previous)await recordCmsChange(db,{kind:'villa_page',action:'before_edit',snapshot:{id:villa.id,name:villa.name,details:previous},user})
  const snapshot={id:villa.id,name:villa.name,details}
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('villa_page:'+villa.id,JSON.stringify(snapshot))
  await recordCmsChange(db,{kind:'villa_page',action:restoring?'restore':'save',snapshot,user});await audit(db,user,'villa_page.save',villa.id)
  const qr=await rotateApprovedRevision(db,villa,user,"DETAILS_APPROVED")
  return {ok:true,details,qr}
 })
}
