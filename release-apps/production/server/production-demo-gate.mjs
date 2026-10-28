// Owner-confirmed Option A: zero Production demo/test data.
// This code policy does not authorize settings writes, deployment or initialization.
export function productionDemoApproval(env={}){
 const state=env.PRODUCTION_DEMO_DATA_APPROVAL??'ZERO_DEMO_DATA'
 if(state!=='ZERO_DEMO_DATA')throw Error('Production demo approval is not implemented or authorized')
 return state
}
export async function verifyProductionDemoGate(db){
 const flags=await db.prepare("SELECT key,value FROM system_settings WHERE key IN ('demo_mode','public_demo_villas_visible')").all()
 if(flags.some(x=>x.value!=='false'))throw Error('Production demo flags must remain disabled')
 for(const table of ['users','villas'])if(await db.prepare(`SELECT id FROM ${table} WHERE lower(email) LIKE '%@villacheck.example' LIMIT 1`).get())throw Error('Production demo records are not authorized')
 return {approval:'ZERO_DEMO_DATA',demoRecordsAllowed:false,publicDemoAllowed:false}
}

export function assertDemoSeedAllowed(env={},identity){
 if(env.APP_ENV==='production')throw Error('Production Demo seed is blocked by confirmed ZERO_DEMO_DATA policy')
 let u;const value=env.DATABASE_URL||env.VillaCheck_DATABASE_URL
 if(value){try{u=new URL(value)}catch{throw Error('Demo seed target must be valid and explicit')}}
 const candidates=[identity,...(u?[{host:u.hostname,database:decodeURIComponent(u.pathname.slice(1)),role:decodeURIComponent(u.username)}]:[])].filter(Boolean)
 if(candidates.some(x=>(x.host||'').includes('ep-square-resonance-aohwf0z5')||x.database==='villacheck_production'||['villacheck_owner','villacheck_runtime','villacheck_audit','villacheck_backup'].includes(x.role)))throw Error('Production credential/target cannot be used for Demo seed')
 return {productionSeedAllowed:false}
}
