import { randomUUID } from "node:crypto"
import { audit } from "./database.mjs"
const fail = (status, message) => {
  throw Object.assign(Error(message), { status })
}
const clean = (value, max = 4000) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)
  )
    fail(400, "กรุณาระบุข้อความให้ถูกต้อง")
  return value.trim()
}
const publicationPolicy = "แพ็กเกจต่ำกว่า 2,990 บาทเผยแพร่รีวิวทันที ส่วนแพ็กเกจ 2,990 บาทขึ้นไปรอ Admin ตรวจอนุมัติก่อนเผยแพร่ ใช้กติกาเดียวกันทุกคะแนน"
const reviewVilla = (db, qr) => db.prepare("SELECT v.id,v.name,v.package_id,p.name AS package_name,p.amount FROM villas v JOIN package_catalog p ON p.id=v.package_id WHERE v.qr=? AND v.status='approved'").get(qr)
const requiresModeration = (villa) => villa.amount >= 299000
const key = (id) => "customer_review:" + id
const read = async (db) =>
  (
    await db
      .prepare(
        "SELECT value FROM system_settings WHERE key LIKE 'customer_review:%'",
      )
      .all()
  ).map((r) => JSON.parse(r.value))
const save = async (db, r) =>
  db.prepare(
    "INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(key(r.id), JSON.stringify(r))
export const reviewReasons = {
  spam: "สแปมหรือโฆษณา",
  duplicate: "รีวิวซ้ำหรือไม่เกี่ยวข้อง",
  false_information: "แอบอ้างหรือข้อมูลที่พิสูจน์ว่าไม่จริง",
  privacy: "คุกคามหรือเปิดเผยข้อมูลส่วนตัว",
  insufficient_evidence: "ต้องการหลักฐานเพิ่มเติมสำหรับข้อกล่าวหา",
}
export async function reviewsApi(db, user, req, path, url, body) {
  if (
    !/^\/api\/(public\/reviews|reviews|admin\/reviews|merchant\/reviews)(\/|$)/.test(
      path,
    )
  )
    return undefined
  if (path === "/api/public/reviews" && req.method === "GET") {
    const villa = await reviewVilla(db, url.searchParams.get("qr") || "")
    if (!villa) fail(404, "ไม่พบที่พัก")
    return {
      reviews: (await read(db))
        .filter((r) => r.villaId === villa.id && r.status === "published")
        .map((r) => ({
          id: r.id,
          rating: r.rating,
          content: r.content,
          author: r.author,
          createdAt: r.createdAt,
          publishedAt: r.publishedAt || r.reviewedAt,
          reply: r.reply || null,
        })),
      policy: publicationPolicy,
      moderationRequired: requiresModeration(villa),
    }
  }
  if (!user) fail(401, "กรุณาเข้าสู่ระบบ")
  if (path === "/api/reviews" && req.method === "GET")
    return { reviews: (await read(db)).filter((r) => r.userId === user.id) }
  if (path === "/api/admin/reviews" && req.method === "GET") {
    if (user.role !== "admin") fail(403, "เฉพาะ Admin")
    const requested=url.searchParams.get("qr")
    const villa=requested?await db.prepare("SELECT id FROM villas WHERE qr=?").get(requested):null
    return {
      reviews: (await read(db)).filter(row=>!requested||row.villaId===villa?.id).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
      reasons: reviewReasons,
    }
  }
  if (path === "/api/merchant/reviews" && req.method === "GET") {
    if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")
    const ids = (
      await db.prepare("SELECT id FROM villas WHERE owner_id=?").all(user.id)
    ).map((v) => v.id)
    return {
      reviews: (await read(db)).filter(
        (r) => ids.includes(r.villaId) && r.status === "published",
      ),
    }
  }
  if (path === "/api/reviews" && req.method === "POST")
    return db.transaction(async () => {
      if (user.role !== "user") fail(403, "เฉพาะสมาชิก User ที่เขียนรีวิวได้")
      const data = await body(req),
        content = clean(data.content),
        rating = data.rating
      if (!Number.isInteger(rating) || rating < 1 || rating > 5)
        fail(400, "คะแนนต้องเป็น 1–5")
      const villa = await reviewVilla(db, data.qr)
      if (!villa) fail(404, "ไม่พบที่พัก")
      if (
        (await read(db)).some(
          (r) => r.userId === user.id && r.villaId === villa.id,
        )
      )
        fail(409, "คุณส่งรีวิวที่พักนี้แล้ว ดูสถานะหรือขอทบทวนผลในรีวิวของฉัน")
      const moderationRequired = requiresModeration(villa)
      const now = new Date().toISOString()
      const r = {
        id: randomUUID(),
        villaId: villa.id,
        villaName: villa.name,
        userId: user.id,
        author: user.name,
        content,
        rating,
        status: moderationRequired ? "pending" : "published",
        moderationRequired,
        packageId: villa.package_id,
        packageName: villa.package_name,
        publishedAt: moderationRequired ? null : now,
        createdAt: now,
        history: [],
      }
      await save(db, r)
      await audit(db, user, "review.submit", r.id)
      return { review: r }
    })
  const action = path.match(
    /^\/api\/(reviews|admin\/reviews|merchant\/reviews)\/([a-f0-9-]{36})\/(moderate|appeal|reply)$/,
  )
  if (action && req.method === "POST")
    return db.transaction(async () => {
      const row = await db
        .prepare("SELECT value FROM system_settings WHERE key=?")
        .get(key(action[2]))
      if (!row) fail(404, "ไม่พบรีวิว")
      const r = JSON.parse(row.value),
        data = await body(req),
        now = new Date().toISOString()
      if (action[3] === "moderate") {
        if (user.role !== "admin") fail(403, "เฉพาะ Admin")
        if (!["published", "more_info", "rejected"].includes(data.status))
          fail(400, "สถานะรีวิวไม่ถูกต้อง")
        if (
          data.status !== "published" &&
          !Object.hasOwn(reviewReasons, data.reasonCode)
        )
          fail(400, "เลือกเหตุผลตามกติกา คะแนนต่ำไม่ใช่เหตุปฏิเสธ")
        const reason =
          data.status === "published"
            ? "ผ่านกติกาเนื้อหา"
            : clean(data.reason, 2000)
        r.status = data.status
        r.publishedAt = data.status === "published" ? now : null
        r.reason = reason
        r.reasonCode = data.reasonCode || ""
        r.reviewedBy = user.id
        r.reviewedByName = user.name
        r.reviewedAt = now
        r.history.push({
          action: "moderate",
          status: r.status,
          reason,
          by: user.id,
          at: now,
        })
      } else if (action[3] === "appeal") {
        if (r.userId !== user.id) fail(403, "เฉพาะผู้เขียนรีวิว")
        if (!["rejected", "more_info"].includes(r.status))
          fail(409, "ขอทบทวนได้เมื่อไม่อนุมัติหรือขอข้อมูลเพิ่ม")
        r.history.push({
          action: "appeal",
          detail: clean(data.detail, 4000),
          by: user.id,
          at: now,
        })
        r.status = "pending"
      } else {
        const villa = await db
          .prepare("SELECT owner_id FROM villas WHERE id=?")
          .get(r.villaId)
        if (user.role !== "merchant" || villa?.owner_id !== user.id)
          fail(403, "เฉพาะเจ้าของที่พัก")
        if (r.status !== "published") fail(409, "ตอบได้เฉพาะรีวิวที่เผยแพร่")
        r.reply = { content: clean(data.content), at: now, author: user.name }
        r.history.push({ action: "reply", by: user.id, at: now })
      }
      await save(db, r)
      await audit(db, user, "review." + action[3], r.id)
      return { review: r }
    })
  fail(404, "ไม่พบ API รีวิว")
}
