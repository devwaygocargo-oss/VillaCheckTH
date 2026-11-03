import pg from "pg"
import { randomBytes,scryptSync,createCipheriv,createDecipheriv,createHash } from "node:crypto"
import { gzipSync,gunzipSync } from "node:zlib"
import { readFileSync,writeFileSync,chmodSync } from "node:fs"
import { pathToFileURL } from "node:url"

// Consistent, encrypted application-data backup. SQL schema and provider PITR
// remain the responsibility of migrations and the database hosting operator.
export const durableTables=["users","package_catalog","system_settings","documents","subscriptions","leads","oauth_identities","villas","invoices","payment_qrs","mails","support_reports","user_checks","villa_events","audits"]
export const transientTables=["sessions","login_otps","oauth_states","rate_limits"]
const primaryKeys={subscriptions:["owner_id"],system_settings:["key"],oauth_identities:["provider","subject"]}
const quote=name=>{if(!/^[a-z_][a-z0-9_]*$/i.test(name))throw Error("Invalid identifier");return `"${name}"`}
const encode=value=>Buffer.isBuffer(value)?{bytes:value.toString("base64")}:value
const decode=value=>value&&typeof value==='object'&&Object.keys(value).length===1&&typeof value.bytes==='string'?Buffer.from(value.bytes,"base64"):value
const checkSecret=secret=>{if(typeof secret!=="string"||secret.length<32)throw Error("BACKUP_SECRET must contain at least 32 characters")}
const connect=async(url,schema)=>{const client=new pg.Client({connectionString:url});await client.connect();await client.query(`SET search_path TO ${quote(schema)}`);return client}
export async function exportSnapshot(url,file,secret,{schema="public",afterTable}={}){
 checkSecret(secret)
 const client=await connect(url,schema)
 try{
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
  const tables=[]
  for(const name of durableTables){
   const rows=(await client.query(`SELECT * FROM ${quote(name)} ORDER BY ${(primaryKeys[name]||["id"]).map(quote).join(",")}`)).rows
   const columns=(await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position",[name])).rows.map(x=>x.column_name)
   tables.push({name,columns,rows:rows.map(row=>columns.map(key=>encode(row[key])))})
   if(afterTable)await afterTable(name)
  }
  await client.query("COMMIT")
  const snapshot={format:1,createdAt:new Date().toISOString(),tables,excludedTransientTables:transientTables}
  const plain=Buffer.from(JSON.stringify(snapshot)),salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",scryptSync(secret,salt,32),iv)
  const encrypted=Buffer.concat([cipher.update(gzipSync(plain)),cipher.final()])
  const archive=Buffer.concat([Buffer.from("VCBACKUP1"),salt,iv,cipher.getAuthTag(),encrypted])
  writeFileSync(file,archive,{flag:"wx",mode:0o600});chmodSync(file,0o600)
  return {tables:tables.length,rows:tables.reduce((n,t)=>n+t.rows.length,0),bytes:archive.length,digest:createHash("sha256").update(plain).digest("hex"),createdAt:snapshot.createdAt}
 }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error}finally{await client.end()}
}
export function readSnapshot(file,secret){
 checkSecret(secret)
 const bytes=readFileSync(file);if(bytes.subarray(0,9).toString()!=="VCBACKUP1"||bytes.length<54)throw Error("Invalid backup")
 const salt=bytes.subarray(9,25),iv=bytes.subarray(25,37),tag=bytes.subarray(37,53),decipher=createDecipheriv("aes-256-gcm",scryptSync(secret,salt,32),iv)
 decipher.setAuthTag(tag)
 const plain=gunzipSync(Buffer.concat([decipher.update(bytes.subarray(53)),decipher.final()])),snapshot=JSON.parse(plain)
 if(snapshot.format!==1||!Array.isArray(snapshot.tables)||snapshot.tables.length!==durableTables.length||new Set(snapshot.tables.map(t=>t.name)).size!==durableTables.length||snapshot.tables.some(t=>!durableTables.includes(t.name)))throw Error("Unsupported backup format")
 return snapshot
}
export async function restoreSnapshot(url,file,secret,{schema="public",allowRemote=false}={}){
 const target=new URL(url)
 if(!["localhost","127.0.0.1","[::1]"].includes(target.hostname)&&!allowRemote)throw Error("Remote restore requires explicit ALLOW_REMOTE_RESTORE=true and a new empty target")
 const snapshot=readSnapshot(file,secret),client=await connect(url,schema)
 try{
  await client.query("BEGIN")
  await client.query("SELECT pg_advisory_xact_lock(74639201)")
  for(const name of [...durableTables,...transientTables])if(Number((await client.query(`SELECT COUNT(*) AS n FROM ${quote(name)}`)).rows[0].n)!==0)throw Error("Restore target must be empty; existing data will not be replaced")
  let count=0
  for(const name of durableTables){
   const table=snapshot.tables.find(t=>t.name===name),columns=table.columns.map(quote)
   for(const row of table.rows){if(row.length!==columns.length)throw Error("Invalid backup row");await client.query(`INSERT INTO ${quote(name)} (${columns.join(",")}) VALUES (${row.map((_,i)=>`$${i+1}`).join(",")})`,row.map(decode));count++}
  }
  await client.query("COMMIT")
  return {tables:durableTables.length,rows:count,transientSessionsRestored:false}
 }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error}finally{await client.end()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [mode,file]=process.argv.slice(2)
 try{
  if(!["backup","restore"].includes(mode)||!file)throw Error("Usage: application-backup.mjs backup|restore /path/archive.vcb")
  const url=process.env.BACKUP_DATABASE_URL||process.env.DIRECT_URL||process.env.DATABASE_URL
  if(!url)throw Error("Set BACKUP_DATABASE_URL or DATABASE_URL")
  const options={schema:process.env.BACKUP_SCHEMA||"public",allowRemote:process.env.ALLOW_REMOTE_RESTORE==="true"}
  const result=mode==="backup"?await exportSnapshot(url,file,process.env.BACKUP_SECRET,options):await restoreSnapshot(url,file,process.env.BACKUP_SECRET,options)
  console.log(JSON.stringify({mode,...result}))
 }catch{console.error("Backup/restore failed. Check configuration, encryption key, archive and empty target. Connection strings and credentials are not printed.");process.exitCode=1}
}
