import {mkdir,readdir,stat,unlink} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {exportSnapshot} from './application-backup.mjs'
const dir=process.env.BACKUP_DIR,days=Number(process.env.BACKUP_RETENTION_DAYS||30),url=process.env.BACKUP_DATABASE_URL
if(!dir||!url||!Number.isInteger(days)||days<1||days>3650)throw Error('Configure BACKUP_DIR, BACKUP_DATABASE_URL and retention 1–3650 days')
await mkdir(dir,{recursive:true,mode:0o700});const folder=resolve(dir),file=join(folder,'villacheck-'+new Date().toISOString().replace(/[:.]/g,'-')+'.vcb')
try{
 const result=await exportSnapshot(url,file,process.env.BACKUP_SECRET,{schema:process.env.BACKUP_SCHEMA||'public'})
 for(const name of await readdir(folder))if(/^villacheck-[0-9TZ.-]+\.vcb$/.test(name)){const p=join(folder,name);if(p!==file&&(await stat(p)).mtimeMs<Date.now()-days*86400000)await unlink(p)}
 console.log(JSON.stringify({ok:true,rows:result.rows,retentionDays:days}))
}catch{console.error('Scheduled backup failed; inspect configuration. Secrets are not logged.');process.exitCode=1}
