import test from "node:test"
import assert from "node:assert/strict"
import { guestCapacity } from "./guest-capacity.mjs"
import { openTestDatabase } from "./test-database.mjs"
import { seedDemo } from "./demo-seed.mjs"
import { createApp } from "./app.mjs"
import { hashPassword } from "./database.mjs"

test("guest capacity preserves unknown values and rejects invalid counts", () => {
  for (const value of [undefined, null, ""]) assert.equal(guestCapacity(value), null)
  assert.equal(guestCapacity("12"), 12)
  for (const value of [0, -1, 1.5, 1001, "abc", "1e2", true])
    assert.throws(() => guestCapacity(value), e => e.status === 400)
})

test("capacity edits validate, persist, retain QR, and appear publicly only after review", async t => {
  const db = await openTestDatabase()
  await seedDemo(db, {password:"AuditDummyPassword123", adminEmail:"capacity-admin@example.com", adminPassword:"AuditDummyPassword123"})
  const server = createApp(db, {appUrl:"http://localhost:8443", allowedOrigins:["http://localhost:8443"], fakeHash:hashPassword("placeholder")}, null)
  await new Promise(r => server.listen(0, "127.0.0.1", r))
  t.after(async () => { await new Promise(r => server.close(r)); await db.close() })
  const base = `http://127.0.0.1:${server.address().port}/api`
  const request = async (path, data, session) => {
    const r = await fetch(base + path, {method:data === undefined ? "GET":"POST", headers:{"Content-Type":"application/json", ...(session ? {Cookie:session.cookie,"X-CSRF-Token":session.csrf}: {})}, body:data === undefined ? undefined:JSON.stringify(data)})
    return {status:r.status, value:await r.json(), cookie:r.headers.get("set-cookie")?.split(";")[0]}
  }
  const login = async email => {const r=await request(((await db.prepare("SELECT role FROM users WHERE email=?").get(email))?.role === "admin" ? "/auth/admin-login" : "/auth/login"),{email,password:"AuditDummyPassword123"}); return {...r.value,cookie:r.cookie}}
  const merchant = await login("demo-merchant@villacheck.example")
  const admin = await login("capacity-admin@example.com")
  const villa = (await request("/state",undefined,merchant)).value.villas.find(v=>v.name==="Sea Sky Demo Villa")
  const edit = {name:villa.name,nameEn:villa.nameEn||"Legacy Villa", province:villa.province, merchant:villa.merchant, phone:villa.phone, bankName:villa.bankName, accountName:villa.accountName, accountNumber:villa.accountNumber, photoUrl:villa.photoUrl}
  assert.equal((await request(`/merchant/villas/${villa.id}`,{...edit,guestCapacity:1.5},merchant)).status,400)
  assert.equal((await request(`/merchant/villas/${villa.id}`,{...edit,guestCapacity:"6"},merchant)).status,200)
  let saved = await db.prepare("SELECT * FROM villas WHERE id=?").get(villa.id)
  assert.equal(saved.guest_capacity,6)
  assert.equal(saved.qr,villa.qr)
  assert.equal(saved.status,"pending")
  await request(`/merchant/villas/${villa.id}`,edit,merchant)
  assert.equal((await db.prepare("SELECT guest_capacity FROM villas WHERE id=?").get(villa.id)).guest_capacity,6)
  assert.equal((await request(`/villas/${villa.id}/review`,{status:"approved",verificationLevel:"BASIC_CHECKED"},admin)).status,200)
  const publicVilla = (await request("/public/villas")).value.villas.find(v=>v.id===villa.id)
  assert.equal(publicVilla.guestCapacity,6)
  const reviewed = await db.prepare("SELECT reviewed_at,created FROM villas WHERE id=?").get(villa.id)
  assert.equal(publicVilla.updated,reviewed.reviewed_at)
  assert.equal(publicVilla.createdAt,reviewed.created)
  await db.prepare("UPDATE subscriptions SET lifecycle='SUSPENDED' WHERE owner_id=?").run(villa.ownerId || merchant.user.id)
  assert.equal((await request(`/villas/${villa.id}/renew`,{},merchant)).status,409)
  await db.prepare("UPDATE subscriptions SET lifecycle='ACTIVE' WHERE owner_id=?").run(merchant.user.id)
  assert.equal((await request("/admin/settings",{paymentVerificationMode:"AUTO"},admin)).status,400)
  assert.equal((await request("/admin/settings",undefined,admin)).value.paymentVerificationMode,"MANUAL")
})
