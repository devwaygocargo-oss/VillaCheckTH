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
const evidenceDir=process.env.VILLACHECK_PAYMENT_EVIDENCE_DIR||"docs/validation/phase3"
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

 await login("demo-merchant@villacheck.example")
 const villa=await db.prepare("SELECT id FROM villas WHERE name='Sea Sky Demo Villa'").get(),invoiceId="9c88f4d4-74f0-41fe-afb3-9031f746ed91"
 await db.prepare("INSERT INTO invoices(id,villa_id,amount,months,status,package_id,created,external_provider) VALUES (?,?,199000,1,'pending','starter',?,'OMISE')").run(invoiceId,villa.id,new Date().toISOString())
 const pageUrl=base+"/#page=owner-package&item="+invoiceId
 let attempt=null,creates=0,statusReads=0,redirects=0,checkoutEnabled=true,statusFailure=false,checkoutAmount=199000
 const protocolErrors=[]
 ws.addEventListener("message",async event=>{
  const message=JSON.parse(event.data);if(message.method!=="Fetch.requestPaused")return
  try{
   const {requestId,request}=message.params;let responseCode=200,headers=[{name:"Content-Type",value:"application/json"}],value
   if(request.url.includes("api.omise.co/payments/")){
    redirects++;responseCode=302;headers=[{name:"Location",value:pageUrl+"&status=successful"}];value={}
   }else if(request.url.endsWith("/checkout"))value={enabled:checkoutEnabled,mode:"TEST",publicKey:"pkey_test_browser",methods:["promptpay","mobile_banking_scb"],invoiceId,amount:checkoutAmount,currency:"THB",paid:false}
   else if(request.url.endsWith("/omise")){
    if(request.method==="POST"){
     creates++;assert.equal(JSON.parse(request.postData).source,"src_test_browser")
     attempt={status:"pending",authorizeUri:"https://api.omise.co/payments/paym_test_browser/authorize"}
    }else statusReads++
    value=attempt||{error:"No Omise payment"};if(!attempt)responseCode=404
    if(statusFailure){responseCode=503;value={error:"Omise Test unavailable"}}
   }else{await send("Fetch.continueRequest",{requestId});return}
   await send("Fetch.fulfillRequest",{requestId,responseCode,responseHeaders:headers,body:Buffer.from(JSON.stringify(value)).toString("base64")})
  }catch(error){protocolErrors.push(error.message)}
 })
 await send("Fetch.enable",{patterns:[{urlPattern:base+"/api/payments/*/checkout"},{urlPattern:base+"/api/payments/*/omise"},{urlPattern:"https://api.omise.co/payments/*"}]})
 await send("Page.addScriptToEvaluateOnNewDocument",{source:`window.__sourceCalls=0;window.Omise={setPublicKey:key=>{if(key!=='pkey_test_browser')throw Error('wrong key')},createSource:(method,data,callback)=>{window.__sourceCalls++;if(data.amount!==199000||data.currency!=='THB')throw Error('wrong amount');setTimeout(()=>callback(200,{id:'src_test_browser',livemode:false}),50)}}`})
 await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await send("Page.navigate",{url:pageUrl})
 const status=()=>evaluate("document.querySelector('[data-testid=omise-status]')?.innerText")
 await until(()=>evaluate("[...document.querySelectorAll('button')].some(b=>b.innerText==='เริ่มชำระทดสอบ'&&!b.disabled)"),"Test checkout not ready")
 assert.equal(await evaluate("document.querySelector('[aria-label=\"วิธีชำระ Omise Test\"]').options.length"),1);results.push({name:"Checkout offers QR source only",passed:true})
 assert.equal(creates,0);results.push({name:"Checkout restores no-attempt state without creating charge",passed:true})
 await evaluate("{const b=[...document.querySelectorAll('button')].find(b=>b.innerText==='เริ่มชำระทดสอบ');b.click();b.click();}")
 await until(async()=>(await status())?.includes("รอชำระ"),"Pending status absent")
 assert.equal(creates,1);assert.equal(await evaluate("window.__sourceCalls"),1)
 results.push({name:"Rapid duplicate clicks create one source and one payment request",passed:true})
 assert(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"));results.push({name:"Payment UI mobile 390px",passed:true})
 mkdirSync(evidenceDir,{recursive:true})
 const screenshot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});writeFileSync(join(evidenceDir,"payment-test-mobile.png"),Buffer.from(screenshot.data,"base64"))
 await evaluate("document.querySelector('[data-testid=omise-redirect]').click()")
 await until(()=>evaluate("location.hash.includes('status=successful')"),"Provider return not restored")
 await until(async()=>(await status())?.includes("รอชำระ"),"Return URL falsely trusted success")
 assert.equal(redirects,1);assert.equal(creates,1);results.push({name:"Redirect returns to same invoice; URL success claim cannot mark payment paid",passed:true})
 await send("Page.reload",{ignoreCache:true});await until(async()=>(await status())?.includes("รอชำระ"),"Refresh lost pending state")
 assert.equal(creates,1);results.push({name:"Refresh retrieves pending attempt without duplicate POST",passed:true})
 for(const [state,expected]of [["failed","ชำระไม่สำเร็จ"],["successful","รอ Admin อนุมัติ Villa"],["UNKNOWN","ห้ามสร้างซ้ำ"]]){
  // Independent UI fixtures: these do not claim the provider performed a state transition.
  attempt={status:state};await evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='ตรวจสถานะล่าสุด').click()")
  await until(async()=>(await status())?.includes(expected),state+" not rendered")
  assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.innerText==='เริ่มชำระทดสอบ')"),false)
  results.push({name:state+" status and duplicate prevention",passed:true})
 }
 attempt={status:"pending",authorizeUri:"https://attacker.example.test/authorize"}
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='ตรวจสถานะล่าสุด').click()")
 await until(async()=>(await status())?.includes("รอชำระ"),"Pending fixture missing")
 assert.equal(await evaluate("!!document.querySelector('[data-testid=omise-redirect]')"),false)
 results.push({name:"Unsafe authorization URL never renders a redirect link",passed:true})
 statusFailure=true;await evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='ตรวจสถานะล่าสุด').click()")
 await until(()=>evaluate("document.querySelector('[role=alert]')?.innerText.includes('Omise Test unavailable')"),"Provider error not visible")
 results.push({name:"Payment status network/provider error is visible",passed:true})
 statusFailure=false;checkoutEnabled=false;attempt=null
 await send("Page.reload",{ignoreCache:true})
 await until(()=>evaluate("document.body.innerText.includes('ยังไม่เปิด Omise Test checkout')"),"Unconfigured checkout state missing")
 assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.innerText==='เริ่มชำระทดสอบ')"),false)
 results.push({name:"Missing configuration disables payment creation",passed:true})
 checkoutEnabled=true;checkoutAmount=0
 await send("Page.reload",{ignoreCache:true})
 await until(()=>evaluate("document.body.innerText.includes('ยอดสุทธิ 0 บาท ไม่ต้องสร้างรายการชำระ')"),"Zero checkout message missing")
 assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.innerText==='เริ่มชำระทดสอบ')"),false)
 results.push({name:"Zero-net invoice has no source/charge button",passed:true})
 assert.equal(protocolErrors.length,0);assert.equal(creates,1);assert(statusReads>=5)
 writeFileSync(join(evidenceDir,"payment-browser.json"),JSON.stringify({scope:"UI tests on local Next/Nest/PostgreSQL with checkout/status endpoints and Omise SDK/redirect mocked via CDP. No provider network or real payment.",results,creates,redirects,statusReads},null,2)+"\n")
 console.log(JSON.stringify({browser:"Chrome",results}))
}finally{ws?.close();await stop(chrome);await stop(next);await db.close();rmSync(profile,{recursive:true,force:true})}
