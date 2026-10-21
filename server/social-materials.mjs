import { randomUUID, createHash } from "node:crypto"
import { advertisingEntitlement } from "./advertising.mjs"
import { loadTrustContext } from "./villa-read-context.mjs"
import { audit } from "./database.mjs"

export const socialMaterialLimits = { chunkBytes: 512 * 1024, imageBytes: 2 * 1024 * 1024, videoBytes: 50 * 1024 * 1024, images: 10, videos: 2 }
const fail = (status, message) => { throw Object.assign(Error(message), { status }) }
const read = async (db, key) => { const row = await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key); return row ? JSON.parse(row.value) : null }
const save = (db, key, value) => db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, JSON.stringify(value))
const key = (villaId, month) => `social_materials:${villaId}:${month}`
const uploadKey = (ownerId, id) => `social_upload:${ownerId}:${id}`
const partName = id => `social-material:${id}`
const partId = (id, index) => `${id}-${String(index).padStart(4, "0")}`
const monthNow = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)
const validMonth = value => { if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) fail(400, "เดือนงานไม่ถูกต้อง"); return value }
const clean = (value, max) => { if (typeof value !== "string" || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) fail(400, "ข้อความไม่ถูกต้อง"); return value.trim() }
const editable = submission => { if (submission && !["draft", "changes"].includes(submission.status)) fail(409, "ส่งไฟล์ชุดนี้แล้ว รอทีมงานตรวจ หรือขอให้ทีมส่งกลับเพื่อแก้ไข") }
const revision = (submission, expected) => { if ((submission?.revision || 0) !== expected) fail(409, "ข้อมูลเปลี่ยนแล้ว กรุณาโหลดล่าสุดก่อนทำรายการ") }
const touch = submission => ({ ...submission, revision: submission.revision + 1, updatedAt: new Date().toISOString() })
const empty = (villa, month) => ({ villaId: villa.id, ownerId: villa.owner_id, month, status: "draft", notes: "", adminNote: "", revision: 0, assets: [] })
const ownedVilla = async (db, user, villaId) => {
  if (typeof villaId !== "string") fail(400, "เลือกที่พัก")
  const villa = await db.prepare("SELECT * FROM villas WHERE id=?").get(villaId)
  if (!villa || (user.role !== "admin" && villa.owner_id !== user.id)) fail(404, "ไม่พบที่พัก")
  return villa
}
async function writable(db, user, villaId, month) {
  if (user.role !== "merchant") fail(403, "เฉพาะเจ้าของที่พัก")
  const villa = await ownedVilla(db, user, villaId)
  if (!(await advertisingEntitlement(db, villa.id, "detail"))) fail(403, "ต้องมีแพ็กเกจ 2,990 หรือ 4,990 ของที่พักนี้ที่ยังใช้งานอยู่และผ่านอนุมัติ")
  const next = new Date(monthNow() + "-01T00:00:00Z"); next.setUTCMonth(next.getUTCMonth() + 1)
  if (![monthNow(), next.toISOString().slice(0, 7)].includes(month)) fail(400, "ส่งสื่อได้สำหรับเดือนปัจจุบันหรือเดือนถัดไป")
  return villa
}
async function sessions(db, ownerId) {
  return (await db.prepare("SELECT key,value FROM system_settings WHERE key LIKE ?").all(`social_upload:${ownerId}:%`)).map(row => ({ key: row.key, ...JSON.parse(row.value) }))
}
async function discard(db, upload) {
  await db.prepare("DELETE FROM documents WHERE name=? AND owner_id=?").run(partName(upload.id), upload.ownerId)
  await db.prepare("DELETE FROM system_settings WHERE key=?").run(uploadKey(upload.ownerId, upload.id))
}
// Uploads use existing private document storage in bounded parts. No local files,
// public media URLs, full-video request/response bodies, or signed URL secrets.
export async function socialMaterialsApi(db, user, req, path, url, body) {
  if (!["/api/merchant/social-materials", "/api/admin/social-materials"].includes(path)) return undefined
  if (!user || !["merchant", "admin"].includes(user.role)) fail(403, "เฉพาะเจ้าของที่พักหรือ Admin")
  const admin = path.startsWith("/api/admin/")
  if ((admin && user.role !== "admin") || (!admin && user.role !== "merchant")) fail(403, "ไม่มีสิทธิ์ใช้งานหน้านี้")
  if (req.method === "GET") {
    const month = validMonth(url.searchParams.get("month") || monthNow())
    const villas = await db.prepare("SELECT * FROM villas" + (admin ? "" : " WHERE owner_id=?") + " ORDER BY created DESC").all(...(admin ? [] : [user.id]))
    const context = await loadTrustContext(db, villas, { qr: false }); context.villas = new Map(villas.map(v => [v.id, v]))
    const rows = (await db.prepare("SELECT value FROM system_settings WHERE key LIKE ?").all(`social_materials:%:${month}`)).map(row => JSON.parse(row.value))
    const visibleIds = new Set(villas.map(v => v.id))
    return { month, limits: socialMaterialLimits, villas: await Promise.all(villas.map(async v => ({ id: v.id, name: v.name, packageId: v.package_id, canUpload: await advertisingEntitlement(db, v.id, "detail", context) }))), submissions: rows.filter(s => visibleIds.has(s.villaId)).map(s => ({ ...s, villaName: context.villas.get(s.villaId).name })) }
  }
  if (req.method !== "POST") fail(405, "ไม่รองรับคำสั่งนี้")
  const data = await body(req)
  return db.transaction(async () => {
    const month = validMonth(data.month)
    if (admin) {
      if (!["accepted", "changes"].includes(data.action)) fail(400, "เลือกผลการตรวจไฟล์")
      await ownedVilla(db, user, data.villaId)
      const current = await read(db, key(data.villaId, month))
      if (!current || !["submitted", "accepted"].includes(current.status)) fail(409, "ยังไม่มีไฟล์ส่งตรวจ หรือส่งกลับแล้ว")
      revision(current, data.revision)
      const adminNote = clean(data.adminNote || "", 2000)
      if (data.action === "changes" && !adminNote) fail(400, "ระบุสิ่งที่ต้องการให้เจ้าของแก้ไข")
      const submission = touch({ ...current, status: data.action, adminNote, reviewedBy: user.name, reviewedAt: new Date().toISOString() })
      await save(db, key(data.villaId, month), submission)
      await audit(db, user, "social.materials." + data.action, data.villaId)
      return { submission }
    }
    if (data.action === "cancel") {
      const upload = await read(db, uploadKey(user.id, data.uploadId))
      if (upload) await discard(db, upload)
      return { cancelled: true }
    }
    const villa = await writable(db, user, data.villaId, month)
    const current = await read(db, key(villa.id, month))
    editable(current)
    if (data.action === "start") {
      const pending = await sessions(db, user.id)
      for (const upload of pending) if (upload.expiresAt <= Date.now()) await discard(db, upload)
      const active = pending.filter(u => u.expiresAt > Date.now())
      if (active.length >= 2) fail(409, "มีไฟล์กำลังอัปโหลดอยู่ กรุณารอหรือยกเลิกก่อน")
      const name = clean(data.name, 180).replace(/[\\/]/g, "_")
      if (!name || !["image/jpeg", "image/png", "video/mp4", "video/quicktime"].includes(data.mime)) fail(400, "ใช้รูป JPG/PNG หรือวิดีโอ MP4/MOV")
      const kind = data.mime.startsWith("image/") ? "image" : "video"
      const max = kind === "image" ? socialMaterialLimits.imageBytes : socialMaterialLimits.videoBytes
      if (!Number.isInteger(data.size) || data.size < 12 || data.size > max) fail(413, kind === "image" ? "ภาพไม่เกิน 2 MB ต่อไฟล์" : "วิดีโอไม่เกิน 50 MB ต่อไฟล์")
      if(kind==="video"&&villa.package_id!=="premium")fail(403,"แพ็กเกจ 2,990 ส่งสื่อ Social ได้เฉพาะรูปภาพ วิดีโอสำหรับแพ็กเกจ 4,990 เท่านั้น")
      const used = (current?.assets || []).filter(a => a.kind === kind).length + active.filter(u => u.villaId === villa.id && u.month === month && u.kind === kind).length
      if (used >= (kind === "image" ? socialMaterialLimits.images : socialMaterialLimits.videos)) fail(409, "ไฟล์ต้นฉบับเต็มแล้ว ลบไฟล์ที่ไม่ใช้ก่อนเพิ่ม")
      const upload = { id: randomUUID(), ownerId: user.id, villaId: villa.id, month, name, mime: data.mime, kind, size: data.size, received: 0, hashes: [], expiresAt: Date.now() + 2 * 3600000 }
      await save(db, uploadKey(user.id, upload.id), upload)
      return { uploadId: upload.id, chunkBytes: socialMaterialLimits.chunkBytes }
    }
    if (["part", "finish"].includes(data.action)) {
      const upload = await read(db, uploadKey(user.id, data.uploadId))
      if (!upload || upload.villaId !== villa.id || upload.month !== month || upload.expiresAt <= Date.now()) fail(404, "การอัปโหลดหมดอายุ กรุณาเลือกไฟล์ใหม่")
      if(upload.kind==="video"&&villa.package_id!=="premium")fail(403,"วิดีโอ Social สำหรับแพ็กเกจ 4,990 เท่านั้น")
      if (data.action === "part") {
        if (!Number.isInteger(data.index) || data.index < 0 || data.index > upload.hashes.length || typeof data.base64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64) || data.base64.length > Math.ceil(socialMaterialLimits.chunkBytes / 3) * 4) fail(400, "ส่วนของไฟล์ไม่ถูกต้อง")
        const bytes = Buffer.from(data.base64, "base64"), hash = createHash("sha256").update(bytes).digest("hex")
        if (bytes.toString("base64") !== data.base64) fail(400, "ข้อมูลไฟล์ไม่ถูกต้อง")
        if (data.index < upload.hashes.length) { if (upload.hashes[data.index] !== hash) fail(409, "ส่วนของไฟล์ซ้ำแต่ข้อมูลไม่ตรงกัน"); return { received: upload.received } }
        const expected = Math.min(socialMaterialLimits.chunkBytes, upload.size - upload.received)
        if (!expected || bytes.length !== expected) fail(400, "ขนาดส่วนของไฟล์ไม่ตรงกัน")
        await db.prepare("INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)").run(partId(upload.id, data.index), user.id, partName(upload.id), upload.mime, bytes)
        upload.received += bytes.length; upload.hashes.push(hash)
        await save(db, uploadKey(user.id, upload.id), upload)
        return { received: upload.received }
      }
      if (upload.received !== upload.size) fail(409, "ไฟล์ยังอัปโหลดไม่ครบ")
      const first = await db.prepare("SELECT bytes FROM documents WHERE id=? AND owner_id=?").get(partId(upload.id, 0), user.id)
      const bytes = Buffer.from(first?.bytes || [])
      const valid = upload.mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : upload.mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : (upload.mime === "video/mp4" ? bytes.toString("ascii", 4, 8) === "ftyp" : ["ftyp", "moov", "mdat", "wide"].includes(bytes.toString("ascii", 4, 8)))
      if (!valid) fail(400, "เนื้อหาไฟล์ไม่ตรงชนิด JPG/PNG/MP4/MOV กรุณาเลือกไฟล์ใหม่")
      const asset = { id: upload.id, name: upload.name, mime: upload.mime, kind: upload.kind, size: upload.size, uploadedAt: new Date().toISOString(), url: `/api/social-material-files/${upload.id}` }
      const submission = touch({ ...(current || empty(villa, month)), assets: [...(current?.assets || []), asset] })
      await save(db, "social_file:" + upload.id, { ...asset, ownerId: user.id, villaId: villa.id, month })
      await save(db, key(villa.id, month), submission)
      await db.prepare("DELETE FROM system_settings WHERE key=?").run(uploadKey(user.id, upload.id))
      await audit(db, user, "social.materials.upload", upload.id)
      return { submission }
    }
    revision(current, data.revision)
    if (data.action === "draft") {
      const submission = touch({ ...(current || empty(villa, month)), notes: clean(data.notes || "", 2000) })
      await save(db, key(villa.id, month), submission)
      return { submission }
    }
    if (data.action === "delete") {
      const asset = current?.assets.find(a => a.id === data.assetId)
      if (!asset) fail(404, "ไม่พบไฟล์")
      await db.prepare("DELETE FROM documents WHERE name=? AND owner_id=?").run(partName(asset.id), user.id)
      await db.prepare("DELETE FROM system_settings WHERE key=?").run("social_file:" + asset.id)
      const submission = touch({ ...current, assets: current.assets.filter(a => a.id !== asset.id) })
      await save(db, key(villa.id, month), submission)
      await audit(db, user, "social.materials.delete", asset.id)
      return { submission }
    }
    if (data.action === "submit") {
      if (!current?.assets.length) fail(400, "แนบไฟล์อย่างน้อย 1 ไฟล์ก่อนส่งให้ทีม")
      if(villa.package_id!=="premium"&&current.assets.some(a=>a.kind==="video"))fail(403,"แพ็กเกจ 2,990 ส่งสื่อ Social ได้เฉพาะรูปภาพ")
      if (typeof data.confirmed !== "boolean" || !data.confirmed) fail(400, "ยืนยันสิทธิ์การใช้สื่อเพื่อโปรโมทก่อนส่ง")
      const submission = touch({ ...current, status: "submitted", notes: clean(data.notes || "", 2000), submittedAt: new Date().toISOString(), confirmedBy: user.id })
      await save(db, key(villa.id, month), submission)
      await audit(db, user, "social.materials.submit", villa.id)
      return { submission }
    }
    fail(400, "คำสั่งไม่ถูกต้อง")
  })
}

export async function cleanupSocialUploads(db) {
  return db.transaction(async () => {
    const rows = await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'social_upload:%'").all()
    let removed = 0
    for (const row of rows) { const upload = JSON.parse(row.value); if (upload.expiresAt <= Date.now()) { await discard(db, upload); removed++ } }
    return removed
  })
}

export async function socialMaterialFile(db, user, id, range) {
  const file = await read(db, "social_file:" + id)
  if (!file || !user || (user.role !== "admin" && (user.role !== "merchant" || file.ownerId !== user.id))) fail(404, "ไม่พบไฟล์")
  // Fetch only a bounded range, not a complete 50 MB video into every response.
  let start = 0, end = file.size - 1
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match || (!match[1] && !match[2])) fail(416, "ช่วงไฟล์ไม่ถูกต้อง")
    if (!match[1]) start = Math.max(0, file.size - Number(match[2]))
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])) }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= file.size || end < start) fail(416, "ช่วงไฟล์ไม่ถูกต้อง")
  }
  if (file.kind === "video") end = Math.min(end, start + socialMaterialLimits.chunkBytes * 2 - 1)
  const first = Math.floor(start / socialMaterialLimits.chunkBytes), last = Math.floor(end / socialMaterialLimits.chunkBytes)
  const ids = Array.from({ length: last - first + 1 }, (_, i) => partId(id, first + i))
  const rows = await db.prepare(`SELECT id,bytes FROM documents WHERE owner_id=? AND name=? AND id IN (${ids.map(() => "?").join(",")}) ORDER BY id`).all(file.ownerId, partName(id), ...ids)
  if (rows.length !== ids.length) fail(404, "ไม่พบข้อมูลไฟล์ครบถ้วน")
  const bytes = Buffer.concat(rows.map(r => Buffer.from(r.bytes))).subarray(start - first * socialMaterialLimits.chunkBytes, end - first * socialMaterialLimits.chunkBytes + 1)
  return { ...file, bytes, start, end, partial: Boolean(range) || bytes.length !== file.size }
}
