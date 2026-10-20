import { randomUUID } from "node:crypto"
import { audit } from "./database.mjs"
import { getPlan } from "./catalog.mjs"
import { cmsUrl } from "./cms.mjs"
const fail = (status, message) => {
  throw Object.assign(Error(message), { status })
}
const text = (v, max = 300) => {
  if (typeof v !== "string" || v.length > max || /[\x00-\x1f]/.test(v))
    fail(400, "ข้อมูลไม่ถูกต้อง")
  return v.trim()
}
const list = async (db, prefix) =>
  (
    await db
      .prepare("SELECT value FROM system_settings WHERE key LIKE ?")
      .all(prefix + ":%")
  ).map((r) => JSON.parse(r.value))
const save = async (db, prefix, item) =>
  db.prepare(
    "INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(prefix + ":" + item.id, JSON.stringify(item))
export async function advertisingEntitlement(db, villaId, placement) {
  const villa = await db.prepare("SELECT * FROM villas WHERE id=?").get(villaId)
  if (
    !villa ||
    villa.payments === 0 ||
    !villa.expires ||
    Date.parse(villa.expires) <= Date.now()
  )
    return false
  const sub = await db
    .prepare("SELECT lifecycle FROM subscriptions WHERE owner_id=?")
    .get(villa.owner_id)
  if (["SUSPENDED", "CANCELLED"].includes(sub?.lifecycle)) return false
  const plan = await getPlan(db, villa.package_id)
  return (
    villa.status === "approved" &&
    plan.active &&
    (placement === "home" || placement === "video"
      ? plan.id === "premium"
      : ["pro", "premium"].includes(plan.id))
  )
}
export async function advertisingApi(db, user, req, path, url, body) {
  if (
    ![
      "/api/public/advertisements",
      "/api/admin/advertisements",
      "/api/admin/social-jobs",
      "/api/merchant/social-jobs",
    ].includes(path)
  )
    return undefined
  if (path === "/api/public/advertisements" && req.method === "GET") {
    const placement =
        url.searchParams.get("placement") === "home" ? "home" : "detail",
      now = Date.now()
    const eligible = []
    for (const ad of await list(db, "advertisement"))
      if (
        ad.placement === placement &&
        ad.approved &&
        ad.visible &&
        Date.parse(ad.startsAt) <= now &&
        Date.parse(ad.endsAt) > now &&
        (await advertisingEntitlement(db, ad.villaId, placement))
      )
        eligible.push(ad)
    return {
      advertisements: eligible
        .sort((a, b) => a.order - b.order)
        .map((a) => ({
          id: a.id,
          image: a.image,
          mobileImage: a.mobileImage,
          title: a.title,
          description: a.description,
          href: a.href,
          label: a.label,
          sponsored: true,
          demo: a.demo === true,
          visible: true,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
        })),
    }
  }
  if (!user) fail(401, "กรุณาเข้าสู่ระบบ")
  const social = path.endsWith("social-jobs")
  if (path.startsWith("/api/merchant/")) {
    if (user.role !== "merchant" || req.method !== "GET")
      fail(403, "เฉพาะ Merchant")
    const ids = (
      await db.prepare("SELECT id FROM villas WHERE owner_id=?").all(user.id)
    ).map((v) => v.id)
    return {
      jobs: (await list(db, "social_job")).filter((j) =>
        ids.includes(j.villaId),
      ),
    }
  }
  if (user.role !== "admin") fail(403, "เฉพาะ Admin")
  if (req.method === "GET")
    return social
      ? { jobs: await list(db, "social_job") }
      : { advertisements: await list(db, "advertisement") }
  if (req.method !== "POST") fail(405, "ไม่รองรับคำสั่งนี้")
  return db.transaction(async () => {
    const data = await body(req),
      id = data.id || randomUUID()
    if (!/^[a-f0-9-]{36}$/.test(id)) fail(400, "รหัสไม่ถูกต้อง")
    const villa = await db
      .prepare("SELECT id,name FROM villas WHERE id=?")
      .get(data.villaId)
    if (!villa) fail(404, "ไม่พบที่พัก")
    const now = new Date().toISOString()
    if (social) {
      const month = text(data.month, 7),
        type = data.type
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
        !["image", "video"].includes(type) ||
        !["pending", "production", "review", "published"].includes(data.status)
      )
        fail(400, "เดือน ประเภท หรือสถานะไม่ถูกต้อง")
      const oldRow = await db
          .prepare("SELECT value FROM system_settings WHERE key=?")
          .get("social_job:" + id),
        old = oldRow ? JSON.parse(oldRow.value) : null
      const existingRight =
        old &&
        old.villaId === villa.id &&
        old.month === month &&
        old.type === type
      if (
        !existingRight &&
        !(await advertisingEntitlement(
          db,
          villa.id,
          type === "video" ? "video" : "detail",
        ))
      )
        fail(409, "ที่พักไม่มีสิทธิ์ Social ที่ใช้งานอยู่")
      const jobs = await list(db, "social_job")
      if (
        jobs.some(
          (j) =>
            j.id !== id &&
            j.villaId === villa.id &&
            j.month === month &&
            j.type === type,
        )
      )
        fail(409, "ใช้สิทธิ์ประเภทนี้ในเดือนนี้แล้ว")
      const links = Object.fromEntries(["Facebook", "Instagram", "TikTok"].map(channel => [channel, cmsUrl(data.links?.[channel] || "")]))
      if(Object.values(links).some(link => link && !link.startsWith("https://"))) fail(400,"ลิงก์ Social ต้องเป็น HTTPS")
      const publishedAt = text(data.publishedAt || "", 40),
        postUrl = cmsUrl(data.postUrl || links.Facebook || ""),
        channel = text(data.channel || "Facebook, Instagram, TikTok", 100)
      if (publishedAt && !Number.isFinite(Date.parse(publishedAt)))
        fail(400, "วันเผยแพร่ไม่ถูกต้อง")
      if (
        data.status === "published" &&
        (!publishedAt ||
          !Number.isFinite(Date.parse(publishedAt)) ||
          !postUrl ||
          !channel || Object.values(links).some(link => !link))
      )
        fail(400, "ระบุวันเผยแพร่และลิงก์โพสต์ให้ครบ Facebook, Instagram และ TikTok")
      if (
        publishedAt &&
        new Date(Date.parse(publishedAt) + 7 * 3600000)
          .toISOString()
          .slice(0, 7) !== month
      )
        fail(400, "วันเผยแพร่ต้องตรงกับเดือนที่ใช้สิทธิ์ (เวลาไทย)")
      const job = {
        id,
        villaId: villa.id,
        villaName: villa.name,
        month,
        type,
        status: data.status,
        channel,
        publishedAt,
        postUrl,
        links,
        notes: text(data.notes || "", 2000),
        updatedAt: now,
        updatedBy: user.id,
      }
      await save(db, "social_job", job)
      await audit(db, user, "social.job.save", id)
      return { job }
    }
    if (
      !["home", "detail"].includes(data.placement) ||
      typeof data.visible !== "boolean" ||
      typeof data.approved !== "boolean" ||
      !Number.isInteger(data.order) ||
      data.order < 0
    )
      fail(400, "ข้อมูลแบนเนอร์ไม่ถูกต้อง")
    if (
      data.approved &&
      data.visible &&
      !(await advertisingEntitlement(db, villa.id, data.placement))
    )
      fail(409, "ที่พักไม่มีสิทธิ์โฆษณาตำแหน่งนี้ที่ใช้งานอยู่")
    const startsAt = text(data.startsAt, 40),
      endsAt = text(data.endsAt, 40)
    if (
      !Number.isFinite(Date.parse(startsAt)) ||
      !Number.isFinite(Date.parse(endsAt)) ||
      Date.parse(endsAt) <= Date.parse(startsAt)
    )
      fail(400, "ช่วงเวลาโฆษณาไม่ถูกต้อง")
    const image = cmsUrl(data.image, true),
      mobileImage = cmsUrl(data.mobileImage || "", true),
      title = text(data.title),
      href = cmsUrl(data.href || "")
    if (!image || !title) fail(400, "ระบุรูปและหัวข้อ")
    const previousAdRow=await db.prepare("SELECT value FROM system_settings WHERE key=?").get("advertisement:"+id)
    const previousAd=previousAdRow?JSON.parse(previousAdRow.value):null
    const ad = {
      id,
      demo: previousAd?.demo === true,
      villaId: villa.id,
      villaName: villa.name,
      placement: data.placement,
      image,
      mobileImage,
      title,
      description: text(data.description || "", 2000),
      href,
      label: text(data.label || "ดูที่พัก", 100),
      startsAt,
      endsAt,
      visible: data.visible,
      approved: data.approved,
      order: data.order,
      updatedAt: now,
      approvedBy: data.approved ? user.id : null,
      approvedAt: data.approved ? now : null,
    }
    await save(db, "advertisement", ad)
    await audit(db, user, "advertisement.save", id)
    return { advertisement: ad }
  })
}
