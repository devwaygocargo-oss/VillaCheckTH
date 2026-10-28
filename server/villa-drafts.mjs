import {audit} from './database.mjs';
import {assertWriteSession} from './write-session.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const limits={name:200,nameEn:200,province:100,merchant:200,email:320,phone:30,guestCapacity:4};
export async function villaDraft(db,user,req,body){
 if(user.role!=='merchant')fail(403,'เฉพาะผู้ประกอบการเท่านั้น');
 const key='merchant_villa_draft:'+user.id;
 if(req.method==='GET'){const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);const draft=row?JSON.parse(row.value):null;return {draft:draft?.submittedVillaId?{revision:draft.revision,fields:{},updatedAt:draft.updatedAt}:draft}}
 if(req.method!=='POST')fail(405,'วิธีการเรียกใช้ไม่ถูกต้อง');
 const data=await body(req);if(!data||typeof data.fields!=='object'||!data.fields||Array.isArray(data.fields)||Object.keys(data).some(k=>!['fields','expectedRevision'].includes(k))||Object.keys(data.fields).some(k=>!Object.hasOwn(limits,k)))fail(400,'ข้อมูลฉบับร่างไม่ถูกต้อง');
 const fields={};for(const[k,max]of Object.entries(limits)){const value=data.fields[k]??'';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail(400,'ข้อมูลฉบับร่างยาวเกินกำหนดหรือไม่ถูกต้อง');fields[k]=value.trim()}
 if(fields.guestCapacity&&!/^[1-9]\d{0,2}$|^1000$/.test(fields.guestCapacity))fail(400,'จำนวนผู้พักต้องเป็นจำนวนเต็ม 1 ถึง 1000');
 return db.transaction(async()=>{await assertWriteSession(db,user);const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key),current=row?JSON.parse(row.value):null;
 if(data.expectedRevision!==(current?.revision??0))fail(409,'ฉบับร่างเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก');
 const draft={fields,revision:(current?.revision??0)+1,updatedAt:new Date().toISOString()};await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(draft));await audit(db,user,'villa.draft_saved',user.id);return {draft};});
}

// Called only inside successful Villa creation transaction; a newer draft is never consumed.
export async function markVillaDraftSubmitted(db,user,data,id){
 if(data.draftRevision===undefined)return;
 if(!Number.isSafeInteger(data.draftRevision)||data.draftRevision<0)fail(400,'รุ่นฉบับร่างไม่ถูกต้อง');
 const key='merchant_villa_draft:'+user.id,row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key),draft=row?JSON.parse(row.value):null;
 if(!draft||draft.revision!==data.draftRevision)return;
 await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...draft,revision:draft.revision+1,submittedVillaId:id,submittedAt:new Date().toISOString()}),key);
}
