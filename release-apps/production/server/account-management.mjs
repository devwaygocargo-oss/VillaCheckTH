import {audit} from './database.mjs'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
const clean=(value,label,max=200,required=true)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim())||/[\x00-\x1f]/.test(value))fail(400,'กรุณาระบุ'+label+'ให้ถูกต้อง');return value.trim()}
export async function accountManagement(db,user,req,path,url,body){
 if(!/^\/api\/admin\/accounts(?:\/|$)/.test(path))return undefined
 if(user.role!=='admin')fail(403,'เฉพาะ Admin')
 if(path==='/api/admin/accounts'&&req.method==='GET'){
  const role=url.searchParams.get('role');if(!['user','merchant'].includes(role))fail(400,'ประเภทบัญชีไม่ถูกต้อง')
  const rows=await db.prepare('SELECT id,name,email,role,phone,address,business_name,business_name_en,created,last_login FROM users WHERE role=? ORDER BY created DESC').all(role)
  const statuses=new Map((await db.prepare("SELECT key,value FROM system_settings WHERE key LIKE 'account_status:%'").all()).map(r=>[r.key,JSON.parse(r.value)]))
  return {accounts:rows.map(row=>({...row,access:statuses.get('account_status:'+row.id)||{status:'active',reason:''}}))}
 }
 const match=path.match(/^\/api\/admin\/accounts\/([a-f0-9-]{36})$/)
 if(match&&req.method==='POST')return db.transaction(async()=>{
  const target=await db.prepare('SELECT * FROM users WHERE id=?').get(match[1]);if(!target||!['user','merchant'].includes(target.role))fail(404,'ไม่พบบัญชี User หรือ Merchant')
  const data=await body(req)
  if(data.action==='profile'){
   const name=clean(data.name,'ชื่อ'),phone=clean(data.phone||'','เบอร์โทร',30,false),address=clean(data.address||'','ที่อยู่',2000,false)
   if(target.role==='merchant')await db.prepare('UPDATE users SET name=?,phone=?,address=?,business_name=?,business_name_en=? WHERE id=?').run(name,phone,address,clean(data.businessName,'ชื่อบริษัทภาษาไทย'),clean(data.businessNameEn,'ชื่อบริษัทภาษาอังกฤษ'),target.id)
   else await db.prepare('UPDATE users SET name=?,phone=?,address=? WHERE id=?').run(name,phone,address,target.id)
   await audit(db,user,'account.profile_update',target.id)
  }else if(data.action==='access'){
   if(!['active','suspended'].includes(data.status))fail(400,'สถานะไม่ถูกต้อง')
   const reason=clean(data.reason,'เหตุผล',2000)
   await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('account_status:'+target.id,JSON.stringify({status:data.status,reason,updatedAt:new Date().toISOString(),updatedBy:user.id}))
   if(data.status==='suspended')await db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id)
   await audit(db,user,'account.'+data.status,target.id)
  }else fail(400,'คำขอไม่ถูกต้อง')
  return {ok:true}
 })
 fail(404,'ไม่พบ API จัดการบัญชี')
}
