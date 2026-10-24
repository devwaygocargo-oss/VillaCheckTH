import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
test('legacy Vite/Render configurator cannot overwrite the current Next deployment configuration',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'villacheck-staging-config-'))
 try{
  writeFileSync(join(cwd,'package.json'),JSON.stringify({dependencies:{next:'16'}}))
  const original=JSON.stringify({framework:'nextjs',outputDirectory:'.next',functions:{'pages/api/**/*.ts':{maxDuration:60}}})
  writeFileSync(join(cwd,'vercel.json'),original)
  const result=spawnSync(process.execPath,[resolve('scripts/configure-vercel.mjs'),'https://backend.example.test'],{cwd,encoding:'utf8'})
  assert.notEqual(result.status,0);assert.match(result.stderr,/Next.js/)
  assert.equal(readFileSync(join(cwd,'vercel.json'),'utf8'),original)
 }finally{rmSync(cwd,{recursive:true,force:true})}
})
