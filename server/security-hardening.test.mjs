import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { openTestDatabase } from "./test-database.mjs"
import { createUser, verifyPassword } from "./database.mjs"
import { claimVerifiedEmail } from "./email-identity.mjs"
import config from "../next.config.mjs"

test("first verified mailbox claim revokes the pre-registrant's password and sessions exactly once", async t => {
  const db = await openTestDatabase(); t.after(() => db.close())
  const user = await createUser(db,"claimed@example.test","AttackerPassword123","Unverified")
  await db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run("token",user.id,"csrf",Date.now()+60000)
  const verified = await db.transaction(() => claimVerifiedEmail(db,user))
  assert.equal(verifyPassword("AttackerPassword123",verified.password_hash),false)
  assert.equal((await db.prepare("SELECT count(*) AS n FROM sessions WHERE user_id=?").get(user.id)).n,0)
  await db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run("new",user.id,"csrf",Date.now()+60000)
  const repeated = await db.transaction(() => claimVerifiedEmail(db,verified))
  assert.equal(repeated.password_hash,verified.password_hash)
  assert.equal((await db.prepare("SELECT count(*) AS n FROM sessions WHERE user_id=?").get(user.id)).n,1)
})
test("build cannot migrate or seed a configured database; browser framing is denied", async () => {
  const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url)))
  assert.doesNotMatch(pkg.scripts.build,/deploy-db|seed/)
  const headers=(await config.headers())[0].headers
  assert.equal(headers.find(h=>h.key==="X-Frame-Options").value,"DENY")
  assert.match(headers.find(h=>h.key==="Content-Security-Policy").value,/frame-ancestors 'none'/)
})

test("async password verification is compatible with unchanged legacy salt:hex hashes",async()=>{
 const {hashPassword,verifyPasswordAsync}=await import("./database.mjs")
 for(const password of ["LegacyPassword123","Thai-compatible-123","x".repeat(128)]) {
  const stored=hashPassword(password)
  assert.equal(await verifyPasswordAsync(password,stored),verifyPassword(password,stored))
  assert.equal(await verifyPasswordAsync("WrongPassword",stored),false)
 }
 assert.equal(await verifyPasswordAsync("WrongPassword","invalid:deadbeef"),false)
})
