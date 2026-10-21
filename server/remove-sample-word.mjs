// Only display fields are changed; identifiers, authentication and payment records stay intact.
const clean=value=>!value.includes('ตัวอย่าง')?value:value.replaceAll('ตัวอย่าง','').replace(/ {2,}/g,' ').trim();
const cleanTree=value=>typeof value==='string'?clean(value):Array.isArray(value)?value.map(cleanTree):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,cleanTree(item)])):value;
export async function removeSampleWord(db){
 let changed=0;
 await db.transaction(async()=>{
  for(const [table,fields] of [['users',['name','business_name','business_name_en']],['villas',['name','name_en','merchant','bank_name','account_name']],['leads',['name','notes']]])for(const field of fields){const result=await db.prepare(`UPDATE ${table} SET ${field}=TRIM(REPLACE(${field},?,?)) WHERE ${field} LIKE ?`).run('ตัวอย่าง','','%ตัวอย่าง%');changed+=result.changes;}
  const rows=await db.prepare("SELECT key,value FROM system_settings WHERE key IN ('cms_published','cms_draft','cms_history') OR key LIKE 'advertisement:%'").all();
  for(const row of rows){if(!row.value.includes('ตัวอย่าง'))continue;const data=JSON.parse(row.value);const next=cleanTree(data);if(next&&typeof next==='object'&&!Array.isArray(next)&&typeof next.revision==='number')next.revision++;await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(next),row.key);changed++;}
 });return changed;
}
