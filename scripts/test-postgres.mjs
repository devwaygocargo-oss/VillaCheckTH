// Disposable local PostgreSQL only. Never reads .env or an existing database URL.
import EmbeddedPostgres from "embedded-postgres"
import { mkdtempSync, rmSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import { createServer } from "node:net"
import { spawn } from "node:child_process"
const reserve=createServer()
await new Promise(resolve=>reserve.listen(0,"127.0.0.1",resolve))
const port=reserve.address().port
await new Promise(resolve=>reserve.close(resolve))
const directory=mkdtempSync(join(tmpdir(),"villacheck-regression-pg-")),password=randomBytes(24).toString("hex")
const postgres=new EmbeddedPostgres({databaseDir:join(directory,"database"),user:"postgres",password,port,persistent:false,postgresFlags:["-h","127.0.0.1"],onLog:()=>{},onError:()=>{}})
try {
 await postgres.initialise();await postgres.start()
 const url=`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`
 const isolatedEnv={...process.env,TEST_DATABASE_URL:url,DATABASE_URL:url,DIRECT_URL:url,VillaCheck_DATABASE_URL:url,NEXT_TELEMETRY_DISABLED:"1",SMTP_HOST:"",SMTP_FROM:"",SMTP_USER:"",SMTP_PASSWORD:"",OTP_SECRET:"",APP_ENV:"test",PAYMENT_ACCESS_MODE:"",OMISE_TEST_ENABLED:"false",OMISE_TEST_SECRET_KEY:"",SEED_PUBLIC_DEMO_DATA:"false"}
 const tests=readdirSync("server").filter(file=>file.endsWith(".test.mjs")).map(file=>"server/"+file)
 const child=spawn(process.execPath,["--test","--test-concurrency=2",...tests],{stdio:"inherit",env:isolatedEnv})
 const exitCode=await new Promise((resolve,reject)=>{child.once("exit",resolve);child.once("error",reject)})
 process.exitCode=exitCode??1
 if(exitCode===0 && ["--browser","--payment-browser","--all-browsers"].some(flag=>process.argv.includes(flag))) {
  const scripts=process.argv.includes("--all-browsers")?["scripts/browser-regression.mjs","scripts/payment-browser-regression.mjs"]:[process.argv.includes("--payment-browser")?"scripts/payment-browser-regression.mjs":"scripts/browser-regression.mjs"]
  for(const script of scripts){
   const browser=spawn(process.execPath,[script],{stdio:"inherit",env:{...isolatedEnv,...(process.argv.includes("--all-browsers")?{VILLACHECK_BROWSER_EVIDENCE_DIR:"docs/validation/phase3/general"}:{})}})
   process.exitCode=await new Promise((resolve,reject)=>{browser.once("exit",resolve);browser.once("error",reject)})??1
   if(process.exitCode)break
  }
 }
}finally{await postgres.stop().catch(()=>{});rmSync(directory,{recursive:true,force:true})}
