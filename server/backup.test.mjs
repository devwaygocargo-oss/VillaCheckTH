import test from "node:test"
import assert from "node:assert/strict"
import {mkdtempSync,readFileSync,rmSync,statSync} from "node:fs"
import {randomUUID} from "node:crypto"
import {openTestDatabase} from "./test-database.mjs"
import {createUser,createInvoice} from "./database.mjs"
import {exportSnapshot,restoreSnapshot,readSnapshot,durableTables} from "../scripts/application-backup.mjs"

test("Encrypted online application backup remains consistent during writes and restores binary rows into an empty migrated schema",{skip:!process.env.TEST_DATABASE_URL},async t=>{
 const source=await openTestDatabase(),target=await openTestDatabase(),dir=mkdtempSync('/private/tmp/villacheck-logical-backup-'),file=dir+'/dummy.vcb',secret='Dummy backup encryption key with more than 32 characters';
 t.after(async()=>{await source.close();await target.close();rmSync(dir,{recursive:true,force:true})});
 const owner=await createUser(source,'dummy-backup@example.test','DummyPassword123','Before backup','merchant'),id=randomUUID(),doc=randomUUID();
 await source.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run('consistency','before')
 const bytes=Buffer.from('%PDF-1.4\nPrivate dummy document\x00\x01\xff','latin1')
 await source.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(doc,owner.id,'dummy.pdf','application/pdf',bytes)
 await source.prepare('INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,created) VALUES (?,?,?,?,?,?,?,?,?)').run(id,owner.id,'Backup Dummy Villa','ชลบุรี','Dummy Merchant','dummy@example.test','starter',doc,new Date().toISOString())
 await createInvoice(source,await source.prepare('SELECT * FROM villas WHERE id=?').get(id),'https://dummy.test','Dummy bank snapshot')
 await source.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run('dummy-session',owner.id,'dummy-csrf',Date.now()+3600000)
 // The export snapshot must not mix old user data with a newer settings value.
 const result=await exportSnapshot(source.testConnectionString,file,secret,{schema:new URL(source.testConnectionString).searchParams.get('options').split('search_path=')[1],afterTable:async name=>{if(name==='users')await source.transaction(async()=>{await source.prepare('UPDATE users SET name=? WHERE id=?').run('After backup',owner.id);await source.prepare("UPDATE system_settings SET value='after' WHERE key='consistency'").run()})}})
 assert.equal(result.tables,15);assert.equal(statSync(file).mode&0o777,0o600);assert.ok(!readFileSync(file).includes(Buffer.from('Private dummy document')))
 const decoded=readSnapshot(file,secret),users=decoded.tables.find(t=>t.name==='users'),settings=decoded.tables.find(t=>t.name==='system_settings')
 assert.equal(users.rows[0][users.columns.indexOf('name')],'Before backup');assert.equal(settings.rows.find(r=>r[settings.columns.indexOf('key')]==='consistency')[settings.columns.indexOf('value')],'before')
 assert.throws(()=>readSnapshot(file,'Wrong backup key that has over 32 characters'))
 const schema=new URL(target.testConnectionString).searchParams.get('options').split('search_path=')[1]
 await assert.rejects(()=>restoreSnapshot(target.testConnectionString,file,secret,{schema}),/empty/)
 await target.prepare('DELETE FROM package_catalog').run()
 const restored=await restoreSnapshot(target.testConnectionString,file,secret,{schema})
 assert.equal(restored.rows,result.rows);assert.equal(restored.transientSessionsRestored,false)
 assert.equal((await target.prepare('SELECT name FROM users WHERE id=?').get(owner.id)).name,'Before backup')
 assert.deepEqual((await target.prepare('SELECT bytes FROM documents WHERE id=?').get(doc)).bytes,bytes)
 assert.equal((await target.prepare('SELECT count(*) AS n FROM sessions').get()).n,0)
 const copy=dir+'/restored.vcb';await exportSnapshot(target.testConnectionString,copy,secret,{schema})
 assert.deepEqual(readSnapshot(copy,secret).tables,decoded.tables)
 await assert.rejects(()=>restoreSnapshot(target.testConnectionString,file,secret,{schema}),/empty/)
 await assert.rejects(()=>restoreSnapshot('postgresql://test:secret@remote.example/database',file,secret),/Remote restore/)
})
