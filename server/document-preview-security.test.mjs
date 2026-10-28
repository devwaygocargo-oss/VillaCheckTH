import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {openDatabase,createUser,hashPassword} from './database.mjs'
import {createApp} from './app.mjs'
import nextConfig from '../next.config.mjs'

test('private PDF view preserves owner/Admin authorization, attachment default and private caching',async t=>{
 const db=openDatabase(':memory:'),password='LocalDocumentFixture123',origin='http://localhost:8443'
 const owner=await createUser(db,'pdf-owner@example.test',password,'PDF Owner','merchant')
 const other=await createUser(db,'pdf-other@example.test',password,'Other Owner','merchant')
 const member=await createUser(db,'pdf-user@example.test',password,'Member','user')
 const admin=await createUser(db,'pdf-admin@example.test',password,'PDF Admin','admin')
 const pdfId=randomUUID(),imageId=randomUUID(),pdf=Buffer.from('%PDF-1.4\n% local authorization fixture\n%%EOF')
 await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(pdfId,owner.id,'หลักฐาน local.pdf','application/pdf',pdf)
 await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(imageId,owner.id,'local.png','image/png',Buffer.from([137,80,78,71,13,10,26,10]))
 const server=createApp(db,{appUrl:origin,allowedOrigins:[origin],fakeHash:hashPassword('local-fake-password'),serverless:true})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close()})
 const base='http://127.0.0.1:'+server.address().port
 const login=async actor=>{const response=await fetch(base+'/api/auth/'+(actor.role==='admin'?'admin-login':'login'),{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:actor.email,password})});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0]}
 const cookies={owner:await login(owner),other:await login(other),member:await login(member),admin:await login(admin)}
 const read=(path,cookie)=>fetch(base+path,{headers:cookie?{Cookie:cookie}:{}})
 const path='/api/documents/'+pdfId
 const download=await read(path,cookies.owner);assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/^attachment;/);assert.equal(download.headers.get('content-type'),'application/pdf');assert.equal(download.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await download.arrayBuffer()),pdf)
 const view=await read(path+'?preview=1',cookies.owner);assert.equal(view.status,200);assert.match(view.headers.get('content-disposition'),/^inline;/);assert.match(view.headers.get('content-disposition'),/filename\*=UTF-8''/);assert.equal(view.headers.get('cache-control'),'private, no-store');assert.equal(view.headers.get('content-security-policy'),"default-src 'none'; sandbox")
 const adminView=await read('/api/admin/documents/'+pdfId+'?preview=1',cookies.admin);assert.equal(adminView.status,200);assert.match(adminView.headers.get('content-disposition'),/^inline;/)
 assert.equal((await read(path)).status,401)
 assert.equal((await read(path+'?preview=1',cookies.other)).status,404)
 assert.equal((await read(path+'?preview=1',cookies.member)).status,403)
 assert.equal((await read('/api/admin/documents/'+pdfId+'?preview=1',cookies.owner)).status,403)
 const ownerImage=await read('/api/documents/'+imageId+'?preview=1',cookies.owner);assert.equal(ownerImage.status,200);assert.match(ownerImage.headers.get('content-disposition'),/^attachment;/,'Owner inline preview is limited to PDF; other private formats retain their old handling')
 const frameworkHeaders=await nextConfig.headers();assert(frameworkHeaders.some(rule=>rule.source==='/:path*'&&rule.headers.some(header=>header.key==='X-Frame-Options'&&header.value==='DENY')),'Next retains the global frame-denial header')
 const before=await db.prepare('SELECT count(*) AS n FROM documents').get();assert.equal(Number(before.n),2)
})
