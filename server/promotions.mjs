import {audit} from './database.mjs'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
const key=code=>'promotion:'+code
export async function promotionsApi(db,user,req,path,body){
 if(path!=='/api/admin/promotions')return undefined
 if(user.role!=='admin')fail(403,'เฉพาะ Admin')
 if(req.method==='POST'){
  const p=await body(req),code=String(p.code||'').trim().toUpperCase()
  if(!/^[A-Z0-9_-]{3,32}$/.test(code)||!['percent','fixed'].includes(p.type)||!Number.isSafeInteger(p.value)||p.value<=0||(p.type==='percent'&&p.value>90)||!Number.isSafeInteger(p.maxUses)||p.maxUses<1||p.maxUses>100000||!Array.isArray(p.packageIds)||!p.packageIds.length||new Set(p.packageIds).size!==p.packageIds.length||p.packageIds.some(x=>typeof x!=='string'))fail(400,'ข้อมูลโปรโมชั่นไม่ถูกต้อง (ส่วนลดสูงสุด 90%)')
  if(!Number.isFinite(Date.parse(p.startsAt))||!Number.isFinite(Date.parse(p.endsAt))||Date.parse(p.endsAt)<=Date.parse(p.startsAt))fail(400,'ช่วงเวลาโปรโมชั่นไม่ถูกต้อง')
  for(const id of p.packageIds)if(!(await db.prepare('SELECT id FROM package_catalog WHERE id=? AND amount>0').get(id)))fail(400,'เลือกแพ็กเกจที่มีค่าใช้จ่าย')
  await db.transaction(async()=>{
   const prior=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(code)),revision=prior?JSON.parse(prior.value).revision:0
   if(p.revision!==revision)fail(409,'โปรโมชั่นเปลี่ยนแล้ว กรุณาโหลดล่าสุด')
   const value={code,type:p.type,value:p.value,maxUses:p.maxUses,packageIds:p.packageIds,startsAt:new Date(p.startsAt).toISOString(),endsAt:new Date(p.endsAt).toISOString(),active:p.active===true,revision:revision+1,updatedBy:user.name}
   await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key(code),JSON.stringify(value));await audit(db,user,'promotion.save',code)
  })
 }
 const rows=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'promotion:%'").all();return {promotions:rows.map(r=>JSON.parse(r.value))}
}
export async function quoteCoupon(db,code,ownerId,plan){
 if(!code)return null
 code=String(code).trim().toUpperCase();const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(code));const p=row?JSON.parse(row.value):null,now=Date.now()
 if(!p||!p.active||now<Date.parse(p.startsAt)||now>=Date.parse(p.endsAt)||!p.packageIds.includes(plan.id)||plan.amount<=0)fail(400,'คูปองหมดอายุ ยังไม่เริ่ม หรือใช้กับแพ็กเกจนี้ไม่ได้ กรุณาเปลี่ยนหรือล้างคูปอง')
 const rows=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'invoice_discount:%'").all(),uses=rows.map(r=>JSON.parse(r.value)).filter(x=>x.code===code)
 if(uses.length>=p.maxUses||uses.some(x=>x.ownerId===ownerId))fail(409,'คูปองใช้ครบแล้วหรือบัญชีนี้เคยใช้แล้ว')
 const discount=p.type==='percent'?Math.floor(plan.amount*p.value/100):p.value
 // Keep positive invoices in the existing manual-review lifecycle.
 if(discount<=0||discount>=plan.amount)fail(400,'ส่วนลดต้องน้อยกว่ายอดแพ็กเกจ')
 return {code,ownerId,originalAmount:plan.amount,discount,amount:plan.amount-discount,promotionRevision:p.revision}
}
export async function selectCoupon(db,ownerId,plan,code){
 await quoteCoupon(db,code,ownerId,plan)
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('merchant_coupon:'+ownerId,JSON.stringify(code?String(code).trim().toUpperCase():''))
}
