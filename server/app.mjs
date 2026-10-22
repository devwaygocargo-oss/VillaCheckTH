import {villaPage,villaPagesApi} from "./villa-pages.mjs";
import {presentationMedia} from "./cms-presentation.mjs"
import {accountManagement} from "./account-management.mjs"
import { ownerVerificationApi, publicOwnerVerification } from "./owner-verification.mjs"
import { basicVerificationNotice } from "./package-content.mjs"
import { loadTrustContext, selectByIds } from "./villa-read-context.mjs"
import { readContextPlan } from "./catalog.mjs"
import { shortcutMediaUrls } from "./cms-home-config.mjs"
import {propertyMediaApi,propertyMediaFile} from "./property-media.mjs";
import {advertisingApi} from "./advertising.mjs";
import {socialMaterialsApi,socialMaterialFile,cleanupSocialUploads} from "./social-materials.mjs";
import {reviewsApi} from "./reviews.mjs";
import { createInvoice } from "./database.mjs";
import { mediaDate } from "./media-date.mjs";
import {smtpDiagnostic} from "./smtp-diagnostics.mjs"
import {acceptanceApi} from "./acceptance.mjs"
import {promotionsApi,selectCoupon} from "./promotions.mjs"
import { changeApprovals } from "./change-approvals.mjs"
import { receivingBank,bankInstructions } from "./payment-account.mjs"
import { adminReceivingBank } from "./bank-receiving.mjs"
import {villaReview,recordVillaReview} from './villa-review.mjs'
import {dummyPdf} from './demo-seed.mjs'
import { cmsLoginConfig } from "./cms-business.mjs"
import {createLoginOtp,otpChannels,probeSmsCredit} from './login-otp.mjs'
import { guestCapacity } from './guest-capacity.mjs'
import {saveVillaPhoto} from './villa-photo.mjs'
import {demoSlip,demoMode} from "./demo-payment.mjs"
import {createReport, recordEvent, operations} from "./operations.mjs"
import { adminBusiness } from "./admin-business.mjs"
import { readiness } from "./readiness.mjs"
import { adminCms, publishedCms, cmsPaymentInstructions } from "./cms.mjs"
import { generatePaymentQr, paymentQrDto } from "./payment-qr.mjs"
import {
  getPlan,
  listPlans,
  trustDto,
  getVerificationMode,
  levels,
} from "./catalog.mjs"
import { PaymentVerificationService } from "./payment-verification.mjs"
import { confirmPayment } from "./payment-service.mjs"
import {
  getSubscription,
  subscriptionDto,
  activateVilla,
} from "./subscriptions.mjs"
import { createOAuth, oauthProviders } from "./oauth.mjs"
import { createServer } from "node:http"
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"
import { resolve, sep } from "node:path"
import {
  audit,
  createUser,
  transaction,
  verifyPassword,
} from "./database.mjs"
import { createMailWorker } from "./mail.mjs"
class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const fail = (status, message) => {
  throw new ApiError(status, message)
}
const hash = (value) => createHash("sha256").update(value).digest("hex")
const text = (value, label, max = 200) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) ||
    (max < 2000 && /[\t\r\n]/.test(value))
  )
    fail(400, `กรุณาระบุ ${label} ให้ถูกต้อง`)
  return value.trim()
}
function email(value) {
  const normalized = text(value, "อีเมล", 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) fail(400, "อีเมลไม่ถูกต้อง")
  return normalized
}
function password(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128)
    fail(400, "รหัสผ่านต้องมี 10–128 ตัวอักษร")
  return value
}
async function body(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    fail(415, "ต้องส่งข้อมูล JSON")
  if (req.body !== undefined) {
    const encoded =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body)
    if (Buffer.byteLength(encoded) > 3 * 1024 * 1024)
      fail(413, "ไฟล์มีขนาดใหญ่เกินไป")
    try {
      const data =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body
      if (!data || Array.isArray(data) || typeof data !== "object")
        throw Error()
      return data
    } catch {
      fail(400, "ข้อมูล JSON ไม่ถูกต้อง")
    }
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 3 * 1024 * 1024) fail(413, "ไฟล์มีขนาดใหญ่เกินไป")
    chunks.push(chunk)
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString())
    if (!data || Array.isArray(data) || typeof data !== "object") throw Error()
    return data
  } catch {
    fail(400, "ข้อมูล JSON ไม่ถูกต้อง")
  }
}
function document(value) {
  if (!value || typeof value !== "object") fail(400, "ต้องแนบเอกสาร")
  const name = text(value.name, "ชื่อไฟล์", 180).replace(/[\\/]/g, "_")
  const match =
    typeof value.data === "string" &&
    value.data.match(
      /^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/,
    )
  if (!match) fail(400, "รับเฉพาะ PDF, JPG, PNG")
  const bytes = Buffer.from(match[2], "base64")
  if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024)
    fail(400, "ไฟล์ต้องมีขนาดไม่เกิน 2 MB")
  const mime = match[1]
  const valid =
    mime === "application/pdf"
      ? bytes.subarray(0, 5).toString() === "%PDF-"
      : mime === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (!valid) fail(400, "เนื้อหาไฟล์ไม่ตรงกับชนิดเอกสาร")
  return { name, mime, bytes }
}
async function insertDocument(db, owner, file) {
  const id = randomUUID()
  await db
    .prepare("INSERT INTO documents VALUES (?,?,?,?,?)")
    .run(id, owner, file.name, file.mime, file.bytes)
  return id
}
export function createApp(db, config, transport) {
  const worker = createMailWorker(db, config, transport)
  const attempts = new Map()
  async function rateLimit(req, bucket = "auth") {
    // Vercel overwrites this header. Other hosts use only the direct socket IP.
    const address = config.serverless
      ? req.headers["x-vercel-forwarded-for"] ||
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress
      : req.socket.remoteAddress
    const key = hash(String(address) + (bucket === "events" ? ":events" : ""))
    const limit = bucket === "events" ? 300 : 30
    const now = Date.now()
    if (config.serverless) {
      const entry = await db.transaction(async () => {
        await db.prepare("DELETE FROM rate_limits WHERE expires<=?").run(now)
        return db
          .prepare(
            "INSERT INTO rate_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=rate_limits.count+1 RETURNING count",
          )
          .get(key, now + 15 * 60000)
      })
      if (entry.count > limit) fail(429, "คำขอถี่เกินไป กรุณารอ 15 นาที")
      return
    }
    if (attempts.size > 10000)
      for (const [id, entry] of attempts)
        if (entry.until <= now) attempts.delete(id)
    const entry = attempts.get(key) || { count: 0, until: now + 15 * 60000 }
    if (entry.until <= now) {
      entry.count = 0
      entry.until = now + 15 * 60000
    }
    entry.count++
    attempts.set(key, entry)
    if (entry.count > limit) fail(429, "คำขอถี่เกินไป กรุณารอ 15 นาที")
  }
  const cookie = (token, age = 28800, admin = false) =>
    `${admin ? "vc_admin_session" : "vc_session"}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${age}${
      config.secureCookies ? "; Secure" : ""
    }`
  async function issueSession(req, user) {
    const admin=user.role === "admin";
    if(admin && new URL(req.url,"http://localhost").pathname !== "/api/auth/admin-login")fail(403,"บัญชี Admin ต้องเข้าสู่ระบบที่ /admin/login เท่านั้น");
    const access=await db.prepare("SELECT value FROM system_settings WHERE key=?").get("account_status:"+user.id);
    if(access && JSON.parse(access.value).status === "suspended")fail(403,"บัญชีถูกระงับการเข้าสู่ระบบ กรุณาติดต่อผู้ดูแล");
    const old = req.headers.cookie?.match(new RegExp("(?:^|;\\s*)"+(admin?"vc_admin_session":"vc_session")+"=([a-f0-9]{64})(?:;|$)"))?.[1]
    if (old)
      await db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(old))
    await db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now())
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex")
    await db
      .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
      .run(hash(token), user.id, csrf, Date.now() + 28800000)
    await db
      .prepare("UPDATE users SET last_login=? WHERE id=?")
      .run(new Date().toISOString(), user.id)
    return { csrf, cookie: cookie(token,28800,admin) }
  }
  const loginOtp=createLoginOtp(db,config,transport,config.smsFetch||fetch)
  async function session(req) {
    const path=new URL(req.url,"http://localhost").pathname;
    const adminAsset=/^\/api\/public\/(cms-media|property-media-file)\//.test(path);
    const publicOnly=(!adminAsset && path.startsWith("/api/public/")) || ["/api/auth/me","/api/auth/logout"].includes(path);
    const adminContext=adminAsset || path.startsWith("/api/admin/") || path.startsWith("/api/auth/admin-") || (!publicOnly && req.headers["x-villacheck-portal"] === "admin");
    const names=publicOnly?["vc_session"]:adminContext?["vc_admin_session","vc_session"]:["vc_session","vc_admin_session"];
    let token,name;
    for(const candidate of names){const value=req.headers.cookie?.match(new RegExp("(?:^|;\\s*)"+candidate+"=([a-f0-9]{64})(?:;|$)"))?.[1];if(value){token=value;name=candidate;break}}
    if(!token)fail(401,"กรุณาเข้าสู่ระบบ");
    const row=await db.prepare("SELECT s.*,u.id,u.email,u.name,u.role,a.value AS account_access FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN system_settings a ON a.key='account_status:'||u.id WHERE token_hash=? AND expires>?").get(hash(token),Date.now());
    if(!row || (row.role === "admin" && name !== "vc_admin_session") || (name === "vc_admin_session" && row.role !== "admin"))fail(401,"Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
    if(row.account_access && JSON.parse(row.account_access).status === "suspended")fail(403,"บัญชีถูกระงับการเข้าสู่ระบบ กรุณาติดต่อผู้ดูแล");
    if(path.startsWith("/api/auth/admin-") && row.role !== "admin")fail(403,"เฉพาะ Admin");
    return row;
  }
  function checkOrigin(req) {
    const origin = req.headers.origin
    if (origin && !config.allowedOrigins.includes(origin))
      fail(403, "Origin ไม่ได้รับอนุญาต")
    if (req.headers["sec-fetch-site"] === "cross-site")
      fail(403, "ไม่อนุญาตคำขอข้ามเว็บไซต์")
  }
  async function auth(req, role) {
    const user = await session(req)
    if (role && user.role !== role) fail(403, "ไม่มีสิทธิ์ดำเนินการ")
    if (!["GET", "HEAD"].includes(req.method)) {
      checkOrigin(req)
      if (req.headers["x-csrf-token"] !== user.csrf)
        fail(403, "CSRF token ไม่ถูกต้อง กรุณาโหลดหน้าใหม่")
    }
    return user
  }
  async function villaFor(user, id) {
    const villa = await db.prepare("SELECT * FROM villas WHERE id=?").get(id)
    if (!villa || (user.role !== "admin" && villa.owner_id !== user.id))
      fail(404, "ไม่พบ Villa")
    return villa
  }
  async function invoiceFor(user, id) {
    const invoice = await db
      .prepare("SELECT * FROM invoices WHERE id=?")
      .get(id)
    if (!invoice) fail(404, "ไม่พบใบแจ้งชำระ")
    const villa = await villaFor(user, invoice.villa_id)
    return { invoice, villa }
  }
  async function invoiceDto(invoice,context) {
    const file =
      invoice.proof_id &&
      (context ? context.documents.get(invoice.proof_id) : await db
        .prepare("SELECT name,mime FROM documents WHERE id=?")
        .get(invoice.proof_id))
    return {
      id: invoice.id,
      packageName: (await readContextPlan(db,invoice.package_id || (context?.villas.get(invoice.villa_id) || await db.prepare("SELECT package_id FROM villas WHERE id=?").get(invoice.villa_id)).package_id,context)).name,
      bankQrImage: JSON.parse((await db.prepare("SELECT value FROM system_settings WHERE key=?").get(`invoice_bank_qr:${invoice.id}`))?.value || '""'),
      paymentQr: await paymentQrDto(db, invoice.id),
      scope: invoice.subscription_owner ? "merchant" : "villa",
      villaId: invoice.villa_id,
      amount: invoice.amount / 100,
      months: invoice.months,
      paymentInstructions: (await db.prepare("SELECT payment_instructions FROM mails WHERE invoice_id=?").get(invoice.id))?.payment_instructions ?? null,
      status: invoice.status,
      paymentStatus: invoice.payment_status,
      verificationMode: invoice.verification_mode,
      verifiedByAdminId: invoice.confirmed_by,
      externalTransactionId: invoice.external_transaction_id,
      currency: invoice.currency,
      updatedAt: invoice.updated_at || invoice.created,
      verifiedAt: invoice.paid_at,
      rejectionReason: invoice.reason,
      reference: invoice.reference,
      reason: invoice.reason,
      created: invoice.created,
      paidAt: invoice.paid_at,
      proof: file
        ? {
            name: file.name,
            type: file.mime,
            data: `/api/documents/${invoice.proof_id}`,
          }
        : null,
    }
  }
  async function villaDto(v,context) {
    const file = context ? context.documents.get(v.document_id) : await db
      .prepare("SELECT name,mime FROM documents WHERE id=?")
      .get(v.document_id)
    const invoices = context ? (context.invoices.get(v.id)||[]) : await db
      .prepare("SELECT * FROM invoices WHERE villa_id=? ORDER BY created DESC")
      .all(v.id)
    const packagePlan=await readContextPlan(db,v.package_id,context)
    return {
      id: v.id,
      name: v.name,
      nameEn: v.name_en,
      trialUnlimited: v.payments === 0,
      createdAt: v.created,
      photoUrl: v.photo_url,
      photoUploadedAt: v.photo_uploaded_at, photoTakenAt: v.photo_taken_at, photoReviewedAt: v.photo_reviewed_at,
      guestCapacity: v.guest_capacity,
      reviewRequest: await villaReview(db,v,context ? context.settings.get("villa_review:"+v.id) ?? null : undefined),
      province: v.province,
      merchant: v.merchant,
      email: v.email,
      package: `${packagePlan.name} · ฿${packagePlan.amount / 100} / เดือน`,
      documentReviewStatus: {
        pending: "PENDING_REVIEW",
        approved: "APPROVED",
        changes: "CHANGE_REQUESTED",
        rejected: "REJECTED",
      }[v.status],
      reviewedAt: v.reviewed_at,
      reviewedByAdminId: v.reviewed_by,
      ...(await trustDto(db, v, context)),
      packageId: v.package_id,
      phone: v.phone,
      bankName: v.bank_name,
      accountName: v.account_name,
      accountNumber: v.account_number,
      status: v.status,
      reason: v.reason,
      qr: v.qr || "",
      expires: v.expires || "",
      payments: v.payments,
      paymentPending: invoices.some((i) => i.status !== "paid"),
      document: {
        name: file.name,
        type: file.mime,
        data: `/api/documents/${v.document_id}`,
      },
      invoices: await Promise.all(invoices.map(invoice=>invoiceDto(invoice,context))),
    }
  }
  async function state(user) {
    const [villas,mails,isDemo,subscription,paymentVerificationMode] = await Promise.all([
      user.role === "admin"
        ? db.prepare("SELECT * FROM villas ORDER BY created DESC").all()
        : db
            .prepare(
              "SELECT * FROM villas WHERE owner_id=? ORDER BY created DESC",
            )
            .all(user.id),
      user.role === "admin"
        ? db.prepare("SELECT * FROM mails ORDER BY created DESC").all()
        : db.prepare("SELECT m.* FROM mails m JOIN villas v ON v.id=m.villa_id WHERE v.owner_id=? ORDER BY m.created DESC").all(user.id),
      demoMode(db,config),
      subscriptionDto(db,user.id),
      getVerificationMode(db,config.paymentVerificationMode||"MANUAL"),
    ])
    const [context,invoiceRows,bank,cms]=await Promise.all([
      loadTrustContext(db,villas,{reviews:true}),
      selectByIds(db,"SELECT * FROM invoices WHERE villa_id",villas.map(v=>v.id)," ORDER BY created DESC"),
      isDemo?null:receivingBank(db),
      isDemo?null:publishedCms(db),
    ]);
    const documents=await selectByIds(db,"SELECT id,name,mime FROM documents WHERE id",[...villas.map(v=>v.document_id),...invoiceRows.map(i=>i.proof_id)]);
    context.documents=new Map(documents.map(row=>[row.id,row]));
    context.villas=new Map(villas.map(v=>[v.id,v]));
    context.invoices=new Map();
    for(const invoice of invoiceRows){const rows=context.invoices.get(invoice.villa_id)||[];rows.push(invoice);context.invoices.set(invoice.villa_id,rows);}
    const instructions=isDemo ? "DEMO: test payment only. Do not transfer real money. Generate a dummy slip for Admin manual review." : bank?bankInstructions(bank):cms.content.site.paymentInstructions||config.paymentInstructions;
    return {
      villas: await Promise.all(villas.map(v=>villaDto(v,context))),
      mails: mails.map((m) => ({
        id: m.id,
        villaId: m.villa_id,
        to: m.recipient,
        subject: m.subject,
        body: m.body,
        created: m.created,
        status: m.status === "demo" ? "demo" : !transport && m.status !== "sent" ? "waiting_config" : m.status,
        error: m.last_error,
      })),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      subscription,
      packageModel: "PER_VILLA",
      demoMode:isDemo,
      paymentBankQrImage: isDemo ? "" : (bank?.qrImage || cms.content.site.paymentQrImage || ""),
      paymentInstructions:
        instructions ||
        "ยังไม่ได้ตั้งค่าบัญชีรับชำระ กรุณาติดต่อทีมงานก่อนโอนเงิน",
      paymentVerificationMode,
      paymentConfigured: isDemo || Boolean(instructions),
      smtpConfigured: Boolean(transport),
    }
  }
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Referrer-Policy", "same-origin")
    res.setHeader("Cache-Control", "no-store")
    const json = (value, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      })
      res.end(JSON.stringify(value))
    }
    try {
      const url = new URL(req.url, "http://localhost")
      let path = url.pathname
      if (path === "/api/public/cms" && req.method === "GET") {
        const release = await publishedCms(db)
        const content = structuredClone(release.content)
        content.site.paymentInstructions = ""
        content.site.paymentQrImage = ""
        content.business.paymentEmailSubject = ""
        content.business.paymentEmailIntro = ""
        for(const key of ["emailOtpSubject","emailOtpBody","smsOtpBody","emailOtpTemplateId"])content.business[key]=""
        content.articles = content.articles.filter(x => x.visible)
        content.faqs = content.faqs.filter(x => x.visible)
        content.home.blocks = content.home.blocks.filter(x => x.visible)
        content.pages = content.pages.map(p => ({...p, blocks:p.blocks.filter(x => x.visible)}))
        return json({revision:release.revision, content})
      }
      if(path === "/api/public/property-media" && req.method === "GET") return json(await propertyMediaApi(db,null,req,path,url,body));
      const mediaFile=path.match(/^\/api\/public\/property-media-file\/([a-f0-9-]{36})$/)
      if(mediaFile && req.method === "GET") {
        const viewer=await session(req).catch(e=>{if(e.status===401)return null;throw e})
        const file=await propertyMediaFile(db,mediaFile[1],viewer)
        res.writeHead(200,{"Content-Type":file.mime,"Cache-Control":"private, no-store","Content-Length":Buffer.byteLength(file.bytes),"X-Content-Type-Options":"nosniff"});return res.end(Buffer.from(file.bytes))
      }
      if(path === "/api/public/advertisements" && req.method === "GET") return json(await advertisingApi(db,null,req,path,url,body));
      if(path === "/api/public/reviews" && req.method === "GET") return json(await reviewsApi(db,null,req,path,url,body));
      const cmsMedia = path.match(/^\/api\/public\/cms-media\/([a-f0-9-]+)$/)
      if (cmsMedia && req.method === "GET") {
        const release = await publishedCms(db)
        const imageUrls = [...release.content.home.sections.filter(s=>s.visible).map(s=>s.image||""),release.content.site.logo,...shortcutMediaUrls(release.content,true),...presentationMedia(release.content,true),...release.content.home.images,...(release.content.home.banners || []).filter(b=>b.visible && (!b.startsAt || Date.parse(b.startsAt)<=Date.now()) && (!b.endsAt || Date.parse(b.endsAt)>Date.now())).flatMap(b=>[b.image,b.mobileImage]), ...release.content.home.blocks.filter(x=>x.visible).map(x=>x.image), ...release.content.pages.flatMap(p=>p.blocks.filter(x=>x.visible).map(x=>x.image)), ...release.content.articles.filter(x=>x.visible).flatMap(x=>[x.image,...(x.blocks||[]).filter(b=>b.visible).map(b=>b.image)])]
        if (!imageUrls.includes(path)) {
          for(const placement of ["home","detail","footer"]) {
            const result=await advertisingApi(db,null,{method:"GET"},"/api/public/advertisements",new URL("http://localhost?placement="+placement),body)
            imageUrls.push(...result.advertisements.flatMap(a=>[a.image,a.mobileImage]))
          }
        }
        if (!imageUrls.includes(path)) {
          const viewer = await session(req).catch(error => { if (error.status === 401) return null; throw error })
          const merchantQr = viewer?.role === "merchant" && (release.content.site.paymentQrImage === path || await db.prepare("SELECT i.id FROM invoices i JOIN villas v ON v.id=i.villa_id JOIN system_settings s ON s.key='invoice_bank_qr:' || i.id WHERE v.owner_id=? AND s.value=?").get(viewer.id,JSON.stringify(path)))
          if (viewer?.role !== "admin" && !merchantQr) fail(404, "ไม่พบรูปภาพ")
        }
        const image = await db.prepare("SELECT mime,bytes FROM documents WHERE id=? AND name LIKE 'cms-image:%'").get(cmsMedia[1])
        if (!image) fail(404, "ไม่พบรูปภาพ")
        res.writeHead(200, {"Content-Type": image.mime,"Cache-Control":"private, no-store"})
        return res.end(Buffer.from(image.bytes))
      }
      const adminPaymentAction = path.match(
        /^\/api\/admin\/payments\/([a-f0-9-]+)\/(approve|reject)$/,
      )
      if (req.method === "PATCH" && adminPaymentAction)
        path = `/api/invoices/${adminPaymentAction[1]}/${
          adminPaymentAction[2] === "approve" ? "confirm" : "reject"
        }`
      const slipAction = path.match(/^\/api\/payments\/([a-f0-9-]+)\/slip$/)
      if (slipAction) path = `/api/invoices/${slipAction[1]}/proof`
      const publicPhoto=path.match(/^\/api\/public\/villa-photo\/([a-f0-9-]+)$/)
      if(req.method==='GET'&&publicPhoto){
        const photo=await db.prepare('SELECT d.mime,d.bytes FROM documents d JOIN villas v ON v.photo_url=? AND v.owner_id=d.owner_id WHERE d.id=? AND d.name=?').get(path,publicPhoto[1],'villa-photo')
        if(!photo||!['image/jpeg','image/png'].includes(photo.mime))fail(404,'ไม่พบรูป Villa')
        res.writeHead(200,{'Content-Type':photo.mime});return res.end(Buffer.from(photo.bytes))
      }
      const publicReport=path.match(/^\/api\/public\/reports\/(RPT-[A-Za-z0-9-]{1,64})$/)
      if(req.method === "GET" && publicReport){
        const report=await db.prepare("SELECT reference,status,public_note,user_id FROM support_reports WHERE reference=?").get(publicReport[1])
        if(!report)fail(404,"ไม่พบ Report")
        let viewer;try{viewer=await session(req)}catch(error){if(error.status!==401)throw error}
        return json({reference:report.reference,status:report.status,publicNote:report.public_note,linkedToUser:Boolean(viewer && viewer.id===report.user_id)})
      }
      if (req.method === "POST" && ["/api/public/reports","/api/public/events"].includes(path)) {
        checkOrigin(req); await rateLimit(req,path==="/api/public/events"?"events":"auth")
        const data=await body(req)
        if(path==="/api/public/events")return json(await recordEvent(db,data.qr,data.kind))
        let viewer
        try {viewer=await session(req)} catch(error){if(error.status!==401)throw error}
        if(viewer && req.headers["x-csrf-token"]!==viewer.csrf)fail(403,"CSRF token ไม่ถูกต้อง")
        return json(await createReport(db,data,viewer))
      }
      if (req.method === "POST" && path === "/api/leads") {
        await rateLimit(req)
        checkOrigin(req)
        const data = await body(req)
        if (!["USER", "MERCHANT"].includes(data.type))
          fail(400, "ประเภท Lead ไม่ถูกต้อง")
        const name = text(data.name, "ชื่อ"),
          address = email(data.email),
          phone = typeof data.phone === "string" ? data.phone.trim() : ""
        if (phone.length > 30) fail(400, "เบอร์โทรไม่ถูกต้อง")
        const now = new Date().toISOString()
        await db
          .prepare(
            "INSERT INTO leads(id,type,name,email,phone,source,created,updated) VALUES (?,?,?,?,?,'CONTACT',?,?)",
          )
          .run(randomUUID(), data.type, name, address, phone, now, now)
        return json({ ok: true })
      }
      if (req.method === "GET" && path === "/api/packages") {
        const viewer=await auth(req)
        if(!["merchant","admin"].includes(viewer.role))fail(403,"แพ็กเกจสำหรับ Merchant ใน Member Room")
        return json({ packages: await listPlans(db) })
      }
      if (req.method === "GET" && path === "/api/health")
        return json({ ok: true })
      if (req.method === "GET" && path === "/api/config")
        return json({
          localAccounts: Boolean(config.seedDemo),
          paymentConfigured: (await demoMode(db,config)) || Boolean(await cmsPaymentInstructions(db, config.paymentInstructions)),
          oauth: oauthProviders(await cmsLoginConfig(db,config)),
          oauthStatus:{facebook:(await cmsLoginConfig(db,config)).facebookLoginEnabled?"enabled":"pending_approval"},
          otp: otpChannels(await cmsLoginConfig(db,config),transport),
          demoMode: await demoMode(db,config),
        })
      if (
        req.method === "GET" &&
        /^\/api\/auth\/oauth\/(google|facebook|line)\/start$/.test(path)
      )
        await rateLimit(req)
      if (/^\/api\/auth\/oauth\/facebook\/(start|callback)$/.test(path) && !(await cmsLoginConfig(db,config)).facebookLoginEnabled){res.writeHead(302,{Location:`${config.appUrl}/#page=login&oauth_error=pending_approval`});res.end();return}
      if (path.startsWith("/api/auth/oauth/")) {
        const linking=req.method==='POST'&&/^\/api\/auth\/oauth\/(google|facebook|line)\/link$/.test(path)
        let linkUser=linking?await auth(req,'merchant'):null
        if(req.method==='GET'&&path.endsWith('/callback')&&/^[a-f0-9]{64}$/.test(url.searchParams.get('state')||'')){
          const pending=await db.prepare('SELECT return_to FROM oauth_states WHERE state_hash=?').get(hash(url.searchParams.get('state')))
          const bindingId=pending?new URLSearchParams(pending.return_to.slice(1)).get('linkAccount'):null
          if(bindingId){linkUser=await auth(req,'merchant');if(linkUser.id!==bindingId)fail(403,'ใช้บัญชี Merchant ที่เริ่มเชื่อมช่องทางนี้')}
        }
        if(await createOAuth(db,await cmsLoginConfig(db,config),issueSession,config.oauthFetch||fetch)(req,res,url,linkUser))return
      }
      if(req.method==='POST'&&['/api/auth/otp/request','/api/auth/otp/verify'].includes(path)){
        checkOrigin(req);await rateLimit(req);const data=await body(req)
        if(path.endsWith('/request')){const bindingUser=data.purpose==='link_identity'?await auth(req,'merchant'):null;try{return json(await loginOtp.request(data,bindingUser))}catch(error){if(error.status===503)fail(503,error.message);throw error}}
        const challenge=typeof data.challengeId==='string'?await db.prepare('SELECT binding_user_id FROM login_otps WHERE id=?').get(data.challengeId):null
        const bindingUser=challenge?.binding_user_id?await auth(req,'merchant'):null
        let user;try{user=await loginOtp.verify(data,bindingUser)}catch(error){if(error.status===503)fail(503,error.message);throw error};const issued=await issueSession(req,user)
        res.setHeader('Set-Cookie',issued.cookie);return json({user:{id:user.id,email:user.email,name:user.name,role:user.role},csrf:issued.csrf})
      }
      if (
        req.method === "POST" &&
        [
          "/api/auth/login",
          "/api/auth/admin-login",
          "/api/auth/register",
          "/api/auth/register-user",
        ].includes(path)
      ) {
        checkOrigin(req)
        await rateLimit(req)
        if(path === "/api/auth/admin-login" && process.env.VERCEL === "1" && new URL(config.appUrl).hostname === "design-villacheck.vercel.app" && req.headers.host?.split(":")[0] !== "design-villacheck.vercel.app")fail(403,"เข้าสู่ระบบ Admin ที่ https://design-villacheck.vercel.app/admin/login เท่านั้น");
        const data = await body(req)
        let user
        if (path.endsWith("register") || path.endsWith("register-user")) {
          const address = email(data.email)
          const pass = password(data.password)
          const name = text(data.name, "ชื่อผู้สมัคร")
          if (
            await db.prepare("SELECT id FROM users WHERE email=?").get(address)
          )
            fail(409, "อีเมลนี้ถูกใช้งานแล้ว")
          if (path === "/api/auth/register") text(data.businessNameEn, "ชื่อ Merchant ภาษาอังกฤษ");
          user = await createUser(
            db,
            address,
            pass,
            name,
            path.endsWith("register-user") ? "user" : "merchant",
          )
          if (path === "/api/auth/register") {
            const businessName = text(data.name, "ชื่อ Merchant ภาษาไทย");
            const businessNameEn = text(data.businessNameEn, "ชื่อ Merchant ภาษาอังกฤษ");
            await db.prepare("UPDATE users SET business_name=?,business_name_en=? WHERE id=?").run(businessName,businessNameEn,user.id);
          }
        } else {
          const address = email(data.email)
          if (typeof data.password !== "string" || data.password.length > 128)
            fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
          user = await db
            .prepare("SELECT * FROM users WHERE email=?")
            .get(address)
          // Equal-cost verification for unknown accounts.
          const fakeHash = config.fakeHash
          if (
            !verifyPassword(data.password, user?.password_hash || fakeHash) ||
            !user
          )
            fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
        }
        if(path === "/api/auth/admin-login" && user.role !== "admin")fail(403,"เฉพาะบัญชี Admin เท่านั้น");
        const { csrf, cookie: sessionCookie } = await issueSession(req, user)
        res.setHeader("Set-Cookie", sessionCookie)
        return json({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          csrf,
        })
      }
      if (req.method === "GET" && ["/api/auth/me","/api/auth/admin-me"].includes(path)) {
        const user = await session(req)
        return json({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          csrf: user.csrf,
        })
      }
      if (req.method === "POST" && ["/api/auth/logout","/api/auth/admin-logout"].includes(path)) {
        const user = await auth(req)
        const managed = await adminBusiness(
          db,
          user,
          req,
          path,
          url,
          body,
          config,
        )
        if (managed !== undefined) return json(managed)
        await db
          .prepare("DELETE FROM sessions WHERE token_hash=?")
          .run(user.token_hash)
        res.setHeader("Set-Cookie", cookie("", 0,user.role === "admin"))
        return json({ ok: true })
      }
      if (req.method === "GET" && path === "/api/public/villas") {
        const requestedLimit=url.searchParams.get("limit");
        const limit=requestedLimit===null?null:Number(requestedLimit);
        if(requestedLimit!==null&&(!/^\d+$/.test(requestedLimit)||!Number.isInteger(limit)||limit<1||limit>100))fail(400,"จำนวนที่พักต้องเป็นจำนวนเต็ม 1–100");
        const province=(url.searchParams.get("province")||"").trim();
        if(province.length>100||/[\x00-\x1f]/.test(province))fail(400,"จังหวัดไม่ถูกต้อง");
        const rows = await db.prepare("SELECT * FROM villas WHERE status='approved' AND qr IS NOT NULL"+(province?" AND province=?":"")+" ORDER BY created DESC,id DESC"+(limit?" LIMIT ?":"")).all(...(province?[province]:[]),...(limit?[limit]:[]));
        const context=await loadTrustContext(db,rows)
        return json({
          villas: await Promise.all(
            rows.map(async (v) => ({
              id: v.id,
              name: v.name,
              nameEn: v.name_en,
              province: v.province,
              qr: v.qr,
              photoUrl: v.photo_url,
      photoUploadedAt: v.photo_uploaded_at, photoTakenAt: v.photo_taken_at, photoReviewedAt: v.photo_reviewed_at,
              guestCapacity: v.guest_capacity,
              updated: v.reviewed_at || null,
              createdAt: v.created,
              ...(await trustDto(db, v, context)),
            })),
          ),
        })
      }
      const adminQrVerification=path.startsWith("/api/admin/qr-verification/")
      if (req.method === "GET" && (path.startsWith("/api/public/qr/") || adminQrVerification)) {
        let viewer
        if(adminQrVerification){viewer=await auth(req);if(viewer.role!=="admin")fail(403,"เฉพาะ Admin")}
        const v = await db
          .prepare("SELECT * FROM villas WHERE qr=?")
          .get(decodeURIComponent(path.slice(adminQrVerification?"/api/admin/qr-verification/".length:15)))
        if (!v) fail(404, "ไม่พบ QR ในระบบ")
        try {
          if(!viewer)viewer = await session(req)
        } catch (error) {
          if (error.status !== 401) throw error
        }
        const unlocked = viewer?.role === "user" || viewer?.role === "admin"
        return json({
          name: v.name,
          nameEn: v.name_en,
          propertyDetails: await villaPage(db,v),
          guestCapacity:v.guest_capacity,
          bankName:v.bank_name,
          accountName:v.account_name,
          ownerVerification: await publicOwnerVerification(db,v),
          ownerVerificationRequired: ["starter","pro","premium"].includes(v.package_id),
          basicVerificationNotice: v.package_id === "basic" ? basicVerificationNotice : null,
          trialUnlimited: v.payments === 0,
          photoUrl: v.photo_url,
      photoUploadedAt: v.photo_uploaded_at, photoTakenAt: v.photo_taken_at, photoReviewedAt: v.photo_reviewed_at,
          province: v.province,
          status: v.status,
          qr: v.qr,
          expires: v.expires,
          valid: (await trustDto(db, v)).qrStatus === "ACTIVE",
          locked: !unlocked,
          viewerRole: viewer?.role || "guest",
          maskedPhone: "08X-XXX-XXXX",
          maskedBankAccount: "xxx-x-xxxxx-x",
          documentReviewStatus: {
            pending: "PENDING_REVIEW",
            approved: "APPROVED",
            changes: "CHANGE_REQUESTED",
            rejected: "REJECTED",
          }[v.status],
          reviewedAt: v.reviewed_at,
          reviewedByAdminId: v.reviewed_by,
          ...(await trustDto(db, v)),
          ...(unlocked
            ? {
                phone: v.phone,
                accountNumber: v.account_number,
              }
            : {}),
        })
      }
      if(path==="/api/ops/cron"&&req.method==="GET"){
        const expected=config.cronSecret?Buffer.from("Bearer "+config.cronSecret):null,actual=Buffer.from(req.headers.authorization||"")
        if(!expected)fail(503,"Scheduled worker ยังไม่ได้ตั้งค่า")
        if(actual.length!==expected.length||!timingSafeEqual(actual,expected))fail(401,"Unauthorized")
        await worker.run()
        await cleanupSocialUploads(db)
        await db.prepare("INSERT INTO system_settings(key,value) VALUES ('ops:last_cron',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(new Date().toISOString())
        return json({ok:true})
      }
      if (path.startsWith("/api/")) {
        const user = await auth(req)
        if(path==="/api/admin/email-test"&&req.method==="POST"){
          if(user.role!=="admin")fail(403,"เฉพาะ Admin")
          const data=await body(req)
          if(!transport)fail(409,"SMTP ยังไม่พร้อม ต้องตั้งค่าบริการก่อน")
          if(data.confirmed!==true||typeof data.recipient!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.recipient)||data.recipient.length>254)fail(400,"กรุณายืนยันอีเมลทดสอบ")
          if(data.verifyOnly!==undefined&&typeof data.verifyOnly!=="boolean")fail(400,"รูปแบบการตรวจ SMTP ไม่ถูกต้อง")
          if(data.verifyOnly===true&&typeof transport.verify!=="function")fail(409,"บริการนี้ไม่รองรับการตรวจเชื่อมต่อแยก")
          const stamp=await db.prepare("SELECT value FROM system_settings WHERE key='smtp:last_test'").get()
          if(stamp&&Date.now()-Date.parse(JSON.parse(stamp.value).at)<60000)fail(429,"รออย่างน้อย 1 นาทีก่อนทดสอบซ้ำ")
          // Reserve before delivery so a failed request is also rate-limited.
          await db.transaction(async()=>{
            const current=await db.prepare("SELECT value FROM system_settings WHERE key='smtp:last_test'").get()
            if(current&&Date.now()-Date.parse(JSON.parse(current.value).at)<60000)fail(429,"รออย่างน้อย 1 นาที")
            await db.prepare("INSERT INTO system_settings(key,value) VALUES ('smtp:last_test',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify({at:new Date().toISOString(),status:"testing"}))
          })
          try{if(data.verifyOnly===true)await transport.verify();else await transport.sendMail({from:config.smtpFrom,to:data.recipient,subject:"VillaCheck UAT: ทดสอบ SMTP เท่านั้น",text:"ข้อความทดสอบบริการอีเมล VillaCheck ไม่มีการเรียกเก็บเงินและไม่ใช่การยืนยันชำระเงิน กรุณาตอบผู้ตรวจรับว่าได้รับใน Inbox หรือ Spam"})}catch(error){
            const diagnostic=smtpDiagnostic(error)
            await db.prepare("UPDATE system_settings SET value=? WHERE key='smtp:last_test'").run(JSON.stringify({at:new Date().toISOString(),status:"failed",...diagnostic}))
            await audit(db,user,"smtp.test.failed",diagnostic.category)
            fail(502,diagnostic.message)
          }
          await db.prepare("UPDATE system_settings SET value=? WHERE key='smtp:last_test'").run(JSON.stringify({at:new Date().toISOString(),status:data.verifyOnly?"verified":"accepted",category:data.verifyOnly?"CONNECTION_VERIFIED":"SMTP_ACCEPTED",message:data.verifyOnly?"เชื่อมต่อและยืนยัน SMTP ผ่าน ยังไม่ได้ส่งอีเมล":"SMTP รับข้อความแล้ว รอยืนยัน Inbox/Spam จากผู้รับ"}))
          await audit(db,user,"smtp.test",data.recipient)
          return json({ok:true,acceptedBySmtp:!data.verifyOnly,verifiedConnection:true,inboxConfirmationRequired:!data.verifyOnly})
        }
        if(path==='/api/admin/readiness'&&req.method==='GET'){
          if(user.role!=='admin')fail(403,'เฉพาะ Admin')
          return json(await readiness(db,config,transport))
        }
        const bankImage=path.match(/^\/api\/receiving-bank\/qr\/([a-f0-9-]{36})$/)
        if(bankImage&&req.method==="GET"){
          if(!["admin","merchant"].includes(user.role))fail(403,"เฉพาะ Admin และ Merchant")
          const image=await db.prepare("SELECT mime,bytes FROM documents WHERE id=? AND name LIKE 'receiving-bank-qr:%'").get(bankImage[1])
          if(!image)fail(404,"ไม่พบ QR รับเงิน")
          res.writeHead(200,{"Content-Type":image.mime,"Cache-Control":"private, no-store","Content-Disposition":url.searchParams.get("download")==="1"?'attachment; filename="villacheck-bank-qr.png"':"inline"});return res.end(Buffer.from(image.bytes))
        }
        const acceptance=await acceptanceApi(db,user,req,path,body)
        if(acceptance!==undefined)return json(acceptance)
        const promotions=await promotionsApi(db,user,req,path,body)
        if(promotions!==undefined)return json(promotions)
        const approvalResult=await changeApprovals(db,user,req,path,body,async(kind,payload,validateOnly)=>{
          const request={method:"POST"}
          if(kind==="bank")return adminReceivingBank(db,user,request,"/api/admin/receiving-bank",async()=>payload,config,transport,validateOnly)
          const draft=await db.prepare("SELECT value FROM system_settings WHERE key='cms_draft'").get()
          const value=draft?JSON.parse(draft.value):null
          if(!value||!value.revision||payload.revision!==value.revision)fail(409,"ร่าง CMS เปลี่ยนแล้ว กรุณาโหลดล่าสุดและเสนอใหม่")
          if(validateOnly)return
          return adminCms(db,user,request,"/api/admin/cms/publish",async()=>payload)
        })
        if(approvalResult!==undefined)return json(approvalResult)
        if(config.requireDualApproval&&req.method==="POST"&&["/api/admin/receiving-bank","/api/admin/cms/publish"].includes(path))fail(403,"ต้องเสนอคำขอและให้ Admin อีกบัญชีอนุมัติ")
        const bankResult=await adminReceivingBank(db,user,req,path,body,config,transport)
        if(bankResult!==undefined){json(bankResult);if(req.method==="POST")void worker.run();return}
        const cms = await adminCms(db, user, req, path, body)
        if (cms !== undefined) return json(cms)
        if(req.method==='GET'&&path==='/api/admin/otp/status'){
          if(user.role!=='admin')fail(403,'เฉพาะ Admin')
          const email=await db.prepare("SELECT value FROM system_settings WHERE key='otp_delivery_email'").get()
          const sms=await db.prepare("SELECT value FROM system_settings WHERE key='otp_delivery_sms'").get()
          const verification=await db.prepare("SELECT value FROM system_settings WHERE key='otp_verification_email'").get();
          return json({emailVerification:verification?JSON.parse(verification.value):null,channels:otpChannels(await cmsLoginConfig(db,config),transport),email:email?JSON.parse(email.value):null,sms:sms?JSON.parse(sms.value):null,...(url.searchParams.get('probe')==='sms'?{smsProvider:await probeSmsCredit(config)}:{})})
        }
        if(path==='/api/admin/review-sample-document'&&req.method==='GET'){
          if(user.role!=='admin')fail(403,'เฉพาะ Admin');
          res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="DUMMY-ownership-sample.pdf"','Cache-Control':'private, no-store'});
          return res.end(dummyPdf());
        }
        const socialFile=path.match(/^\/api\/social-material-files\/([a-f0-9-]{36})$/)
        if(socialFile&&req.method==="GET"){
          const file=await socialMaterialFile(db,user,socialFile[1],req.headers.range)
          res.writeHead(file.partial?206:200,{"Content-Type":file.mime,"Content-Length":file.bytes.length,"Accept-Ranges":"bytes",...(file.partial?{"Content-Range":`bytes ${file.start}-${file.end}/${file.size}`} : {}),"Content-Disposition":`inline; filename="social-material"; filename*=UTF-8''${encodeURIComponent(file.name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"})
          return res.end(file.bytes)
        }
        const accounts=await accountManagement(db,user,req,path,url,body)
        if(accounts!==undefined)return json(accounts)
        const ownerVerification=await ownerVerificationApi(db,user,req,path,url,body)
        if(ownerVerification!==undefined)return json(ownerVerification)
        const materials=await socialMaterialsApi(db,user,req,path,url,body)
        if(materials!==undefined)return json(materials)
        const propertyMedia=await propertyMediaApi(db,user,req,path,url,body)
        if(propertyMedia!==undefined)return json(propertyMedia)
        const villaPages=await villaPagesApi(db,user,req,path,url,body)
        if(villaPages!==undefined)return json(villaPages)
        const advertising=await advertisingApi(db,user,req,path,url,body)
        if(advertising!==undefined)return json(advertising)
        const reviews=await reviewsApi(db,user,req,path,url,body)
        if(reviews!==undefined)return json(reviews)
        const operation=await operations(db,user,req,path,url,body)
        if(operation!==undefined)return json(operation)
        if (path === "/api/merchant/profile") {
          if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")
          if (req.method === "POST" || req.method === "PATCH") {
            if(user.email.endsWith('@phone.villacheck.invalid'))fail(409,'กรุณายืนยันอีเมลบัญชี Merchant ก่อนบันทึกข้อมูล')
            const data = await body(req)
            await db.transaction(async () => {
              await db
                .prepare(
                  "UPDATE users SET name=?,business_name=?,business_name_en=?,phone=?,address=? WHERE id=?",
                )
                .run(
                  text(data.contactName, "ชื่อผู้ติดต่อ"),
                  text(data.businessName, "ชื่อธุรกิจภาษาไทย"),
                  text(data.businessNameEn, "ชื่อธุรกิจภาษาอังกฤษ"),
                  text(data.phone, "เบอร์โทร", 30),
                  text(data.address, "ที่อยู่", 2000),
                  user.id,
                )
              await db
                .prepare(
                  "UPDATE leads SET phone=?,name=?,updated=? WHERE user_id=?",
                )
                .run(
                  data.phone,
                  data.contactName,
                  new Date().toISOString(),
                  user.id,
                )
            })
          }
          const profile = await db
            .prepare(
              "SELECT name,business_name,business_name_en,phone,address,email FROM users WHERE id=?",
            )
            .get(user.id)
          return json({
            contactName: profile.name,
            businessName: profile.business_name,
            businessNameEn: profile.business_name_en,
            phone: profile.phone,
            address: profile.address,
            email: profile.email,
            loginPhone:(await db.prepare("SELECT subject FROM oauth_identities WHERE provider='phone_otp' AND user_id=?").get(user.id))?.subject||'',
          })
        }
        const managed = await adminBusiness(
          db,
          user,
          req,
          path,
          url,
          body,
          config,
        )
        if (managed !== undefined) return json(managed)
        if (req.method === "GET" && path === "/api/admin/users") {
          if (user.role !== "admin") fail(403, "เฉพาะ Admin")
          const users = await db
            .prepare(
              "SELECT id,name,email,role,created,last_login FROM users WHERE role='user' ORDER BY created DESC",
            )
            .all()
          return json({
            users: await Promise.all(
              users.map(async (u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                created: u.created,
                lastLogin: u.last_login,
                providers: (
                  await db
                    .prepare(
                      "SELECT provider FROM oauth_identities WHERE user_id=?",
                    )
                    .all(u.id)
                ).map((p) => p.provider),
              })),
            ),
          })
        }
        if (!["merchant", "admin"].includes(user.role))
          fail(403, "เฉพาะ Merchant หรือ Admin")
        const assignLevel=path.match(/^\/api\/villas\/([a-f0-9-]+)\/verification-level$/)
        if(req.method === "POST" && assignLevel) {
          if(user.role!=="admin")fail(403,"เฉพาะ Admin")
          const data=await body(req)
          await db.transaction(async()=>{
            const villa=await villaFor(user,assignLevel[1])
            const sub=await getSubscription(db,villa.owner_id)
            const plan=await getPlan(db,villa.payments === 0 ? "basic" : villa.package_id)
            if(villa.status!=="approved")fail(409,"เอกสารต้องผ่านการอนุมัติก่อน")
            if(!levels.includes(data.verificationLevel) || levels.indexOf(data.verificationLevel)>levels.indexOf(plan.max_level))fail(400,"ระดับเกินสิทธิ์แพ็กเกจ")
            await db.prepare("UPDATE villas SET verification_level=?,reviewed_at=?,reviewed_by=? WHERE id=?").run(data.verificationLevel,new Date().toISOString(),user.id,villa.id)
            await audit(db,user,"villa.verification-level",villa.id)
          })
          return json(await state(user))
        }
        const demoPayment=path.match(/^\/api\/payments\/([a-f0-9-]+)\/demo-slip$/)
        if(req.method === "POST" && demoPayment){
          if(user.role!=="merchant")fail(403,"เฉพาะ Merchant")
          if(!await demoMode(db,config))fail(403,"Demo mode ปิดอยู่")
          const {invoice}=await invoiceFor(user,demoPayment[1])
          const qr=await paymentQrDto(db,invoice.id)
          if(invoice.status!=="pending" || qr?.status!=="ACTIVE")fail(409,"ต้องมี Payment QR ที่ยังใช้งานได้")
          return json(demoSlip(invoice))
        }
        const regenerate = path.match(/^\/api\/payments\/([a-f0-9-]+)\/qr$/)
        if (req.method === "POST" && regenerate) {
          if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")
          const { invoice } = await invoiceFor(user, regenerate[1])
          const qr = await db.transaction(() =>
            generatePaymentQr(db, invoice.id, config.appUrl),
          )
          return json(qr)
        }
        if (req.method === "GET" && path === "/api/payments/attempt") {
          const attempt = await db
            .prepare("SELECT * FROM payment_qrs WHERE id=?")
            .get(url.searchParams.get("id"))
          if (!attempt) fail(404, "ไม่พบ Payment QR")
          await invoiceFor(user, attempt.payment_id)
          const latest = await paymentQrDto(db, attempt.payment_id)
          if (latest?.id !== attempt.id || latest.status !== "ACTIVE")
            fail(410, "Payment QR หมดอายุหรือถูกยกเลิก")
          return json({ paymentId: attempt.payment_id, qr: latest })
        }
        if (req.method === "GET" && path === "/api/admin/payments") {
          if (user.role !== "admin") fail(403, "เฉพาะ Admin")
          const status = url.searchParams.get("status")
          const rows = status
            ? await db
                .prepare(
                  "SELECT * FROM invoices WHERE payment_status=? ORDER BY created DESC",
                )
                .all(status)
            : await db
                .prepare("SELECT * FROM invoices ORDER BY created DESC")
                .all()
          return json({
            payments: await Promise.all(
              rows.map(async (row) => ({
                ...(await invoiceDto(row)),
                ownerId: (await villaFor(user, row.villa_id)).owner_id,
                packageId: row.package_id,
              })),
            ),
          })
        }
        const paymentRead = path.match(
          /^\/api\/(admin\/payments|payments)\/([a-f0-9-]+)(\/status)?$/,
        )
        if (req.method === "GET" && paymentRead) {
          if (paymentRead[1] === "admin/payments" && user.role !== "admin")
            fail(403, "เฉพาะ Admin")
          const { invoice, villa } = await invoiceFor(user, paymentRead[2])
          return json({
            ...(await invoiceDto(invoice)),
            ownerId: villa.owner_id,
            ownerName: villa.merchant,
            villaName: villa.name,
            packageId: invoice.package_id,
          })
        }
        if (req.method === "GET" && path === "/api/state")
          return json(await state(user))
        const docMatch = path.match(/^\/api\/documents\/([a-f0-9-]+)$/)
        if (req.method === "GET" && docMatch) {
          const file = await db
            .prepare("SELECT * FROM documents WHERE id=?")
            .get(docMatch[1])
          if (!file || (user.role !== "admin" && file.owner_id !== user.id))
            fail(404, "ไม่พบเอกสาร")
          res.writeHead(200, {
            "Content-Type": file.mime,
            "Content-Disposition": `${user.role === "admin" && url.searchParams.get("preview") === "1" ? "inline" : "attachment"}; filename="document"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "private, no-store",
          })
          return res.end(Buffer.from(file.bytes))
        }
        if (req.method === "POST" && path === "/api/merchant/villa-package") {
          if(user.role !== "merchant") fail(403,"เฉพาะ Merchant")
          const data=await body(req)
          await transaction(db,async()=>{
            const villa=await db.prepare("SELECT * FROM villas WHERE id=? AND owner_id=?").get(data.villaId,user.id)
            if(!villa) fail(404,"ไม่พบที่พัก")
            if(villa.status!=="approved") fail(409,"ต้องผ่านการตรวจสอบที่พักก่อนซื้อแพ็กเกจ")
            const sub=await getSubscription(db,user.id)
            if(["SUSPENDED","CANCELLED"].includes(sub?.lifecycle))fail(409,"บัญชีถูกระงับ กรุณาติดต่อทีมงาน")
            const plan=await getPlan(db,data.packageId)
            if(!plan.active || plan.amount<=0) fail(400,"เลือกแพ็กเกจที่เปิดขาย")
            if(await db.prepare("SELECT id FROM invoices WHERE villa_id=? AND status!='paid'").get(villa.id)) fail(409,"มีใบแจ้งชำระค้างสำหรับที่พักนี้")
            await selectCoupon(db,user.id,plan,data.couponCode)
            const id=await createInvoice(db,{...villa,package_id:plan.id},config.appUrl,config.paymentInstructions)
            await db.prepare("UPDATE invoices SET package_id=? WHERE id=?").run(plan.id,id)
            await generatePaymentQr(db,id,config.appUrl)
            await audit(db,user,"villa.package.request",villa.id)
          })
          json(await state(user));void worker.run();return
        }
        if(req.method==='POST'&&path==='/api/subscription/upgrade')fail(409,"กรุณาเลือกซื้อแพ็กเกจแยกตามที่พักใน Member Room")
        if(path==="/api/subscription/coupon"&&req.method==="POST"){
          if(user.role!=="merchant")fail(403,"เฉพาะ Merchant")
          const data=await body(req),sub=await getSubscription(db,user.id);if(!sub)fail(409,"ยังไม่มีแพ็กเกจ")
          await transaction(db,async()=>{if(await db.prepare("SELECT id FROM invoices WHERE subscription_owner=? AND status!='paid'").get(user.id))fail(409,"ใบแจ้งชำระสร้างแล้ว ไม่แก้ส่วนลดย้อนหลัง");await selectCoupon(db,user.id,await getPlan(db,sub.package_id),data.couponCode)})
          return json(await state(user))
        }
        if (req.method === "POST" && path === "/api/subscription") fail(409,"เพิ่มที่พักเพื่อเริ่มใช้ฟรี แล้วเลือกซื้อแพ็กเกจแยกตามที่พักใน Member Room")
        if (req.method === "POST" && path === "/api/villas") {
          if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")
          const data = await body(req)
          const nameEn = text(data.nameEn, "ชื่อที่พักภาษาอังกฤษ")
          const name = text(data.name, "ชื่อที่พักภาษาไทย"),
            province = text(data.province, "จังหวัด"),
            merchant = text(data.merchant, "ชื่อ Merchant"),
            address = email(data.email)
          const contacts = [
            data.phone || "",
            data.bankName || "",
            data.accountName || "",
            data.accountNumber || "",
          ]
          for (const value of contacts)
            if (
              typeof value !== "string" ||
              value.length > 200 ||
              /[\x00-\x1f]/.test(value)
            )
              fail(400, "ข้อมูลติดต่อหรือบัญชีไม่ถูกต้อง")
          if (contacts[0] && !/^[+0-9 ()-]{8,25}$/.test(contacts[0]))
            fail(400, "เบอร์โทรไม่ถูกต้อง")
          if (contacts[3] && !/^[0-9 -]{6,30}$/.test(contacts[3]))
            fail(400, "เลขบัญชีไม่ถูกต้อง")
          const capacity = guestCapacity(data.guestCapacity)
          const file = document(data.document)
          const id = await transaction(db, async () => {
            if(await db.prepare("SELECT id FROM villas WHERE owner_id=? LIMIT 1").get(user.id))fail(409,"บัญชีนี้มี Villa แล้ว กรุณาแก้ไขข้อมูล Villa เดิม ไม่สามารถเพิ่ม Villa ใหม่ได้")
            await db.prepare("INSERT INTO subscriptions(owner_id,package_id,created) VALUES (?,?,?) ON CONFLICT(owner_id) DO NOTHING").run(user.id,"basic",new Date().toISOString())

            const docId = await insertDocument(db, user.id, file)
            const id = randomUUID()
            await db
              .prepare(
                "INSERT INTO villas(id,owner_id,name,name_en,province,merchant,email,package_id,document_id,created) VALUES (?,?,?,?,?,?,?,?,?,?)",
              )
              .run(
                id,
                user.id,
                name,
                nameEn,
                province,
                merchant,
                address,
                "basic",
                docId,
                new Date().toISOString(),
              )
            await db
              .prepare(
                "UPDATE villas SET phone=?,bank_name=?,account_name=?,account_number=? WHERE id=?",
              )
              .run(...contacts, id)
            const photoUrl = data.photo ? await saveVillaPhoto(db,user.id,data.photo) : data.photoUrl || ""
            if (
              photoUrl &&
              (typeof photoUrl !== "string" ||
                photoUrl.length > 2000 ||
                (!photoUrl.startsWith("https://") && !data.photo))
            )
              fail(400, "Photo URL ต้องเป็น HTTPS")
            await db
              .prepare("UPDATE villas SET photo_url=?,guest_capacity=?,photo_uploaded_at=?,photo_taken_at=? WHERE id=?")
              .run(photoUrl, capacity, photoUrl ? new Date().toISOString() : null, data.photoTakenAt ? mediaDate(data.photoTakenAt) : null, id)
            await audit(db, user, "villa.create", id)
            return id
          })
          return json({ ...(await state(user)), createdId: id }, 201)
        }
        const villaAction = path.match(
          /^\/api\/villas\/([a-f0-9-]+)\/(review|resubmit|renew)$/,
        )
        if (req.method === "POST" && villaAction) {
          const [, id, action] = villaAction
          const data = await body(req)
          await transaction(db, async () => {
            const villa = await villaFor(user, id)
            if (action === "review") {
              if (user.role !== "admin") fail(403, "เฉพาะ Admin")
              if (villa.status !== "pending") fail(409, "Villa นี้ถูกตรวจสอบแล้ว")
              if(Object.hasOwn(data,'expectedReviewId')&&(await villaReview(db,villa)).id!==data.expectedReviewId)
                fail(409,'ข้อมูล Villa เปลี่ยนหลังจากเปิดตรวจ กรุณาโหลดรายการล่าสุดก่อนอนุมัติ')
              if (!["approved", "changes", "rejected"].includes(data.status))
                fail(400, "สถานะไม่ถูกต้อง")
              const reason =
                data.status === "approved"
                  ? ""
                  : text(data.reason, "เหตุผล", 2000)
              const level = data.verificationLevel || (villa.payments === 0 ? "BASIC_CHECKED" : "VERIFIED")
              const entitled = await getPlan(db, villa.payments === 0 ? "basic" : villa.package_id)
              if (
                !levels.includes(level) ||
                levels.indexOf(level) > levels.indexOf(entitled.max_level)
              )
                fail(400, "ระดับเกินสิทธิ์แพ็กเกจ")
              await db
                .prepare(
                  "UPDATE villas SET status=?,reason=?,verification_level=?,reviewed_at=?,reviewed_by=? WHERE id=?",
                )
                .run(
                  data.status,
                  reason,
                  level,
                  new Date().toISOString(),
                  user.id,
                  id,
                )
              if (data.status === "approved") {
                const sub = await getSubscription(db, villa.owner_id)
                if (!sub) fail(409, "Merchant ต้องสมัครแพ็กเกจที่บัญชีก่อน")
                await activateVilla(db, villa)
              }

              await audit(db, user, `villa.${data.status}`, id)
            } else if (action === "resubmit") {
              if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")
              if (!["changes", "rejected"].includes(villa.status))
                fail(409, "ยังไม่สามารถส่งเอกสารใหม่ได้")
              const file = document(data.document)
              const docId = await insertDocument(db, user.id, file)
              await recordVillaReview(db,villa,{...villa,document_id:docId},"document_resubmission",user)
              await db
                .prepare(
                  "UPDATE villas SET document_id=?,status='pending',reason='' WHERE id=?",
                )
                .run(docId, id)
              await audit(db, user, "villa.resubmit", id)
            } else {
              if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")
              if (villa.status !== "approved" || !villa.qr)
                fail(409, "ต้องเปิดใช้ QR ก่อนต่ออายุแพ็กเกจ")
              const sub=await getSubscription(db,villa.owner_id)
              if(["SUSPENDED","CANCELLED"].includes(sub?.lifecycle))fail(409,"บัญชีถูกระงับ กรุณาติดต่อทีมงาน")
              const target=await getPlan(db,data.packageId||villa.package_id)
              if(!target.active||target.amount<=0)fail(400,"เลือกแพ็กเกจที่เปิดขาย")
              if(await db.prepare("SELECT id FROM invoices WHERE villa_id=? AND status!='paid'").get(villa.id))fail(409,"มีใบแจ้งชำระค้างสำหรับที่พักนี้")
              await selectCoupon(db,user.id,target,data.couponCode)
              const invoiceId=await createInvoice(db,{...villa,package_id:target.id},config.appUrl,config.paymentInstructions)
              await db.prepare("UPDATE invoices SET package_id=? WHERE id=?").run(target.id,invoiceId)
              await generatePaymentQr(db,invoiceId,config.appUrl)
              await audit(db,user,"villa.package.renew",villa.id)
            }
          })
          json(await state(user))
          void worker.run()
          return
        }
        const invoiceAction = path.match(
          /^\/api\/invoices\/([a-f0-9-]+)\/(proof|confirm|reject)$/,
        )
        if (["POST", "PATCH"].includes(req.method) && invoiceAction) {
          const [, id, action] = invoiceAction
          const data = await body(req)
          await transaction(db, async () => {
            const { invoice, villa } = await invoiceFor(user, id)
            if (villa.status !== "approved") fail(409, "Villa ยังไม่ผ่านการอนุมัติ")
            if (action === "proof") {
              if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")

              if (invoice.status !== "pending")
                fail(409, "ใบแจ้งชำระนี้อยู่ระหว่างตรวจสอบหรือชำระแล้ว")
              const reference = text(data.reference, "เลขอ้างอิงการโอน", 150)
              const duplicate = await db
                .prepare(
                  "SELECT id FROM invoices WHERE external_transaction_id=? AND id!=?",
                )
                .get(reference, id)
              if (duplicate) fail(409, "เลขธุรกรรมนี้ถูกใช้ยืนยันการชำระแล้ว")
              const docId = await insertDocument(
                db,
                user.id,
                document(data.document),
              )
              await db
                .prepare(
                  "UPDATE invoices SET status='submitted',payment_status='PENDING_REVIEW',verification_mode=?,updated_at=?,proof_id=?,reference=?,reason='' WHERE id=?",
                )
                .run(
                  await getVerificationMode(
                    db,
                    config.paymentVerificationMode || "MANUAL",
                  ),
                  new Date().toISOString(),
                  docId,
                  reference,
                  id,
                )
              const verification = new PaymentVerificationService(
                await getVerificationMode(
                  db,
                  config.paymentVerificationMode || "MANUAL",
                ),
              )
              await verification.verify(id) // AUTO placeholder safely stays PENDING_REVIEW.
              await audit(db, user, "invoice.proof", id)
            } else {
              if (user.role !== "admin") fail(403, "เฉพาะ Admin")
              if (action === "confirm" && invoice.status === "paid") return
              if (invoice.status !== "submitted" || !invoice.proof_id)
                fail(409, "ต้องมีหลักฐานการชำระรอตรวจสอบ")
              if (action === "reject") {
                await db
                  .prepare(
                    "UPDATE invoices SET status='pending',payment_status='REJECTED',updated_at=?,reason=? WHERE id=?",
                  )
                  .run(
                    new Date().toISOString(),
                    text(data.reason, "เหตุผล", 2000),
                    id,
                  )
              } else {
                const transactionId = data.externalTransactionId
                  ? text(data.externalTransactionId, "เลขธุรกรรม", 150)
                  : invoice.reference
                const duplicate = await db
                  .prepare(
                    "SELECT id FROM invoices WHERE external_transaction_id=? AND id!=?",
                  )
                  .get(transactionId, id)
                if (duplicate) fail(409, "เลขธุรกรรมนี้ถูกใช้ยืนยันการชำระแล้ว")
                await db
                  .prepare(
                    "UPDATE invoices SET external_transaction_id=?,external_provider='MANUAL' WHERE id=?",
                  )
                  .run(transactionId, id)
                await confirmPayment(db, invoice, villa, user.id)
              }
              await audit(db, user, `invoice.${action}`, id)
            }
          })
          return json(await state(user))
        }
        const retry = path.match(/^\/api\/mails\/([a-f0-9-]+)\/retry$/)
        if (req.method === "POST" && retry) {
          if (user.role !== "admin") fail(403, "เฉพาะ Admin")
          if (!transport) fail(409, "ยังไม่ได้ตั้งค่า SMTP")
          const mail = await db
            .prepare("SELECT status FROM mails WHERE id=?")
            .get(retry[1])
          if (!mail) fail(404, "ไม่พบอีเมล")
          if (mail.status === "sending" || mail.status === "sent")
            fail(409, "อีเมลส่งแล้วหรือกำลังส่ง")
          await db
            .prepare(
              "UPDATE mails SET status='queued',attempts=0,next_attempt=0 WHERE id=?",
            )
            .run(retry[1])
          await audit(db, user, "mail.retry", retry[1])
          json(await state(user))
          void worker.run()
          return
        }
        fail(404, "ไม่พบ API")
      }
      if (req.method === "GET" && config.staticDir) {
        const root = resolve(config.staticDir)
        const file = resolve(root, `.${decodeURIComponent(path)}`)
        if (!file.startsWith(root + sep) && file !== root) fail(404, "ไม่พบไฟล์")
        const target =
          file !== root && existsSync(file) && /\.[a-z0-9]+$/i.test(file)
            ? file
            : resolve(root, "index.html")
        const mime = {
          ".js": "text/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".woff2": "font/woff2",
          ".png": "image/png",
          ".svg": "image/svg+xml",
          ".jpg": "image/jpeg",
          ".ico": "image/x-icon",
          ".txt": "text/plain",
        }
        const extension = target.slice(target.lastIndexOf("."))
        res.setHeader(
          "Content-Type",
          mime[extension] || "application/octet-stream",
        )
        return res.end(readFileSync(target))
      }
      fail(404, "ไม่พบหน้า")
    } catch (error) {
      if (!res.headersSent)
        json(
          {
            error:
              error instanceof ApiError ||
              (error.status >= 400 && error.status < 500)
                ? error.message
                : "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์",
          },
          error.status || 500,
        )
      else res.end()
      if (
        !(error instanceof ApiError) &&
        !(error.status >= 400 && error.status < 500)
      )
        console.error("Backend error:", error.code || error.name)
    }
  })
  server.requestTimeout = 30000
  server.headersTimeout = 15000
  server.on("close", () => worker.stop())
  server.authenticate = auth
  server.runMail = worker.run
  return server
}
