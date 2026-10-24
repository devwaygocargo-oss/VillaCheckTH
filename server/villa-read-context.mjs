// Request-scoped batches: no cross-request caching of QR status or permissions.
export async function selectByIds(db, prefix, ids, suffix="") {
  const unique=[...new Set(ids.filter(Boolean))],rows=[];
  for(let offset=0;offset<unique.length;offset+=200){
    const chunk=unique.slice(offset,offset+200);
    rows.push(...await db.prepare(`${prefix} IN (${chunk.map(()=>"?").join(",")})${suffix}`).all(...chunk));
  }
  return rows;
}
export async function loadTrustContext(db,villas,{reviews=false,qr=true}={}) {
  if(!villas.length)return {subscriptions:new Map(),plans:new Map(),settings:new Map()};
  const [subscriptions,plans,settings]=await Promise.all([
    selectByIds(db,"SELECT owner_id,lifecycle FROM subscriptions WHERE owner_id",villas.map(v=>v.owner_id)),
    db.prepare("SELECT * FROM package_catalog").all(),
    selectByIds(db,"SELECT key,value FROM system_settings WHERE key",villas.flatMap(v=>[`account_status:${v.owner_id}`,...(qr?[`villa_qr:${v.id}`]:[]),...(reviews?[`villa_review:${v.id}`]:[])])),
  ]);
  return {subscriptions:new Map(subscriptions.map(row=>[row.owner_id,row])),plans:new Map(plans.map(row=>[row.id,row])),settings:new Map(settings.map(row=>[row.key,row]))};
}
