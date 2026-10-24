import {resolvePublicQr,publicRevision} from "./public-revision.mjs"
import {preserveApprovedVilla,rotateApprovedRevision} from "./approval-history.mjs"
import { randomUUID } from "node:crypto"
import { mediaDate } from "./media-date.mjs"
import { audit } from "./database.mjs"
import { getPlan } from "./catalog.mjs"
const fail = (status, message) => {
  throw Object.assign(Error(message), { status })
}
const list = async (db, id) =>
  (
    await db
      .prepare("SELECT value FROM system_settings WHERE key LIKE ?")
      .all("property_media:" + id + ":%")
  ).map((r) => JSON.parse(r.value))
export async function propertyMediaApi(db, user, req, path, url, body) {
  if (
    ![
      "/api/public/property-media",
      "/api/merchant/property-media",
      "/api/admin/property-media",
    ].includes(path)
  )
    return undefined
  let villa
  if (path.startsWith("/api/public/")){
    villa=await resolvePublicQr(db,url.searchParams.get("qr")||"")
    if(villa?.status!=="approved")villa=null
  } else {
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ")
    if (user.role !== (path.includes("/admin/") ? "admin" : "merchant"))
      fail(403, "ไม่มีสิทธิ์")
    if (req.method === "GET")
      villa = await db
        .prepare("SELECT * FROM villas WHERE id=?")
        .get(url.searchParams.get("villaId") || "")
  }
  if (req.method === "GET") {
    if (!villa) fail(404, "ไม่พบที่พัก")
    if (user?.role === "merchant" && villa.owner_id !== user.id)
      fail(404, "ไม่พบที่พัก")
    const storedMedia = villa._approvedSnapshot?.media??await list(db, villa.id)
    const media = path.startsWith("/api/public/") ? storedMedia.filter(m=>m.reviewedAt).map(({reviewedBy,...safe})=>safe) : storedMedia
    if (villa.photo_url && !media.some((m) => m.url === villa.photo_url))
      media.unshift({
        id: "cover",
        kind: "image",
        url: villa.photo_url,
        name: villa.name,
        uploadedAt: villa.photo_uploaded_at,
        takenAt: villa.photo_taken_at,
        reviewedAt: villa.photo_reviewed_at,
      })
    return {
      media,
      latestUpdatedAt:
        media
          .map((m) => m.uploadedAt)
          .filter(Boolean)
          .sort()
          .at(-1) || null,
    }
  }
  if (req.method !== "POST" || !user) fail(405, "ไม่รองรับคำสั่งนี้")
  return db.transaction(async () => {
    const data = await body(req)
    villa = await db
      .prepare("SELECT * FROM villas WHERE id=?")
      .get(data.villaId)
    if (!villa || (user.role === "merchant" && villa.owner_id !== user.id))
      fail(404, "ไม่พบที่พัก")
    if (path.includes("/admin/") && !data.file) {
      const key = "property_media:" + villa.id + ":" + data.mediaId
      if(data.mediaId === "cover" && villa.photo_reviewed_at)fail(409,"สื่อนี้ผ่านการอนุมัติแล้ว")
      if (data.mediaId === "cover")
        await db
          .prepare("UPDATE villas SET photo_reviewed_at=? WHERE id=?")
          .run(new Date().toISOString(), villa.id)
      else {
        const row = await db
          .prepare("SELECT value FROM system_settings WHERE key=?")
          .get(key)
        if (!row) fail(404, "ไม่พบสื่อ")
        const m = JSON.parse(row.value)
        if(m.reviewedAt)fail(409,"สื่อนี้ผ่านการอนุมัติแล้ว")
        m.reviewedAt = new Date().toISOString()
        m.reviewedBy = user.id
        await db
          .prepare("UPDATE system_settings SET value=? WHERE key=?")
          .run(JSON.stringify(m), key)
      }
      const qr=await rotateApprovedRevision(db,villa,user,"MEDIA_APPROVED")
      await audit(db, user, "media.review", villa.id)
      return { ok: true, qr }
    }
    const file = data.file,
      kind = file?.type === "video/mp4" ? "video" : "image"
    const plan = await getPlan(
      db,
      villa.payments === 0 ? "basic" : villa.package_id,
    )
    if (
      kind === "video" &&
      (!["starter", "pro", "premium"].includes(plan.id) ||
        !villa.expires ||
        Date.parse(villa.expires) <= Date.now())
    )
      fail(403, "ต้องใช้แพ็กเกจ 1,990 ขึ้นไปที่ยังไม่หมดอายุเพื่ออัปโหลดวิดีโอ")
    if (
      !file ||
      !["image/jpeg", "image/png", "video/mp4"].includes(file.type) ||
      typeof file.data !== "string" ||
      !file.data.startsWith(`data:${file.type};base64,`)
    )
      fail(400, "รองรับ JPG PNG MP4")
    const bytes = Buffer.from(
      file.data.slice(file.data.indexOf(",") + 1),
      "base64",
    )
    if (!bytes.length || bytes.length > 2 * 1024 * 1024)
      fail(400, "ไฟล์ต้องไม่เกิน 2 MB")
    if (
      (file.type === "image/png" &&
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (file.type === "image/jpeg" &&
        (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)) ||
      (kind === "video" && bytes.subarray(4, 8).toString() !== "ftyp")
    )
      fail(400, "เนื้อหาไฟล์ไม่ตรงกับชนิด")
    await preserveApprovedVilla(db,villa)
    const id = randomUUID(),
      takenAt = data.takenAt ? mediaDate(data.takenAt) : null
    await db
      .prepare(
        "INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)",
      )
      .run(id, user.id, "property-media", file.type, bytes)
    const media = {
      id,
      villaId: villa.id,
      name:
        typeof file.name === "string" ? file.name.slice(0, 200) : villa.name,
      kind,
      url: "/api/public/property-media-file/" + id,
      uploadedAt: new Date().toISOString(),
      takenAt,
      reviewedAt: null,
    }
    await db
      .prepare("INSERT INTO system_settings(key,value) VALUES (?,?)")
      .run("property_media:" + villa.id + ":" + id, JSON.stringify(media))
    await audit(db, user, "media.upload", id)
    return { media }
  })
}
export async function propertyMediaFile(db, id, user) {
  const rows = await db
    .prepare(
      "SELECT value FROM system_settings WHERE key LIKE 'property_media:%'",
    )
    .all()
  const m = rows.map((r) => JSON.parse(r.value)).find((m) => m.id === id)
  if (!m) fail(404, "ไม่พบสื่อ")
  const v = await db
    .prepare("SELECT * FROM villas WHERE id=?")
    .get(m.villaId)
  const published=await publicRevision(db,v)
  const visible=published?.status==="approved"&&(published._approvedSnapshot?published._approvedSnapshot.media.some(item=>item.id===id):Boolean(m.reviewedAt))
  if (
    !v ||
    (!visible &&
      user?.role !== "admin" &&
      user?.id !== v.owner_id)
  )
    fail(404, "ไม่พบสื่อ")
  const file = await db
    .prepare(
      "SELECT mime,bytes FROM documents WHERE id=? AND name='property-media'",
    )
    .get(id)
  if (!file) fail(404, "ไม่พบสื่อ")
  return file
}
