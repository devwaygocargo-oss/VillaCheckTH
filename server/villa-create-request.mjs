// Payload-bound replay protection; caller owns the enclosing DB transaction.
import {createHash} from 'node:crypto';
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export function villaCreateRequest(user,data){
 if(data.requestKey===undefined)return null;
 if(typeof data.requestKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.requestKey))fail(400,'รหัสคำขอไม่ถูกต้อง');
 const {requestKey,...payload}=data;
 return {key:'villa_create_request:'+user.id+':'+requestKey,hash:createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex')};
}
export async function replayedVillaCreate(db,user,data,allowedIds){
 const token=villaCreateRequest(user,data);if(!token)return null;
 const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(token.key);if(!row)return null;
 const saved=JSON.parse(row.value);if(saved.hash!==token.hash)fail(409,'คำขอเดิมมีข้อมูลต่างกัน กรุณาส่งคำขอใหม่');
 if(!saved.villaId)fail(409,'คำขอกำลังดำเนินการ กรุณาลองอีกครั้ง');
 const villa=await db.prepare('SELECT id,owner_id FROM villas WHERE id=?').get(saved.villaId);
 if(!villa||villa.owner_id!==user.id||(allowedIds&&!allowedIds.includes(villa.id)))fail(409,'ไม่พบผลคำขอเดิมในสิทธิ์บัญชี');
 return villa.id;
}
export async function reserveVillaCreate(db,user,data){
 const token=villaCreateRequest(user,data);if(!token)return {token:null,replayId:null};
 const inserted=await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING RETURNING key').get(token.key,JSON.stringify({hash:token.hash,villaId:null}));
 return {token,replayId:inserted?null:await replayedVillaCreate(db,user,data)};
}
export async function completeVillaCreate(db,token,villaId){if(token)await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({hash:token.hash,villaId}),token.key)}
