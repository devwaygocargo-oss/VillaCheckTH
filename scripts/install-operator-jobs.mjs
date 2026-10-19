// Explicit operator setup only. Never called from application startup or a deployment build.
import {homedir} from 'node:os'
import {join,resolve} from 'node:path'
import {mkdirSync,writeFileSync,existsSync,readFileSync,chmodSync} from 'node:fs'
import {randomBytes} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
if(process.platform!=='darwin'||!process.env.BACKUP_DATABASE_URL)throw Error('Run on the operator Mac with an explicitly verified BACKUP_DATABASE_URL')
const operatorRoot=join(homedir(),'.villacheck-operations'),project=fileURLToPath(new URL('..',import.meta.url))
for(const dir of [operatorRoot,join(operatorRoot,'keys'),join(operatorRoot,'backups'),join(operatorRoot,'logs')]){mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700)}
const keyFile=join(operatorRoot,'keys','backup.key');if(!existsSync(keyFile))writeFileSync(keyFile,randomBytes(48).toString('base64url'),{mode:0o600})
const configFile=join(operatorRoot,'operator.env'),values={PUBLIC_URL:process.env.PUBLIC_URL||'https://design-villacheck.vercel.app',BACKUP_DATABASE_URL:process.env.BACKUP_DATABASE_URL,BACKUP_DIR:join(operatorRoot,'backups'),BACKUP_RETENTION_DAYS:process.env.BACKUP_RETENTION_DAYS||'30',BACKUP_SECRET:readFileSync(keyFile,'utf8').trim(),ALERT_WEBHOOK_URL:process.env.ALERT_WEBHOOK_URL||''}
// Keep an existing operator-selected alert destination on repeat installation.
if(existsSync(configFile)&&!process.env.ALERT_WEBHOOK_URL){const {parse}=await import('dotenv');values.ALERT_WEBHOOK_URL=parse(readFileSync(configFile)).ALERT_WEBHOOK_URL||''}
writeFileSync(configFile,Object.entries(values).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n',{mode:0o600});chmodSync(configFile,0o600)
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),agents=join(homedir(),'Library','LaunchAgents');mkdirSync(agents,{recursive:true,mode:0o700})
for(const [job,interval]of [['backup',86400],['monitor',600]]){
 const label='com.villacheck.'+job,file=join(agents,label+'.plist'),args=[process.execPath,resolve(project,'scripts/operator-runner.mjs'),job,configFile]
 const plist='<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>'+label+'</string><key>ProgramArguments</key><array>'+args.map(x=>'<string>'+xml(x)+'</string>').join('')+'</array><key>WorkingDirectory</key><string>'+xml(project)+'</string><key>StartInterval</key><integer>'+interval+'</integer><key>RunAtLoad</key><true/><key>StandardOutPath</key><string>'+xml(join(operatorRoot,'logs',job+'-launch.log'))+'</string><key>StandardErrorPath</key><string>'+xml(join(operatorRoot,'logs',job+'-error.log'))+'</string></dict></plist>'
 if(existsSync(file)&&!readFileSync(file,'utf8').includes('operator-runner.mjs'))throw Error('Existing launch agent is not owned by this installer; refusing replacement')
 writeFileSync(file,plist,{mode:0o600});execFileSync('/usr/bin/plutil',['-lint',file],{stdio:'ignore'})
 try{execFileSync('/bin/launchctl',['bootout','gui/'+process.getuid(),file],{stdio:'ignore'})}catch{/* First installation has no loaded job. */}
 execFileSync('/bin/launchctl',['bootstrap','gui/'+process.getuid(),file],{stdio:'ignore'})
}
console.log(JSON.stringify({installed:true,operatorRoot,backupEveryHours:24,monitorEveryMinutes:10,retentionDays:Number(values.BACKUP_RETENTION_DAYS),alert:'macOS local notification on failure; external webhook only if configured',requiresOperatorMacAwake:true,offsiteStorageConfigured:false,secretsLogged:false}))
