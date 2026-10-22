import {loadTrustContext,selectByIds} from "./villa-read-context.mjs"
import { randomUUID } from "node:crypto"
import { audit } from "./database.mjs"
import { getPlan } from "./catalog.mjs"
import { cmsUrl } from "./cms.mjs"
import { initializeCmsChanges,recordCmsChange,cmsChangeById } from "./cms-change-history.mjs"
const fail = (status, message) => {
  throw Object.assign(Error(message), { status })
}
const text = (v, max = 300, multiline = false) => {
  if (typeof v !== "string" || v.length > max || (multiline ? /[\x00-\x09\x0b\x0c\x0e-\x1f]/ : /[\x00-\x1f]/).test(v))
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
export async function advertisingEntitlement(db, villaId, placement, context) {
  const villa = context ? context.villas.get(villaId) : await db.prepare("SELECT * FROM villas WHERE id=?").get(villaId)
  if (
    !villa ||
    villa.payments === 0 ||
    !villa.expires ||
    Date.parse(villa.expires) <= Date.now()
  )
    return false
  const sub = context ? context.subscriptions.get(villa.owner_id) : await db
    .prepare("SELECT lifecycle FROM subscriptions WHERE owner_id=?")
    .get(villa.owner_id)
  if (["SUSPENDED", "CANCELLED"].includes(sub?.lifecycle)) return false
  const plan = context?.plans.get(villa.package_id) || await getPlan(db, villa.package_id)
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
        ["home","footer"].includes(url.searchParams.get("placement")) ? url.searchParams.get("placement") : "detail",
      now = Date.now()
    const candidates=(await list(db,"advertisement")).filter(ad=>ad.placement===placement&&ad.approved&&ad.visible&&Date.parse(ad.startsAt)<=now&&Date.parse(ad.endsAt)>now);
    const villas=await selectByIds(db,"SELECT * FROM villas WHERE id",candidates.map(ad=>ad.villaId));
    const context=await loadTrustContext(db,villas,{qr:false});
    context.villas=new Map(villas.map(v=>[v.id,v]));
    const eligible=[];
    for(const ad of candidates)if(await advertisingEntitlement(db,ad.villaId,placement,context))eligible.push(ad);
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
  if (req.method === "GET") {
    if(social)return {jobs:await list(db,"social_job")}
    const ads=await list(db,"advertisement"),villas=await selectByIds(db,"SELECT * FROM villas WHERE id",ads.map(a=>a.villaId)),context=await loadTrustContext(db,villas,{qr:false})
    context.villas=new Map(villas.map(v=>[v.id,v]))
    return {advertisements:await Promise.all(ads.map(async ad=>({...ad,eligible:await advertisingEntitlement(db,ad.villaId,ad.placement,context)})))}
  }
  if (req.method !== "POST") fail(405, "ไม่รองรับคำสั่งนี้")
  return db.transaction(async () => {
    let data = await body(req)
    const restoring = !social && data.historyId
    if(restoring){
      const entry=await cmsChangeById(db,data.historyId)
      if(entry?.kind!=="advertisement")fail(404,"ไม่พบประวัติโฆษณา")
      data={...entry.snapshot,visible:false,approved:false}
    }
    const id = data.id || randomUUID()
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
      !["home", "detail", "footer"].includes(data.placement) ||
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
      title = text(data.title, 300, true),
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
      description: text(data.description || "", 2000, true),
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
    await db.transaction(async()=>{
      if(ad.placement==="footer"&&ad.visible&&ad.approved){
        const overlap=(await list(db,"advertisement")).some(other=>other.id!==id&&other.villaId===ad.villaId&&other.placement==="footer"&&other.visible&&other.approved&&Date.parse(other.startsAt)<Date.parse(ad.endsAt)&&Date.parse(other.endsAt)>Date.parse(ad.startsAt));
        if(overlap)fail(409,"แต่ละที่พักแสดงโฆษณาก่อน Footer ได้ 1 ชิ้นในช่วงเวลาเดียวกัน");
      }
      await save(db,"advertisement",ad);
      await initializeCmsChanges(db)
      if(previousAd){
        const existing=await db.prepare("SELECT key FROM system_settings WHERE key=?").get("cms_ad_history_initialized:"+id)
        if(!existing){
          await recordCmsChange(db,{kind:"advertisement",action:"before_edit",snapshot:previousAd,user:{name:"ระบบ / ก่อนเริ่มเก็บประวัติ"},previous:true})
          await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run("cms_ad_history_initialized:"+id,"true")
        }
      }
      else await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run("cms_ad_history_initialized:"+id,"true")
      await recordCmsChange(db,{kind:"advertisement",action:restoring?"restore":previousAd?"save":"create",snapshot:ad,user})
      await audit(db,user,"advertisement.save",id);
    })
    return { advertisement: ad }
  })
}
