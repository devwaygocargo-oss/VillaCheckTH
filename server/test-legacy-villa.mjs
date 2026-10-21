import {randomUUID} from 'node:crypto';
// Legacy accounts may already own multiple properties. Seed them directly in tests;
// the current create API intentionally permits only the first property.
export async function legacyVilla(db,sourceId,name){const row=await db.prepare('SELECT * FROM villas WHERE id=?').get(sourceId);Object.assign(row,{id:randomUUID(),name,status:'pending',reason:'',qr:null,expires:null,payments:0,package_id:'basic',created:new Date().toISOString()});const keys=Object.keys(row);await db.prepare('INSERT INTO villas('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...keys.map(key=>row[key]));return row.id;}
