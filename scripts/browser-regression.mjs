// Local synthetic browser acceptance. Run via scripts/test-postgres.mjs --browser.
import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {createServer} from "node:net"
import {mkdtempSync,rmSync,writeFileSync,mkdirSync,existsSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {openTestDatabase} from "../server/test-database.mjs"
import {seedDemo} from "../server/demo-seed.mjs"
const chromePath=process.env.VILLACHECK_CHROME_PATH||"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if(!process.env.TEST_DATABASE_URL||!["127.0.0.1","localhost"].includes(new URL(process.env.TEST_DATABASE_URL).hostname))throw Error("Disposable localhost test database required")
if(!existsSync(chromePath))throw Error("Chrome unavailable; browser acceptance cannot run")
const reserve=async()=>{const s=createServer();await new Promise(r=>s.listen(0,"127.0.0.1",r));const p=s.address().port;await new Promise(r=>s.close(r));return p}
const delay=ms=>new Promise(r=>setTimeout(r,ms))
async function until(fn,message,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){try{const value=await fn();if(value)return value}catch{}await delay(100)}throw Error(message)}
const db=await openTestDatabase(),profile=mkdtempSync(join(tmpdir(),"villacheck-chrome-")),port=await reserve(),debugPort=await reserve(),base=`http://127.0.0.1:${port}`,results=[]
let next,chrome,ws
const stop=async child=>{if(child&&child.exitCode===null){child.kill("SIGTERM");await Promise.race([new Promise(r=>child.once("exit",r)),delay(5000)])}}
try {
 const password="LocalBrowserFixture123"
 await seedDemo(db,{password,adminEmail:"browser-admin@example.test",adminPassword:password})
 const expected=Number((await db.prepare("SELECT count(*) AS n FROM leads").get()).n)
 const env={...process.env,NODE_ENV:"test",APP_URL:base,DATABASE_URL:db.testConnectionString,DIRECT_URL:db.testConnectionString,VillaCheck_DATABASE_URL:db.testConnectionString,NEXT_TELEMETRY_DISABLED:"1",SMTP_HOST:"",SMTP_FROM:"",SMTP_USER:"",SMTP_PASSWORD:"",OMISE_TEST_ENABLED:"false",OMISE_TEST_SECRET_KEY:"",SEED_PUBLIC_DEMO_DATA:"false",SEED_DEMO_ACCOUNTS:"false",ADMIN_EMAIL:"",ADMIN_PASSWORD:""}
 next=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--port",String(port),"--hostname","127.0.0.1"],{env,stdio:"ignore"})
 await until(async()=>(await fetch(base+"/api/health")).ok,"Local Next did not start")
 chrome=spawn(chromePath,["--headless=new","--disable-gpu","--disable-background-networking","--disable-sync","--no-first-run","--no-default-browser-check",`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,"about:blank"],{stdio:"ignore"})
 const target=await until(async()=>{const r=await fetch(`http://127.0.0.1:${debugPort}/json/list`);return (await r.json()).find(t=>t.type==="page")},"Chrome CDP unavailable")
 assert(target)
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener("open",r,{once:true});ws.addEventListener("error",j,{once:true})})
 let sequence=0;const callbacks=new Map()
 ws.addEventListener("message",event=>{const message=JSON.parse(event.data);if(message.id){const c=callbacks.get(message.id);if(c){callbacks.delete(message.id);clearTimeout(c.timer);message.error?c.reject(Error(message.error.message)):c.resolve(message.result)}}})
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{callbacks.delete(id);reject(Error("CDP command timed out: "+method))},10000);callbacks.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))})
 const evaluate=async expression=>(await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true})).result.value
 await send("Network.enable");await send("Page.enable");await send("Runtime.enable")
 const login=async(email,admin=false)=>{const r=await fetch(base+(admin?"/api/auth/admin-login":"/api/auth/login"),{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:JSON.stringify({email,password})});assert.equal(r.status,200);const pair=r.headers.get("set-cookie").split(";")[0],index=pair.indexOf("=");await send("Network.setCookie",{name:pair.slice(0,index),value:pair.slice(index+1),url:base,httpOnly:true,sameSite:"Lax"})}
 await login("browser-admin@example.test",true)
 await send("Page.navigate",{url:base+"/admin#page=admin-leads"})
 const leadCount=()=>evaluate("document.querySelectorAll('.lead-card').length")
 await until(async()=>await leadCount()===expected,"Leads direct link did not load")
 await send("Page.reload",{ignoreCache:true});await until(async()=>await leadCount()===expected,"Leads refresh lost records")
 results.push({name:"Admin Leads direct link and reload",passed:true,count:expected})
 await login("demo-merchant@villacheck.example")
 await send("Page.navigate",{url:base+"/#page=owner-package"})
 const basic=await until(()=>evaluate("document.querySelector('[data-plan-id=basic]')?.textContent"),"Merchant pricing missing")
 assert.match(basic,/990/);assert.match(basic,/ลด 100%/);assert.match(basic,/สุทธิ ฿0/)
 results.push({name:"Merchant Basic regular/discount/net pricing",passed:true})
 await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await until(()=>evaluate("window.innerWidth===390"),"Mobile viewport missing")
 assert(await evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),"Merchant pricing overflows mobile viewport")
 results.push({name:"Merchant pricing mobile width 390",passed:true})
 const villa=await db.prepare("SELECT qr FROM villas WHERE name='Sea Sky Demo Villa'").get()
 await send("Page.navigate",{url:base+"/#page=verify&item="+encodeURIComponent(villa.qr)})
 await until(()=>evaluate("document.body.innerText.includes('ข้อมูลส่วนบุคคลถูกปกปิด')"),"Public QR privacy UI missing")
 assert.equal(await evaluate("document.body.innerText.includes('เพื่อดูเบอร์โทรและเลขบัญชีเต็ม')"),false)
 results.push({name:"Public QR uses masked data and pre-transfer check guidance",passed:true})
 mkdirSync("docs/validation",{recursive:true})
 writeFileSync("docs/validation/local-browser-2026-10-24.json",JSON.stringify({localSyntheticDataOnly:true,results},null,2)+"\n")
 console.log(JSON.stringify({browser:"Chrome headless",results}))
}finally{ws?.close();await stop(chrome);await stop(next);await db.close();rmSync(profile,{recursive:true,force:true})}
