const origin=process.env.PUBLIC_URL||'https://design-villacheck.vercel.app'
if(!origin.startsWith('https://')&&!origin.startsWith('http://127.0.0.1:'))throw Error('Use HTTPS')
const failed=[]
for(const [path,key]of [['/api/health','ok'],['/api/public/cms','content'],['/api/packages','packages']]){
 try{const r=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||!d[key])failed.push(path)}catch{failed.push(path)}
}
if(failed.length&&process.env.ALERT_WEBHOOK_URL){try{const u=new URL(process.env.ALERT_WEBHOOK_URL);if(u.protocol!=='https:')throw Error('HTTPS required');await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'villacheck_health_failure',paths:failed,at:new Date().toISOString()}),signal:AbortSignal.timeout(10000)})}catch{console.error('Alert delivery failed; inspect operator configuration')}}
console.log(JSON.stringify({ok:!failed.length,failed}));if(failed.length)process.exitCode=1
