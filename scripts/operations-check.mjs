import {pathToFileURL} from 'node:url'
export async function checkOperations({origin='https://design-villacheck.vercel.app',alertUrl='',fetchImpl=fetch}={}){
 const target=new URL(origin)
 if(target.protocol!=='https:'&&!(target.protocol==='http:'&&['127.0.0.1','localhost'].includes(target.hostname)))throw Error('Use HTTPS for hosted monitoring')
 const failed=[]
 for(const [path,key]of [['/api/health','ok'],['/api/public/cms','content'],['/api/packages','packages']]){
  try{const r=await fetchImpl(new URL(path,target),{signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||!d[key])failed.push(path)}catch{failed.push(path)}
 }
 let alert='not-needed'
 if(failed.length){
  alert=alertUrl?'failed':'not-configured'
  if(alertUrl)try{const u=new URL(alertUrl);if(u.protocol!=='https:')throw Error('HTTPS required');const r=await fetchImpl(u,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'villacheck_health_failure',paths:failed,at:new Date().toISOString()}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Webhook rejected');alert='accepted'}catch{/* Return only a sanitized status, never the webhook URL or provider response. */}
 }
 return {ok:!failed.length,failed,alert}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const result=await checkOperations({origin:process.env.PUBLIC_URL,alertUrl:process.env.ALERT_WEBHOOK_URL});console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1}catch{console.error('Monitoring configuration invalid; URLs and secrets are not logged');process.exitCode=1}
}
