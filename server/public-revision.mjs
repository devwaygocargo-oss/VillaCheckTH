// Approved public state is independent of the mutable draft. Never return private snapshots directly.
export async function publicRevision(db,current,context){
 if(!current)return null
 if(!["approved","pending","changes","rejected"].includes(current.status))return current
 const reversed=context?context.holds.has(current.id):await db.prepare("SELECT id FROM invoices WHERE villa_id=? AND status='paid' AND payment_status='FAILED' LIMIT 1").get(current.id)
 if(reversed)return {...current,status:"pending"}
 if(current.status==="approved")return current
 const snapshot=context?context.snapshots.get(current.id):JSON.parse((await db.prepare("SELECT value FROM system_settings WHERE key=?").get("villa_approved:"+current.id))?.value||"null")
 if(!snapshot)return current
 return {...snapshot.villa,_approvedSnapshot:snapshot}
}
export async function resolvePublicQr(db,qr){
 let current=await db.prepare("SELECT * FROM villas WHERE qr=?").get(qr)
 if(!current){const alias=await db.prepare("SELECT value FROM system_settings WHERE key=?").get("qr_alias:"+qr);if(alias)current=await db.prepare("SELECT * FROM villas WHERE id=?").get(JSON.parse(alias.value).villaId)}
 if(!current&&/^VC-[a-zA-Z0-9-]{1,100}$/.test(qr)){
  const history=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'villa_approved_history:%' AND value LIKE ?").all('%"qr":"'+qr+'"%')
  const snapshot=history.map(r=>JSON.parse(r.value)).find(s=>s.villa.qr===qr)
  if(snapshot)current=await db.prepare("SELECT * FROM villas WHERE id=?").get(snapshot.villa.id)
 }
 return publicRevision(db,current)
}
export async function publishedVillas(db){
 const [current,rows,blocked]=await Promise.all([db.prepare("SELECT * FROM villas WHERE qr IS NOT NULL ORDER BY created DESC,id DESC").all(),db.prepare("SELECT key,value FROM system_settings WHERE key LIKE 'villa_approved:%'").all(),db.prepare("SELECT DISTINCT villa_id FROM invoices WHERE status='paid' AND payment_status='FAILED'").all()])
 const context={snapshots:new Map(rows.map(r=>[r.key.slice('villa_approved:'.length),JSON.parse(r.value)])),holds:new Set(blocked.map(r=>r.villa_id))}
 return (await Promise.all(current.map(v=>publicRevision(db,v,context)))).filter(v=>v.status==="approved")
}
export async function rememberQr(db,villa){
 if(!villa?.qr)return
 await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run("qr_alias:"+villa.qr,JSON.stringify({villaId:villa.id}))
}
