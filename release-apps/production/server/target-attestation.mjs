// Explicitly enabled operator-only, stateless, READ-ONLY pre-bootstrap proof.
// No application bootstrap, customer rows, seed, workers or provider HTTP calls.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {checkServerIdentity} from 'node:tls'
import pg from 'pg'
export const attestationPath='/api/ops/target-attestation'
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
export const attestationRequestSignature=(secret,nonce,timestamp)=>createHmac('sha256',secret).update('GET\n'+attestationPath+'\n'+nonce+'\n'+timestamp).digest('hex')
export const targetFingerprint=({host,database,schema,role,deploymentId})=>createHash('sha256').update(JSON.stringify({host:host.replace('-pooler.','.'),database,schema,role,deploymentId})).digest('hex')
export function verifyAttestationResponse({response,secret,nonce,deploymentId,expectedFingerprint,now=Date.now()}){if(typeof response?.timestamp!=='string'||!/^\d{13}$/.test(response.timestamp)||!Number.isFinite(Number(response.timestamp))||!deploymentId||response?.nonce!==nonce||response.deploymentId!==deploymentId||response.fingerprint!==expectedFingerprint||Math.abs(now-Number(response.timestamp))>45000)return false;const {signature,...body}=response;return equal(signature,createHmac('sha256',secret).update(JSON.stringify(body)).digest('hex'))}
export async function attestRuntimeTarget({method,path,headers,query,env}, {makeClient=options=>new pg.Client(options),now=Date.now()}={}){
 if(path!==attestationPath||env.TARGET_ATTESTATION_ENABLED!=='true')return undefined
 const reject=(status,error)=>({status,body:{error}})
 if(method!=='GET')return reject(405,'Read-only attestation only')
 const secret=env.TARGET_ATTESTATION_SECRET,nonce=query.nonce,timestamp=query.timestamp,signature=headers['x-vc-attestation-signature']
 if(typeof secret!=='string'||secret.length<32||!['staging','production'].includes(env.APP_ENV)||!env.VERCEL_DEPLOYMENT_ID)return reject(503,'Target attestation unavailable')
 if(typeof nonce!=='string'||! /^[a-f0-9]{64}$/.test(nonce)||typeof timestamp!=='string'||!/^\d{13}$/.test(timestamp)||Math.abs(now-Number(timestamp))>45000||!equal(signature,attestationRequestSignature(secret,nonce,timestamp)))return reject(401,'Invalid attestation authorization')
 let db
 try{
  const u=new URL(env.DATABASE_URL||env.VillaCheck_DATABASE_URL),host=u.hostname.replace('-pooler.','.'),database=decodeURIComponent(u.pathname.slice(1)),role=decodeURIComponent(u.username)
  if(!['postgres:','postgresql:'].includes(u.protocol)||!/^ep-[a-z0-9-]+\..+\.neon\.tech$/.test(host)||!['require','verify-full'].includes(u.searchParams.get('sslmode'))||u.searchParams.has('options')||(u.searchParams.get('schema')||'public')!=='public'||env.NODE_TLS_REJECT_UNAUTHORIZED==='0')return reject(503,'Target attestation unavailable')
  const productionHost=host.startsWith('ep-square-resonance-aohwf0z5.')
  if(env.APP_ENV==='production'&&(!productionHost||database!=='villacheck_production'||role!=='villacheck_runtime'))return reject(503,'Target attestation unavailable')
  if(env.APP_ENV==='staging'&&(productionHost||database==='villacheck_production'||['villacheck_owner','villacheck_runtime','villacheck_audit','villacheck_backup'].includes(role)))return reject(503,'Target attestation unavailable')
  db=makeClient({connectionString:u.toString(),connectionTimeoutMillis:10000,statement_timeout:10000,query_timeout:12000,application_name:'villacheck-readonly-target-attestation'});await db.connect();const stream=db.connection.stream;if(!stream.encrypted||!stream.authorized||checkServerIdentity(u.hostname,stream.getPeerCertificate()))return reject(503,'Target attestation unavailable')
  await db.query('BEGIN READ ONLY');const result=await db.query("SELECT current_database() AS database,current_schema() AS schema,current_user AS role,current_setting('transaction_read_only') AS read_only"),actual=result.rows[0];if(actual.database!==database||actual.schema!=='public'||actual.role!==role||actual.read_only!=='on')return reject(503,'Target attestation unavailable')
  const body={nonce,timestamp,deploymentId:env.VERCEL_DEPLOYMENT_ID,fingerprint:targetFingerprint({host,...actual,deploymentId:env.VERCEL_DEPLOYMENT_ID})};return {status:200,body:{...body,signature:createHmac('sha256',secret).update(JSON.stringify(body)).digest('hex')}}
 }catch{return reject(503,'Target attestation unavailable')}
 finally{if(db){await db.query('ROLLBACK').catch(()=>{});await db.end().catch(()=>{})}}
}
