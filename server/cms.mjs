import {initializeCmsChanges,recordCmsChange,cmsChangeById,cmsChanges,archivedCmsMediaUsed} from "./cms-change-history.mjs"
import {introBannerImage} from "./banner-display.mjs"
import {diverseDemoImages} from "./demo-image-catalog.mjs";
const diverseImageUrls=new Set(diverseDemoImages.map(i=>i.url));
import {presentationConfig,copyDefaults,presentationMedia} from "./cms-presentation.mjs"
import { homeConfig, publicNavigation, shortcutMediaUrls, shortcutIcons, publicDestinations } from "./cms-home-config.mjs"
import { receivingBank, bankInstructions } from "./payment-account.mjs"
import { randomUUID } from "node:crypto"
import { cmsDefaults } from "./cms-defaults.mjs"
import { audit } from "./database.mjs"

const fail = (status, message) => {
  throw Object.assign(Error(message), { status })
}
const clone = (value) => JSON.parse(JSON.stringify(value))
const string = (value, max = 4000) => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)
  )
    fail(400, "ข้อความไม่ถูกต้องหรือยาวเกินกำหนด")
  return value
}
const list = (value, max) => {
  if (!Array.isArray(value) || value.length > max)
    fail(400, "จำนวนรายการเกินกำหนด")
  return value
}
const unique = (rows, key) => {
  if (new Set(rows.map((x) => x[key])).size !== rows.length)
    fail(400, "รหัสรายการซ้ำ")
  return rows
}
const slug = (value) => {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(string(value, 80)))
    fail(400, "รหัสต้องเป็นภาษาอังกฤษ ตัวเลข หรือขีดกลาง")
  return value
}
export function cmsUrl(value, image = false) {
  string(value, 2000)
  if (!value) return value
  if (image && (/^\/demo\/villas\/villa-[1-9]\.jpg$/.test(value)||diverseImageUrls.has(value))) return value
  if (!image && value === "#how") return value
  if (image && /^\/api\/public\/cms-media\/[a-f0-9-]+$/.test(value))
    return value
  if (!image && /^#page=[a-z0-9-]+(?:&item=[^\s]*)?$/.test(value)) return value
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password) throw Error()
    return value
  } catch {
    fail(400, "ลิงก์ต้องเป็น HTTPS หรือเลือกหน้าภายในระบบ")
  }
}
function blocks(value) {
  return unique(
    list(value, 40).map((b) => {
      if (
        !b ||
        !["text", "image", "cta"].includes(b.type) ||
        typeof b.visible !== "boolean"
      )
        fail(400, "ชนิด Section ไม่ถูกต้อง")
      return {
        id: slug(b.id),
        type: b.type,
        visible: b.visible,
        title: string(b.title, 300),
        body: string(b.body, 30000),
        image: cmsUrl(b.image, true),
        alt: string(b.alt, 300),
        label: string(b.label, 100),
        href: cmsUrl(b.href),
      }
    }),
    "id",
  )
}
export function validateCms(data) {
  try {
    return normalizeCms(data)
  } catch (error) {
    if (error.status) throw error
    fail(400, "รูปแบบข้อมูล CMS ไม่ถูกต้อง")
  }
}
function discoveryConfig(home, pages) {
  const d=homeConfig(home).discovery;
  for(const k of ["visible","searchVisible","showProvinceHint","showFreeHint"]) if(typeof d[k]!=="boolean") fail(400,"สถานะเมนูลัดไม่ถูกต้อง");
  const result={};
  for(const k of ["visible","searchVisible","showProvinceHint","showFreeHint"])result[k]=d[k];
  for(const k of ["heading","placeholder","buttonLabel","provinceHint","freeHint"])result[k]=string(d[k],300);
  if(!result.placeholder.trim()||!result.buttonLabel.trim())fail(400,"กรุณาระบุข้อความช่องค้นหาและปุ่มค้นหา");
  for(const k of ["background","iconColor","accentColor"]){result[k]=string(d[k],7);if(!/^#[a-fA-F0-9]{6}$/.test(result[k]))fail(400,"สีต้องเป็นรหัส #RRGGBB");}
  result.shortcuts=unique(list(d.shortcuts,12).map(item=>{
    if(typeof item.visible!=="boolean"||!shortcutIcons.some(x=>x.id===item.icon)||!item.label?.trim())fail(400,"ชื่อ ไอคอน หรือสถานะเมนูลัดไม่ถูกต้อง");
    const href=cmsUrl(item.href);
    if(!href || href.startsWith("#")&&!publicDestinations.some(x=>x.href===href)&&!pages.some(p=>href===`#page=cms-page&item=${p.slug}`))fail(400,"กรุณาเลือกหน้าปลายทางสาธารณะสำหรับเมนูลัด");
    return {id:slug(item.id),icon:item.icon,label:string(item.label,80),description:string(item.description,300),href,visible:item.visible,image:cmsUrl(item.image,true)};
  }),"id");
  return result;
}
function normalizePresentation(value) {
  if(value !== undefined && (!value || typeof value !== "object" || Array.isArray(value)))fail(400,"รูปแบบเนื้อหาทั่วเว็บไซต์ไม่ถูกต้อง");
  if(value && Object.hasOwn(value,"copy") && (!value.copy || typeof value.copy !== "object" || Array.isArray(value.copy)))fail(400,"รูปแบบข้อความหน้าเว็บไม่ถูกต้อง");
  const p=presentationConfig(value);
  if(value?.copy && (typeof value.copy !== "object" || Array.isArray(value.copy) || Object.keys(value.copy).some(k=>!Object.hasOwn(copyDefaults,k))))fail(400,"ข้อความหน้าเว็บมีรหัสที่ไม่รองรับ");
  const copy=Object.fromEntries(Object.entries(p.copy).map(([k,v])=>[k,string(v,4000)]));
  if(!['advertisers-first','editorial-first','mixed'].includes(p.bannerSource)||typeof p.footerVisible!=="boolean"||typeof p.footerAdsVisible!=="boolean")fail(400,"การตั้งค่าหน้าเว็บไม่ถูกต้อง");
  for(const key of ['showcaseLimit','newsLimit','footerAdLimit'])if(!Number.isInteger(p[key])||p[key]<1||p[key]>12)fail(400,"จำนวนการ์ดต้องอยู่ระหว่าง 1–12");
  const services=unique(list(p.services,12).map(item=>{
    if(typeof item.visible!=="boolean"||!['search','shield','qr','home','pin','users','chart','camera','info'].includes(item.icon))fail(400,"ข้อมูลการ์ดบริการไม่ถูกต้อง");
    return {id:slug(item.id),visible:item.visible,number:string(item.number,10),icon:item.icon,title:string(item.title,300),description:string(item.description,4000),label:string(item.label,100),href:cmsUrl(item.href),image:cmsUrl(item.image,true)};
  }),"id");
  const footerColumns=unique(list(p.footerColumns,5).map(column=>{
    if(typeof column.visible!=="boolean")fail(400,"สถานะ Footer ไม่ถูกต้อง");
    return {id:slug(column.id),title:string(column.title,300),visible:column.visible,links:unique(list(column.links,60).map(link=>{if(typeof link.visible!=="boolean")fail(400,"สถานะลิงก์ไม่ถูกต้อง");return {id:slug(link.id),label:string(link.label,100),href:cmsUrl(link.href),visible:link.visible}}),"id")};
  }),"id");
  const provinces=list(p.provinces,10).map(v=>string(v,100).trim());if(provinces.some(v=>!v)||new Set(provinces).size!==provinces.length)fail(400,"จังหวัดต้องไม่ว่างหรือซ้ำกัน");
  return {copy,services,footerColumns,provinces,cta:{qr:cmsUrl(p.cta.qr),merchant:cmsUrl(p.cta.merchant)},footerAdsVisible:p.footerAdsVisible,bannerSource:p.bannerSource,showcaseLimit:p.showcaseLimit,newsLimit:p.newsLimit,footerAdLimit:p.footerAdLimit,footerVisible:p.footerVisible};
}
function normalizeCms(data) {
  if (!data || data.schemaVersion !== 1 || !data.site || !data.home)
    fail(400, "ข้อมูล CMS ไม่ครบ")
  const business = {...cmsDefaults.business,...data.business}
  if (!business || ![business.monthlyInitialMonths,business.monthlyRenewalMonths].every(n=>Number.isInteger(n)&&n>=1&&n<=36)) fail(400,"อายุสิทธิ์รายเดือนต้องเป็นจำนวนเต็ม 1–36 เดือน")
  const subject=string(business.paymentEmailSubject,300),intro=string(business.paymentEmailIntro,12000)
  if (!subject.trim() || /[\r\n]/.test(subject) || [subject,intro].some(value=>(value.match(/\{\{[^}]+\}\}/g)||[]).some(token=>!["{{merchant}}","{{package}}","{{villa}}"].includes(token)))) fail(400,"หัวข้ออีเมลหรือคำแทนข้อความไม่ถูกต้อง")
  const businessSettings={monthlyInitialMonths:business.monthlyInitialMonths,monthlyRenewalMonths:business.monthlyRenewalMonths,paymentEmailSubject:subject,paymentEmailIntro:intro}
  for (const key of ["emailOtpBody","smsOtpBody"]){
    const value=string(business[key],key==="smsOtpBody"?300:4000)
    if (!value.includes("{{code}}")||!value.includes("{{minutes}}")||(value.match(/\{\{[^}]+\}\}/g)||[]).some(token=>!["{{code}}","{{minutes}}"].includes(token))) fail(400,"ข้อความ OTP ต้องมี {{code}} และ {{minutes}} และใช้คำแทนที่รองรับเท่านั้น")
    businessSettings[key]=value
  }
  businessSettings.emailOtpSubject=string(business.emailOtpSubject,150)
  businessSettings.emailOtpTemplateId=string(business.emailOtpTemplateId,200)
  if (!businessSettings.emailOtpSubject.trim() || /[\r\n]/.test(businessSettings.emailOtpSubject) || (businessSettings.emailOtpTemplateId&&!/^[a-zA-Z0-9_-]+$/.test(businessSettings.emailOtpTemplateId)) || typeof business.facebookLoginEnabled!=="boolean") fail(400,"ตั้งค่า OTP/Facebook ไม่ถูกต้อง")
  businessSettings.facebookLoginEnabled=business.facebookLoginEnabled
  const site = Object.fromEntries(
    [
      "name",
      "description",
      "email",
      "phone",
      "hours",
      "paymentInstructions",
    ].map((k) => [
      k,
      string(data.site[k], k === "paymentInstructions" ? 4000 : 500),
    ]),
  )
  if (!site.name.trim()) fail(400, "กรุณาระบุชื่อเว็บไซต์")
  if (site.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.email))
    fail(400, "อีเมลไม่ถูกต้อง")
  if (site.phone && !/^[+0-9 ()-]{6,30}$/.test(site.phone))
    fail(400, "เบอร์โทรไม่ถูกต้อง")
  for (const k of ["facebook", "instagram", "line"])
    site[k] = cmsUrl(data.site[k])
  site.logo = cmsUrl(data.site.logo, true)
  site.paymentQrImage = cmsUrl(data.site.paymentQrImage || "", true)
  site.accent = string(data.site.accent, 7)
  if (!/^#[a-fA-F0-9]{6}$/.test(site.accent))
    fail(400, "สีหลักต้องเป็นรหัสสี #RRGGBB")
  const navigation = publicNavigation(unique(
    list(data.navigation, 12).map((n) => {
      if (typeof n.visible !== "boolean" || !n.label?.trim() || !n.href)
        fail(400, "เมนูต้องมีชื่อและลิงก์")
      return {
        id: slug(n.id),
        label: string(n.label, 80),
        href: cmsUrl(n.href),
        visible: n.visible,
      }
    }),
    "id",
  ))
  if(navigation.length>12)fail(400,"เพิ่มเมนูได้สูงสุด 12 รายการ รวมเมนูติดต่อเรา")
  const sections = unique(
    list(homeConfig(data.home).sections, 10).map((s) => {
      if (
        !cmsDefaults.home.sections.some((x) => x.id === s.id) ||
        typeof s.visible !== "boolean"
      )
        fail(400, "Section หน้าแรกไม่ถูกต้อง")
      return {
        id: s.id,
        visible: s.visible,
        title: string(s.title, 300),
        description: string(s.description),
        ...(s.image===undefined?{}:{image:cmsUrl(s.image,true)}),
      }
    }),
    "id",
  )
  if (sections.length !== 10) fail(400, "Section หน้าแรกไม่ครบ ใช้การซ่อนแทนการลบ")
  const home = {
    introVisible:data.home.introVisible??true,
    introImage:cmsUrl(data.home.introImage||introBannerImage,true),
    discovery: discoveryConfig(data.home,data.pages),
    buttonLabel:string(data.home.buttonLabel??"ค้นหาที่พัก",100),
    buttonHref:cmsUrl(data.home.buttonHref??"#page=directory"),
    banners: unique(list(data.home.banners || [], 40).map(b => {
      if (typeof b.visible !== "boolean" || typeof b.sponsored !== "boolean") fail(400,"สถานะแบนเนอร์ไม่ถูกต้อง")
      if(b.sponsored) fail(400,"กรุณาจัดการโฆษณาที่พักในระบบโฆษณาเพื่อให้ตรวจสิทธิ์แพ็กเกจ")
      const startsAt=string(b.startsAt,40),endsAt=string(b.endsAt,40)
      if ([startsAt,endsAt].some(d=>d&&!Number.isFinite(Date.parse(d))) || (startsAt&&endsAt&&Date.parse(endsAt)<=Date.parse(startsAt))) fail(400,"ช่วงเวลาแบนเนอร์ไม่ถูกต้อง")
      const image=cmsUrl(b.image,true)
      if(!image || !b.title?.trim()) fail(400,"แบนเนอร์ต้องมีรูปและชื่อ")
      return {id:slug(b.id),image,mobileImage:cmsUrl(b.mobileImage,true),title:string(b.title,300),description:string(b.description,4000),label:string(b.label,100),href:cmsUrl(b.href),visible:b.visible,sponsored:b.sponsored,startsAt,endsAt}
    }),"id"),
    slideIntervalMs: data.home.slideIntervalMs ?? 5200,
    eyebrow: string(data.home.eyebrow, 300),
    title: string(data.home.title, 300),
    description: string(data.home.description),
    images: list(data.home.images, 12).map((x) => cmsUrl(x, true)),
    blocks: blocks(data.home.blocks),
    sections,
  }
  if (!Number.isInteger(home.slideIntervalMs) || home.slideIntervalMs < 2000 || home.slideIntervalMs > 60000) fail(400,"ช่วงเวลาเลื่อนต้องอยู่ระหว่าง 2–60 วินาที")
  if(typeof home.introVisible!=="boolean")fail(400,"สถานะแบนเนอร์หลักไม่ถูกต้อง")
  if (!home.title.trim() || !home.images.length || home.images.some((x) => !x))
    fail(400, "หน้าแรกต้องมีหัวข้อและรูปอย่างน้อยหนึ่งรูป")
  const pages = unique(
    list(data.pages, 50).map((p) => ({
      slug: slug(p.slug),
      kicker: string(p.kicker, 300),
      title: string(p.title, 300),
      description: string(p.description),
      body: string(p.body, 30000),
      blocks: blocks(p.blocks),
    })),
    "slug",
  )
  for (const required of cmsDefaults.pages)
    if (!pages.some((p) => p.slug === required.slug && p.title.trim()))
      fail(400, "ห้ามลบหน้าพื้นฐาน กรุณากรอกหัวข้อทุกหน้า")
  const articles = unique(
    list(data.articles, 100).map((a) => {
      if (typeof a.visible !== "boolean" || !a.title?.trim())
        fail(400, "บทความต้องมีชื่อและสถานะ")
      return {
        id: slug(a.id),
        title: string(a.title, 300),
        description: string(a.description),
        body: string(a.body, 30000),
        image: cmsUrl(a.image, true),
        blocks: blocks(a.blocks || []),
        visible: a.visible,
      }
    }),
    "id",
  )
  const faqs = unique(
    list(data.faqs, 100).map((f) => {
      if (typeof f.visible !== "boolean" || !f.question?.trim())
        fail(400, "FAQ ต้องมีคำถามและสถานะ")
      return {
        id: slug(f.id),
        question: string(f.question, 500),
        answer: string(f.answer, 10000),
        visible: f.visible,
      }
    }),
    "id",
  )
  const result = {
    schemaVersion: 1,
    presentation:normalizePresentation(data.presentation),
    site,
    home,
    pages,
    articles,
    faqs,
    navigation,
    business:businessSettings,
  }
  if (Buffer.byteLength(JSON.stringify(result)) > 500000)
    fail(400, "เนื้อหารวมต้องไม่เกิน 500 KB")
  return result
}
async function read(db, key, fallback) {
  const row = await db
    .prepare("SELECT value FROM system_settings WHERE key=?")
    .get(key)
  const value=row?JSON.parse(row.value):clone(fallback)
  if (["cms_draft","cms_published"].includes(key)) { value.content.presentation=presentationConfig(value.content.presentation,value.content.pages); value.content.home=homeConfig(value.content.home); value.content.navigation=publicNavigation(value.content.navigation); value.content.business={...cmsDefaults.business,...value.content.business}; value.content.site={...cmsDefaults.site,...value.content.site}; }
  return value
}
async function write(db, key, value) {
  await db
    .prepare(
      "INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .run(key, JSON.stringify(value))
}
const empty = {
  revision: 0,
  content: cmsDefaults,
  updatedAt: null,
  updatedBy: null,
}
// Full snapshots remain in storage for rollback; return only history metadata
// to keep the Admin response below serverless response-size limits.
const historyInfo = rows => rows.map(({revision,updatedAt,updatedBy})=>({revision,updatedAt,updatedBy}))
export async function publishedCms(db) {
  return read(db, "cms_published", empty)
}
function mediaReferences(content) {
  return [
    content.home.introImage||"",
    content.site.logo,
    content.site.paymentQrImage || "",
    ...content.home.images,
    ...content.home.sections.map(s=>s.image||""),
    ...shortcutMediaUrls(content),
    ...presentationMedia(content),
    ...(content.home.banners || []).flatMap(b=>[b.image,b.mobileImage]),
    ...content.home.blocks.map((x) => x.image),
    ...content.pages.flatMap((p) => p.blocks.map((x) => x.image)),
    ...content.articles.flatMap(x=>[x.image,...(x.blocks||[]).map(b=>b.image)]),
  ].filter((x) => x.startsWith("/api/public/cms-media/"))
}
export async function cmsPaymentInstructions(db, fallback = "") {
  const bank=await receivingBank(db);if(bank)return bankInstructions(bank)
  return (await publishedCms(db)).content.site.paymentInstructions || fallback
}
export async function adminCms(db, user, req, path, readBody) {
  if (!path.startsWith("/api/admin/cms")) return undefined
  if (user.role !== "admin") fail(403, "เฉพาะ Admin")
  if (path === "/api/admin/cms/history" && req.method === "GET") return cmsChanges(db,new URL(req.url,"http://localhost").searchParams.get("cursor")||"")
  if (path === "/api/admin/cms" && req.method === "GET") {
    const published = await publishedCms(db)
    return {
      draft: await read(db, "cms_draft", published),
      published,
      history: historyInfo(await read(db, "cms_history", [])),
    }
  }
  if (path === "/api/admin/cms/media" && req.method === "GET") {
    const media=(await db.prepare("SELECT id,name,mime FROM documents WHERE name LIKE 'cms-image:%' ORDER BY id").all()).map(m=>({...m,url:`/api/public/cms-media/${m.id}`,source:"upload"}));
    const seen=new Set(media.map(m=>m.url));
    const add=(url,name)=>{if(typeof url!=="string"||!(url.startsWith("https://")||/^\/demo\/villas\/villa-[1-9]\.jpg$/.test(url)||diverseImageUrls.has(url))||seen.has(url))return;seen.add(url);media.push({id:`banner-${media.length}`,name,mime:"image/remote",url,source:"banner"});};
    for(const image of diverseDemoImages)add(image.url,image.title);
    const releases=[await read(db,"cms_published",empty),await read(db,"cms_draft",empty),...await read(db,"cms_history",[])];
    for(const release of releases){const home=release.content?.home;if(!home)continue;add(home.introImage,"Intro banner");for(const [i,image] of (home.images||[]).entries())add(image,`Carousel ${i+1}`);for(const banner of home.banners||[]){add(banner.image,banner.title||"Banner");add(banner.mobileImage,(banner.title||"Banner")+" · มือถือ");}}
    const ads=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'advertisement:%'").all();
    for(const row of ads){const ad=JSON.parse(row.value);add(ad.image,`${ad.title||"โฆษณา"} · ${ad.placement}`);add(ad.mobileImage,`${ad.title||"โฆษณา"} · มือถือ`);}
    return {media};
  }

  if (path === "/api/admin/cms/media" && req.method === "POST") {
    const { file } = await readBody(req)
    if (
      !file ||
      !["image/png", "image/jpeg"].includes(file.type) ||
      typeof file.data !== "string"
    )
      fail(400, "ใช้รูป JPG/PNG ขนาดไม่เกิน 2 MB")
    const prefix = `data:${file.type};base64,`
    if (!file.data.startsWith(prefix)) fail(400, "ข้อมูลรูปไม่ถูกต้อง")
    const bytes = Buffer.from(file.data.slice(prefix.length), "base64")
    if (
      !bytes.length ||
      bytes.length > 2 * 1024 * 1024 ||
      (file.type === "image/png"
        ? !bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255))
    )
      fail(400, "รูปไม่ถูกต้องหรือใหญ่เกิน 2 MB")
    const id = randomUUID(),
      name = "cms-image:" + string(file.name, 120)
    await db.transaction(async () => {
      const count = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM documents WHERE name LIKE 'cms-image:%'",
        )
        .get()
      if (count.n >= 200) fail(400, "คลังรูปเต็ม (200 รูป) กรุณาลบรูปที่ไม่ได้ใช้งาน")
      await db
        .prepare(
          "INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)",
        )
        .run(id, user.id, name, file.type, bytes)
      await initializeCmsChanges(db)
      await recordCmsChange(db,{kind:"media",action:"upload",snapshot:{id,name,mime:file.type},user})
      await audit(db, user, "CMS_MEDIA_UPLOAD", id)
    })
    return { id, name, mime: file.type, url: `/api/public/cms-media/${id}` }
  }
  if (path === "/api/admin/cms/media/delete" && req.method === "POST") {
    const data = await readBody(req)
    if (!/^[a-f0-9-]{36}$/.test(data.id)) fail(400, "รหัสรูปไม่ถูกต้อง")
    return db.transaction(async () => {
      const published = await publishedCms(db),
        draft = await read(db, "cms_draft", published),
        history = await read(db, "cms_history", [])
      const url = `/api/public/cms-media/${data.id}`
      if(await archivedCmsMediaUsed(db,url))fail(409,"รูปนี้อยู่ในประวัติการเปลี่ยนแปลง จึงยังลบไม่ได้")
      const ads=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'advertisement:%'").all()
      if(ads.some(row=>{const ad=JSON.parse(row.value);return ad.image===url||ad.mobileImage===url}))fail(409,"รูปนี้อ้างอิงในแบนเนอร์โฆษณา จึงยังลบไม่ได้")
      if (await db.prepare("SELECT key FROM system_settings WHERE key LIKE 'invoice_bank_qr:%' AND value=?").get(JSON.stringify(url)))
        fail(409, "QR นี้อ้างอิงในใบแจ้งชำระ จึงยังลบไม่ได้")
      if (
        [published, draft, ...history].some((v) =>
          mediaReferences(v.content).includes(url),
        )
      )
        fail(409, "รูปนี้อยู่ในร่าง เว็บจริง หรือประวัติเวอร์ชัน จึงยังลบไม่ได้")
      const removedMedia=await db.prepare("SELECT id,name,mime FROM documents WHERE id=? AND name LIKE 'cms-image:%'").get(data.id)
      const result = await db
        .prepare("DELETE FROM documents WHERE id=? AND name LIKE 'cms-image:%'")
        .run(data.id)
      if (!result.changes) fail(404, "ไม่พบรูปภาพ")
      await initializeCmsChanges(db)
      await recordCmsChange(db,{kind:"media",action:"delete",snapshot:removedMedia,user})
      await audit(db, user, "CMS_MEDIA_DELETE", data.id)
      return { ok: true }
    })
  }
  if (
    req.method !== "POST" ||
    ![
      "/api/admin/cms/save",
      "/api/admin/cms/publish",
      "/api/admin/cms/restore",
    ].includes(path)
  )
    return undefined
  const data = await readBody(req)
  return db.transaction(async () => {
    const published = await publishedCms(db),
      current = await read(db, "cms_draft", published),
      history = await read(db, "cms_history", [])
    if (data.revision !== current.revision)
      fail(409, "มีผู้แก้ไขเนื้อหาก่อนหน้า กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก")
    await initializeCmsChanges(db)
    if (path.endsWith("/publish")) {
      if (!current.revision) fail(400, "กรุณาบันทึกร่างก่อนเผยแพร่")
      // Keep the preceding version, including the original site, available for rollback.
      if (!history.some((x) => x.revision === published.revision))
        history.unshift(published)
      const release = {
        ...current,
        content: validateCms(current.content),
        updatedAt: new Date().toISOString(),
        updatedBy: user.name,
      }
      await write(db, "cms_published", release)
      await recordCmsChange(db,{kind:"cms",action:"publish",snapshot:release,user})
      if (!history.some((x) => x.revision === release.revision))
        history.unshift(release)
      await write(db, "cms_history", history.slice(0, 30))
      await audit(db, user, "CMS_PUBLISH", String(release.revision))
      return {
        draft: current,
        published: release,
        history: historyInfo(history.slice(0, 30)),
      }
    }
    const restored = data.historyId ? await cmsChangeById(db,data.historyId) : null
    const source = path.endsWith("/restore")
      ? data.historyId ? restored?.kind==="cms" ? restored.snapshot.content : null : history.find((x) => x.revision === data.version)?.content
      : data.content
    if (!source) fail(404, "ไม่พบเวอร์ชัน")
    const draft = {
      revision: current.revision + 1,
      content: validateCms(source),
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
    }
    for (const url of new Set(mediaReferences(draft.content))) {
      if (
        !(await db
          .prepare(
            "SELECT id FROM documents WHERE id=? AND name LIKE 'cms-image:%'",
          )
          .get(url.split("/").at(-1)))
      )
        fail(400, "ไม่พบรูปที่เลือกในคลัง กรุณาเลือกรูปใหม่")
    }
    await write(db, "cms_draft", draft)
    await recordCmsChange(db,{kind:"cms",action:path.endsWith("/restore")?"restore":"save",snapshot:draft,user})
    await audit(
      db,
      user,
      path.endsWith("/restore") ? "CMS_RESTORE_DRAFT" : "CMS_SAVE_DRAFT",
      String(draft.revision),
    )
    return { draft, published, history:historyInfo(history) }
  })
}
