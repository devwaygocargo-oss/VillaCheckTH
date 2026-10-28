import {assertWriteSession} from "./write-session.mjs";
import {isDemoVilla} from "./demo-villa-visibility.mjs";
import {merchantFreePeriod} from './merchant-free-period.mjs'
import {villaMediaLimits,assertVillaMediaLimit,countVillaMedia,assertVillaCoverLimit} from './villa-media-limits.mjs'
import {recordVillaReview} from "./villa-review.mjs"
import {trustDto} from "./catalog.mjs"
import {resolvePublicQr,publicRevision} from "./public-revision.mjs"
import {preserveApprovedVilla,rotateApprovedRevision} from "./approval-history.mjs"
import { randomUUID, createHash } from "node:crypto"
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
  ).map((r) => JSON.parse(r.value)).filter(m=>!m.removedAt).sort((a,b)=>(a.position??Number.MAX_SAFE_INTEGER)-(b.position??Number.MAX_SAFE_INTEGER)||String(a.uploadedAt||" ").localeCompare(String(b.uploadedAt||" "))||a.id.localeCompare(b.id))
export async function propertyMediaApi(db, user, req, path, url, body, trustOptions) {
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
    if(villa?.status!=="approved"||(await trustDto(db,villa,undefined,trustOptions)).qrStatus!=="ACTIVE")villa=null
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
    const storedMedia = path.startsWith("/api/public/")&&villa._approvedSnapshot?structuredClone(villa._approvedSnapshot.media):await list(db,villa.id)
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
      demoImage:trustOptions?.demoImages===true&&isDemoVilla(villa),
      coverUrl:villa.photo_url,limits:villaMediaLimits,counts:countVillaMedia(villa,storedMedia),
      latestUpdatedAt:
        media
          .map((m) => m.uploadedAt)
          .filter(Boolean)
          .sort()
          .at(-1) || null,
    }
  }
  if (req.method !== "POST" || !user) fail(405, "ไม่รองรับคำสั่งนี้")
  const data=await body(req)
  return db.transaction(async () => {
    await assertWriteSession(db,user);
    villa = await db
      .prepare("SELECT * FROM villas WHERE id=?")
      .get(data.villaId)
    if (!villa || (user.role === "merchant" && villa.owner_id !== user.id))
      fail(404, "ไม่พบที่พัก")
    if(user.role==='merchant'&&data.action==='reorder'){
      const current=await list(db,villa.id),images=current.filter(m=>m.kind==='image'&&m.url!==villa.photo_url),ids=data.mediaIds;
      if(!Array.isArray(ids)||ids.length!==images.length||new Set(ids).size!==ids.length||ids.some(id=>!images.some(m=>m.id===id)))fail(400,'ลำดับรูปภาพไม่ถูกต้อง กรุณาโหลดข้อมูลล่าสุด');
      await preserveApprovedVilla(db,villa);
      for(let i=0;i<ids.length;i++){const image=images.find(m=>m.id===ids[i]);await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...image,position:i}),'property_media:'+villa.id+':'+image.id)}
      await recordVillaReview(db,villa,{...villa,_mediaOrderBefore:images.map(m=>m.id),_mediaOrderAfter:ids},'media_reorder',user);
      await db.prepare("UPDATE villas SET status='pending' WHERE id=?").run(villa.id);await audit(db,user,'media.order_changed',villa.id);return {ok:true,approvalRequired:true};
    }
    if(user.role==='merchant'&&data.action==='set-cover'){
      await assertVillaCoverLimit(db,villa,(await list(db,villa.id)).find(m=>m.id===data.mediaId&&m.kind==='image')?.url||'');
      const media=(await list(db,villa.id)).find(m=>m.id===data.mediaId&&m.kind==='image');if(!media)fail(404,'ไม่พบรูปภาพ');
      await preserveApprovedVilla(db,villa);await recordVillaReview(db,villa,{...villa,photo_url:media.url},'cover_change',user);
      await db.prepare("UPDATE villas SET photo_url=?,photo_uploaded_at=?,photo_taken_at=?,photo_reviewed_at=NULL,status='pending' WHERE id=?").run(media.url,media.uploadedAt,media.takenAt,villa.id);await audit(db,user,'media.cover_changed',villa.id);return {ok:true};
    }
    if(user.role==='merchant'&&data.action==='remove'&&data.mediaId==='cover'){
      await preserveApprovedVilla(db,villa);await recordVillaReview(db,villa,{...villa,photo_url:''},'cover_removal',user);
      for(const image of (await list(db,villa.id)).filter(m=>m.kind==='image'&&m.url===villa.photo_url))await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...image,removedAt:new Date().toISOString(),removedBy:user.id}),'property_media:'+villa.id+':'+image.id);
      await db.prepare("UPDATE villas SET photo_url='',photo_uploaded_at=NULL,photo_taken_at=NULL,photo_reviewed_at=NULL,status='pending' WHERE id=?").run(villa.id);await audit(db,user,'media.cover_removed',villa.id);return {ok:true};
    }
    if(user.role==="merchant"&&data.action==="remove"){
      const key="property_media:"+villa.id+":"+data.mediaId,row=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key)
      if(!row)fail(404,"ไม่พบสื่อ")
      const media=JSON.parse(row.value);if(media.removedAt)return {ok:true}
      await recordVillaReview(db,villa,{...villa,_removedMedia:media},"media_removal",user)
      if(villa.photo_url===media.url)await db.prepare("UPDATE villas SET photo_url='',photo_reviewed_at=NULL WHERE id=?").run(villa.id)
      media.removedAt=new Date().toISOString();media.removedBy=user.id
      await db.prepare("UPDATE system_settings SET value=? WHERE key=?").run(JSON.stringify(media),key)
      await db.prepare("UPDATE villas SET status='pending' WHERE id=?").run(villa.id)
      await audit(db,user,"media.remove_requested",media.id)
      return {ok:true,approvalRequired:true}
    }
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
        if(m.removedAt)fail(404,"ไม่พบสื่อ")
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
    const uploadRequestId=data.uploadRequestId
    if(uploadRequestId!==undefined&&(typeof uploadRequestId!=="string"||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(uploadRequestId)))fail(400,"รหัสคำขออัปโหลดไม่ถูกต้อง")
    const requestKey=uploadRequestId?"property_media_request:"+villa.id+":"+uploadRequestId:null
    const requestFingerprint=requestKey?createHash('sha256').update(JSON.stringify({actor:user.id,villa:villa.id,action:data.action||"upload",replacing:data.mediaId||null,takenAt:data.takenAt||null,type:file?.type,name:file?.name,content:typeof file?.data==='string'?createHash('sha256').update(file.data).digest('hex'):null})).digest('hex'):null
    if(requestKey){const previous=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(requestKey);if(previous){const stored=JSON.parse(previous.value);if(stored.fingerprint!==requestFingerprint)fail(409,"คำขออัปโหลดนี้ถูกใช้กับไฟล์หรือข้อมูลอื่นแล้ว");return {media:stored.media,replayed:true}}}
    const period=await merchantFreePeriod(db,villa.owner_id)
    const plan = await getPlan(
      db,
      period?"starter":villa.payments === 0 ? "basic" : villa.package_id,
    )
    if(kind==="video"){const sub=await db.prepare("SELECT lifecycle FROM subscriptions WHERE owner_id=?").get(villa.owner_id);if(["SUSPENDED","CANCELLED"].includes(sub?.lifecycle))fail(403,"สิทธิ์วิดีโอถูกระงับ กรุณาติดต่อผู้ดูแล")}
    if (
      kind === "video" &&
      (!["starter", "pro", "premium"].includes(plan.id) ||
        !(period?.state==='ACTIVE')&&(!villa.expires ||
        Date.parse(villa.expires) <= Date.now()))
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
    const replaced=await assertVillaMediaLimit(db,villa,kind,data.action==='replace'?data.mediaId:undefined)
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
    if(replaced){await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...replaced,removedAt:new Date().toISOString(),removedBy:user.id,replacedBy:id}),'property_media:'+villa.id+':'+replaced.id);if(villa.photo_url===replaced.url)await db.prepare('UPDATE villas SET photo_url=?,photo_uploaded_at=?,photo_taken_at=?,photo_reviewed_at=NULL WHERE id=?').run(media.url,media.uploadedAt,media.takenAt,villa.id)}
    if(replaced){await recordVillaReview(db,villa,{...villa,_addedMedia:media},'media_replacement',user);await db.prepare("UPDATE villas SET status='pending' WHERE id=?").run(villa.id)}
    await audit(db, user, "media.upload", id)
    if(requestKey)await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(requestKey,JSON.stringify({fingerprint:requestFingerprint,media,createdAt:new Date().toISOString()}))
    return { media }
  })
}
export async function propertyMediaFile(db, id, user, trustOptions) {
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
  const visible=published?.status==="approved"&&(await trustDto(db,published,undefined,trustOptions)).qrStatus==="ACTIVE"&&(published._approvedSnapshot?published._approvedSnapshot.media.some(item=>item.id===id):Boolean(m.reviewedAt&&!m.removedAt))
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
