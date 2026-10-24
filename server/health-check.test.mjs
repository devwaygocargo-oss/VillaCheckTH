import test from "node:test"
import assert from "node:assert/strict"
import {createServer} from "node:http"
import {execFile} from "node:child_process"
import {promisify} from "node:util"
const execute=promisify(execFile)
test("public health probe accepts protected pricing denial and fails on backend outage or leaked pricing",async t=>{
 let mode="healthy"
 const server=createServer((req,res)=>{
  res.setHeader("Content-Type","application/json")
  if(req.url==="/api/packages"){res.statusCode=mode==="leak"?200:401;return res.end(JSON.stringify(mode==="leak"?{packages:[]}:{error:"Sign in"}))}
  if(req.url==="/api/health"){res.statusCode=mode==="outage"?503:200;return res.end(JSON.stringify({ok:mode!=="outage"}))}
  res.end(JSON.stringify(req.url==="/api/public/cms"?{content:{}}:{villas:[]}))
 })
 await new Promise(r=>server.listen(0,"127.0.0.1",r));t.after(()=>new Promise(r=>server.close(r)))
 const run=()=>execute(process.execPath,["scripts/health-check.mjs"],{env:{...process.env,PUBLIC_URL:`http://127.0.0.1:${server.address().port}`}})
 const report=JSON.parse((await run()).stdout);assert(report.results.every(r=>r.passed));assert.equal(report.results.find(r=>r.path==="/api/packages").status,401)
 for(const value of ["outage","leak"]){mode=value;await assert.rejects(run(),error=>{assert.equal(error.code,1);assert(JSON.parse(error.stdout).results.some(r=>!r.passed));return true})}
})
