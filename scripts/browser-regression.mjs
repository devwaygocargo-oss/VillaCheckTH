// Local synthetic browser acceptance. Run via scripts/test-postgres.mjs --browser.
import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {createServer} from "node:net"
import {mkdtempSync,rmSync,writeFileSync,mkdirSync,existsSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {openTestDatabase} from "../server/test-database.mjs"
import {seedDemo} from "../server/demo-seed.mjs"
import {createUser} from "../server/database.mjs"
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
 let sequence=0;const callbacks=new Map(),pausedRequests=[]
 ws.addEventListener("message",event=>{const message=JSON.parse(event.data);if(message.method==="Fetch.requestPaused")pausedRequests.push(message.params.requestId);if(message.id){const c=callbacks.get(message.id);if(c){callbacks.delete(message.id);clearTimeout(c.timer);message.error?c.reject(Error(message.error.message)):c.resolve(message.result)}}})
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
 const villa=await db.prepare("SELECT id,qr FROM villas WHERE name='Sea Sky Demo Villa'").get()
 await send("Page.navigate",{url:base+"/#page=verify&item="+encodeURIComponent(villa.qr)})
 await until(()=>evaluate("document.body.innerText.includes('ข้อมูลส่วนบุคคลถูกปกปิด')"),"Public QR privacy UI missing")
 assert.equal(await evaluate("document.body.innerText.includes('เพื่อดูเบอร์โทรและเลขบัญชีเต็ม')"),false)
 results.push({name:"Public QR uses masked data and pre-transfer check guidance",passed:true})
 mkdirSync("docs/validation/phase2",{recursive:true})
 const invoiceId="65ef4318-3e0b-49fe-9867-912e3eeb04c1"
 await db.prepare("INSERT INTO invoices(id,villa_id,amount,months,status,package_id,created) VALUES (?,?,199000,1,'pending','starter',?)").run(invoiceId,villa.id,new Date().toISOString())
 const routes=[
  ["Homepage","/#page=home"], ["Registration User","/#page=user-registration"],
  ["Registration Merchant","/#page=owner-registration"], ["Login","/#page=login"],
  ["Villa Listing","/#page=directory"], ["Villa Detail","/#page=detail&item="+encodeURIComponent(villa.qr)],
  ["Merchant Dashboard","/#page=owner-dashboard"], ["Pricing","/#page=owner-package"],
  ["Invoice Payment","/#page=owner-package&item="+invoiceId], ["Approval Status","/#page=owner-pending"],
  ["Admin Dashboard","/admin#page=admin-dashboard"], ["Admin Payments","/admin#page=admin-payments"]
 ]
 for(const width of [1440,390]){
  await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width<500})
  for(const [name,path] of routes){
   await send("Page.navigate",{url:base+path})
   await until(()=>evaluate("document.readyState==='complete'&&!!document.querySelector('h1')"),name+" heading missing")
   await delay(350)
   const layout=await evaluate("({heading:document.querySelector('h1')?.innerText,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText)})")
   assert(layout.heading,name+" heading empty")
   if(name==="Invoice Payment")assert(await evaluate("document.body.innerText.includes('ใบแจ้งชำระ')"),"Invoice panel missing")
   results.push({name,width,...layout,passed:layout.scrollWidth<=width+1})
   if(["Homepage","Pricing","Villa Detail","Invoice Payment","Admin Dashboard"].includes(name)){
    const shot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false})
    writeFileSync("docs/validation/phase2/"+name.replaceAll(" ","-").toLowerCase()+"-"+width+".png",Buffer.from(shot.data,"base64"))
   }
  }
 }
 await send("Page.navigate",{url:base+"/#page=verify&item=VC-NOT-FOUND"})
 await until(()=>evaluate("document.body.innerText.includes('ไม่พบ')"),"Missing QR error state absent")
 results.push({name:"Missing QR error state",passed:true})
 await send("Fetch.enable",{patterns:[{urlPattern:base+"/api/admin/leads*",requestStage:"Request"}]})
 await send("Page.navigate",{url:base+"/admin#page=admin-leads"})
 const paused=await until(()=>pausedRequests.shift(),"Leads request not intercepted")
 assert(await evaluate("document.body.innerText.includes('กำลังโหลดผู้สนใจ')"),"Leads loading state absent")
 await send("Fetch.continueRequest",{requestId:paused});await send("Fetch.disable")
 await until(async()=>await leadCount()===expected,"Leads did not recover after loading")
 results.push({name:"Leads loading state with delayed real request",passed:true})
 await send("Network.setBlockedURLs",{urls:["*api/admin/leads*"]})
 await send("Page.reload",{ignoreCache:true})
 await until(()=>evaluate("!!document.querySelector('[role=alert]')"),"Leads network error not visible")
 assert.equal(await leadCount(),0,"Error must not show a misleading empty list")
 await send("Network.setBlockedURLs",{urls:[]})
 results.push({name:"Leads network error state",passed:true})
 await createUser(db,"browser-empty@example.test",password,"Empty QA Merchant")
 await login("browser-empty@example.test")
 await send("Page.navigate",{url:base+"/#page=owner-villas"})
 await until(()=>evaluate("document.body.innerText.includes('เริ่มต้นจาก Villa แรก')"),"Empty Merchant state missing")
 results.push({name:"Merchant empty state",passed:true})
 assert(results.every(result=>result.passed),"Responsive QA has failed cases; inspect evidence")
 writeFileSync("docs/validation/phase2/browser.json",JSON.stringify({localSyntheticDataOnly:true,results},null,2)+"\n")
 mkdirSync("docs/validation",{recursive:true})

 console.log(JSON.stringify({browser:"Chrome headless",results}))
}finally{ws?.close();await stop(chrome);await stop(next);await db.close();rmSync(profile,{recursive:true,force:true})}
