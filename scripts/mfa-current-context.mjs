// Operator-only target binding. No application bootstrap or provider bypass keys.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {rootCertificates,checkServerIdentity} from 'node:tls';
import pg from 'pg';
import {productionDb} from './production-internal-context.mjs';
import {postgresSql} from '../server/postgres.mjs';
export const mfaOut='docs/releases/evidence/remove-mfa-current-20261029';
export async function mfaDatabase(environment){
 assert(['staging','production'].includes(environment));
 if(environment==='production')return productionDb();
 const {target}=JSON.parse(fs.readFileSync('reports/requested-test-accounts-v2/staging-scope.json'));
 assert.equal(target.host,'ep-lively-wildflower-azuxgq19.c-3.ap-southeast-1.aws.neon.tech');
 assert.equal(target.database,'neondb');assert.equal(target.role,'neondb_owner');
 const raw=execFileSync(process.execPath,['/tmp/villacheck-neon-readonly/node_modules/neonctl/bin/cli.js','connection-string',target.branchId,'--project-id',target.neonProjectId,'--role-name',target.role,'--database-name',target.database,'--ssl','verify-full'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
 const uri=new URL(raw.match(/postgres(?:ql)?:\/\/[^\s"']+/)[0]);assert.equal(uri.hostname,target.host);assert.equal(uri.pathname,'/'+target.database);assert.equal(decodeURIComponent(uri.username),target.role);uri.searchParams.delete('sslmode');
 const client=new pg.Client({connectionString:uri.toString(),ssl:{rejectUnauthorized:true,ca:rootCertificates.join('\n')},connectionTimeoutMillis:10000});await client.connect();assert(client.connection.stream.authorized&&!checkServerIdentity(target.host,client.connection.stream.getPeerCertificate()));
 const query=(sql,args=[])=>client.query(postgresSql(sql),args);let inside=false;
 return {dialect:'postgres',prepare:sql=>({get:async(...args)=>(await query(sql,args)).rows[0],all:async(...args)=>(await query(sql,args)).rows,run:async(...args)=>({changes:(await query(sql,args)).rowCount})}),exec:sql=>query(sql),close:()=>client.end(),transaction:async work=>{assert(!inside);await query('BEGIN');inside=true;try{await query('SELECT pg_advisory_xact_lock(74639201)');const result=await work();await query('COMMIT');return result}catch(error){await query('ROLLBACK');throw error}finally{inside=false}}};
}
