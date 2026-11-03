const origin=process.env.PUBLIC_URL||"https://design-villacheck.vercel.app"
const url=new URL(origin)
if(url.protocol!=="https:"&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error("Use HTTPS for hosted health checks")
const results=[]
for(const [path,key] of [["/api/health","ok"],["/api/public/cms","content"],["/api/packages",null],["/api/public/villas","villas"]]){
 try{const r=await fetch(new URL(path,url),{signal:AbortSignal.timeout(15000)});const data=await r.json();results.push({path,status:r.status,passed:key?r.ok&&Boolean(data[key]):r.status===401&&!Object.hasOwn(data,"packages")})}catch{results.push({path,passed:false,error:"timeout/network/invalid response"})}
}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),results},null,2))
if(results.some(r=>!r.passed))process.exitCode=1
