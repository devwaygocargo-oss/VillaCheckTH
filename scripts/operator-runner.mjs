import {readFileSync,appendFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {parse} from 'dotenv'
const [job,configFile]=process.argv.slice(2)
if(!['backup','monitor'].includes(job)||!configFile)throw Error('Use operator-runner.mjs backup|monitor /private/operator.env')
const root=fileURLToPath(new URL('..',import.meta.url)),settings=parse(readFileSync(configFile)),env={...process.env,...settings}
const child=spawn(process.execPath,[join(root,'scripts',job==='backup'?'scheduled-backup.mjs':'operations-check.mjs')],{cwd:root,env,stdio:['ignore','pipe','pipe']})
let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',()=>{/* Never forward provider diagnostics or configuration values. */})
const code=await new Promise(resolve=>{child.on('error',()=>resolve(1));child.on('exit',c=>resolve(c??1))})
let result;try{result=JSON.parse(output.trim())}catch{result={ok:false,error:'Operation failed; inspect private configuration'}}
const event={at:new Date().toISOString(),job,exitCode:code,result}
appendFileSync(join(dirname(configFile),'logs',job+'.jsonl'),JSON.stringify(event)+'\n',{mode:0o600})
if(code!==0&&process.platform==='darwin')await new Promise(resolve=>{const p=spawn('/usr/bin/osascript',['-e','display notification "ตรวจพบปัญหา '+job+' กรุณาตรวจ operator logs" with title "VillaCheck Operations"'],{stdio:'ignore'});p.on('exit',resolve);p.on('error',resolve)})
console.log(JSON.stringify(event));process.exitCode=code
