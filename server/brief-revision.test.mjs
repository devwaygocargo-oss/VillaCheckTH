import { qrReference } from "../src/qrReference.ts"
import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { openTestDatabase } from "./test-database.mjs"
import { createUser, hashPassword } from "./database.mjs"
import { createApp } from "./app.mjs"
import { dummyPdf } from "./demo-seed.mjs"
import { cmsDefaults } from "./cms-defaults.mjs"
import { validateCms } from "./cms.mjs"
import { confirmPayment } from "./payment-service.mjs"
import { mediaDate } from "./media-date.mjs"

test("VillaCheck brief: bilingual, per-property packages, unlimited trial, reviews, advertising and dated media", async (t) => {
  const db = await openTestDatabase(),
    password = "RevisionPassword123"
  const adminUser = await createUser(
    db,
    "revision-admin@example.test",
    password,
    "Admin",
    "admin",
  )
  const merchantUser = await createUser(
    db,
    "revision-owner@example.test",
    password,
    "Owner",
    "merchant",
  )
  await createUser(
    db,
    "revision-other@example.test",
    password,
    "Other",
    "merchant",
  )
  await createUser(
    db,
    "revision-user@example.test",
    password,
    "Reviewer",
    "user",
  )
  const config = {
    appUrl: "http://localhost:3001",
    allowedOrigins: ["http://localhost:3001"],
    fakeHash: hashPassword("fake-password"),
    serverless: true,
    paymentInstructions: "Test bank",
  }
  const server = createApp(db, config)
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  t.after(async () => {
    await new Promise((r) => server.close(r))
    await db.close()
  })
  const request = async (path, data, session) => {
    const r = await fetch(
      `http://127.0.0.1:${server.address().port}/api${path}`,
      {
        method: data === undefined ? "GET" : "POST",
        headers: {
          Origin: config.appUrl,
          "Content-Type": "application/json",
          ...(session
            ? { Cookie: session.cookie, "X-CSRF-Token": session.csrf }
            : {}),
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      },
    )
    return {
      status: r.status,
      value: r.headers.get("content-type")?.includes("json")
        ? await r.json()
        : await r.arrayBuffer(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    }
  }
  const login = async (email) => {
    const r = await request("/auth/login", { email, password })
    assert.equal(r.status, 200, JSON.stringify(r.value))
    return { cookie: r.cookie, csrf: r.value.csrf }
  }
  const owner = await login("revision-owner@example.test"),
    other = await login("revision-other@example.test"),
    admin = await login("revision-admin@example.test"),
    user = await login("revision-user@example.test")
  let first, second, invoice, review, ad
  const doc = {
    name: "test.pdf",
    type: "application/pdf",
    data: "data:application/pdf;base64," + dummyPdf().toString("base64"),
  }
  const villaData = {
    name: "บ้านทดสอบ",
    nameEn: "Test Villa",
    province: "ชลบุรี",
    merchant: "บริษัททดสอบ",
    email: "revision-owner@example.test",
    document: doc,
  }
  await t.test(
    "four monthly tax-inclusive prices; merchant endpoints enforce identity",
    async () => {
      assert.equal((await request("/packages")).status, 401)
      assert.equal((await request("/packages", undefined, user)).status, 403)
      const r = await request("/packages", undefined, owner)
      assert.deepEqual(
        r.value.packages.map((p) => p.amount),
        [99000, 199000, 299000, 499000],
      )
      assert.ok(r.value.packages.every((p) => p.billingCycle === "MONTHLY"))
      assert.equal((await request("/merchant/profile")).status, 401)
      assert.equal(
        (await request("/merchant/profile", undefined, user)).status,
        403,
      )
      assert.equal(
        (await request("/subscription", { packageId: "premium" }, owner))
          .status,
        409,
      )
    },
  )
  await t.test(
    "two required business names stored separately from contact person",
    async () => {
      assert.equal(
        (
          await request(
            "/merchant/profile",
            {
              businessName: "ไทย",
              contactName: "คน",
              phone: "0812345678",
              address: "กรุงเทพ",
            },
            owner,
          )
        ).status,
        400,
      )
      const r = await request(
        "/merchant/profile",
        {
          businessName: "บริษัทไทย",
          businessNameEn: "Thai Company",
          contactName: "ผู้ติดต่อ",
          phone: "0812345678",
          address: "กรุงเทพ",
        },
        owner,
      )
      assert.equal(r.status, 200, JSON.stringify(r.value))
      assert.equal(r.value.businessNameEn, "Thai Company")
      assert.equal(r.value.contactName, "ผู้ติดต่อ")
    },
  )
  await t.test(
    "new villas require bilingual names and multiple villas can start free without selecting a paid account package",
    async () => {
      assert.equal(
        (await request("/villas", { ...villaData, nameEn: "" }, owner)).status,
        400,
      )
      for (const name of ["บ้านทดสอบ", "บ้านหลังที่สอง"]) {
        const r = await request("/villas", { ...villaData, name }, owner)
        assert.equal(r.status, 201, JSON.stringify(r.value))
        if (!first)
          first = r.value.villas.find((v) => v.id === r.value.createdId)
        else second = r.value.villas.find((v) => v.id === r.value.createdId)
      }
      assert.equal(first.trialUnlimited, true)
      assert.equal(second.trialUnlimited, true)
      assert.equal(
        (
          await request(
            "/merchant/villa-package",
            { villaId: first.id, packageId: "premium" },
            owner,
          )
        ).status,
        409,
      )
    },
  )
  await t.test(
    "approval activates unlimited Basic QR; public names and trial do not invent media dates",
    async () => {
      for (const v of [first, second]) {
        const r = await request(
          `/villas/${v.id}/review`,
          { status: "approved", verificationLevel: "BASIC_CHECKED" },
          admin,
        )
        assert.equal(r.status, 200, JSON.stringify(r.value))
        Object.assign(
          v,
          r.value.villas.find((x) => x.id === v.id),
        )
      }
      assert.equal(first.qrStatus, "ACTIVE")
      assert.equal(first.expires, "")
      const r = await request("/public/qr/" + first.qr)
      assert.equal(r.status, 200)
      assert.equal(r.value.nameEn, "Test Villa")
      assert.equal(r.value.verificationLevel, "BASIC_CHECKED")
      assert.equal(r.value.photoUploadedAt, null)
      const all = (await request("/public/villas")).value.villas
      assert.equal(
        all.filter((v) =>
          `${v.name} ${v.nameEn}`.toLowerCase().includes("test villa"),
        ).length,
        2,
      )
    },
  )
  await t.test(
    "buying is per villa, pending payment changes no trust level, invoice charges exactly one month",
    async () => {
      assert.equal(
        (
          await request(
            "/merchant/villa-package",
            { villaId: first.id, packageId: "premium" },
            other,
          )
        ).status,
        404,
      )
      const r = await request(
        "/merchant/villa-package",
        { villaId: first.id, packageId: "premium" },
        owner,
      )
      assert.equal(r.status, 200, JSON.stringify(r.value))
      invoice = r.value.villas
        .find((v) => v.id === first.id)
        .invoices.find((i) => i.status !== "paid")
      assert.equal(invoice.amount, 4990)
      assert.equal(invoice.months, 1)
      assert.equal(invoice.scope, "villa")
    assert.equal(invoice.paymentQr.status,"ACTIVE")
      assert.equal(
        r.value.villas.find((v) => v.id === first.id).verificationLevel,
        "BASIC_CHECKED",
      )
      assert.equal(
        (
          await request(
            "/merchant/villa-package",
            { villaId: first.id, packageId: "pro" },
            owner,
          )
        ).status,
        409,
      )
    },
  )
  await t.test(
    "payment activates only selected villa and never upgrades verification status",
    async () => {
      const bill = await db
          .prepare("SELECT * FROM invoices WHERE id=?")
          .get(invoice.id),
        v = await db.prepare("SELECT * FROM villas WHERE id=?").get(first.id)
      await db.transaction(() => confirmPayment(db, bill, v, adminUser.id))
      const r = (await request("/state", undefined, owner)).value
      first = r.villas.find((v) => v.id === first.id)
      second = r.villas.find((v) => v.id === second.id)
      assert.equal(first.packageId, "premium")
      assert.equal(first.trialUnlimited, false)
      assert.equal(first.verificationLevel, "BASIC_CHECKED")
      assert.equal(second.trialUnlimited, true)
      assert.equal(second.expires, "")
      assert.equal(second.packageId, "basic")
    },
  )
  await t.test(
    "negative reviews use same moderation rules, decisions logged and author can appeal",
    async () => {
      let r = await request(
        "/reviews",
        { qr: first.qr, rating: 1, content: "ที่พักไม่สะอาดตามที่คาดหวัง" },
        user,
      )
      assert.equal(r.status, 200, JSON.stringify(r.value))
      review = r.value.review
      assert.equal(
        (await request("/public/reviews?qr=" + first.qr)).value.reviews.length,
        0,
      )
      assert.equal(
        (
          await request(
            `/admin/reviews/${review.id}/moderate`,
            { status: "rejected", reasonCode: "low_score", reason: "คะแนนต่ำ" },
            admin,
          )
        ).status,
        400,
      )
      assert.equal(
        (
          await request(
            `/admin/reviews/${review.id}/moderate`,
            {
              status: "more_info",
              reasonCode: "insufficient_evidence",
              reason: "ขอข้อมูลวันที่เข้าพัก",
            },
            admin,
          )
        ).status,
        200,
      )
      assert.equal(
        (
          await request(
            `/reviews/${review.id}/appeal`,
            { detail: "เข้าพักวันที่ 1 มีนาคม" },
            user,
          )
        ).status,
        200,
      )
      r = await request(
        `/admin/reviews/${review.id}/moderate`,
        { status: "published" },
        admin,
      )
      assert.equal(r.status, 200)
      assert.equal(r.value.review.reviewedBy, adminUser.id)
      assert.equal(r.value.review.history.length, 3)
      assert.equal(
        (await request("/public/reviews?qr=" + first.qr)).value.reviews[0]
          .rating,
        1,
      )
      assert.equal(
        (
          await request(
            `/merchant/reviews/${review.id}/reply`,
            { content: "ขออภัยและจะปรับปรุง" },
            other,
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await request(
            `/merchant/reviews/${review.id}/reply`,
            { content: "ขอบคุณสำหรับคำแนะนำ" },
            owner,
          )
        ).status,
        200,
      )
    },
  )
  await t.test(
    "advertising needs paid entitlement, approval and active schedule; premium carries detail rights",
    async () => {
      const now = Date.now(),
        data = {
          villaId: first.id,
          placement: "home",
          approved: true,
          visible: true,
          order: 0,
          title: "ที่พักผู้สนับสนุน",
          description: "",
          image: "https://example.com/banner.jpg",
          mobileImage: "",
          href: "#page=verify&item=" + first.qr,
          label: "ดูที่พัก",
          startsAt: new Date(now - 60000).toISOString(),
          endsAt: new Date(now + 86400000).toISOString(),
        }
      assert.equal(
        (
          await request(
            "/admin/advertisements",
            { ...data, villaId: second.id },
            admin,
          )
        ).status,
        409,
      )
      const r = await request("/admin/advertisements", data, admin)
      assert.equal(r.status, 200, JSON.stringify(r.value))
      ad = r.value.advertisement
      assert.equal(
        (await request("/public/advertisements?placement=home")).value
          .advertisements.length,
        1,
      )
      assert.equal(
        (
          await request(
            "/admin/advertisements",
            { ...ad, approved: false },
            admin,
          )
        ).status,
        200,
      )
      assert.equal(
        (await request("/public/advertisements?placement=home")).value
          .advertisements.length,
        0,
      )
      assert.equal(
        (
          await request(
            "/admin/advertisements",
            { ...ad, approved: true, placement: "detail" },
            admin,
          )
        ).status,
        200,
      )
      assert.equal(
        (await request("/public/advertisements?placement=detail")).value
          .advertisements.length,
        1,
      )
    },
  )
  await t.test(
    "monthly social quotas are unique and publishing requires actual link, channel and date",
    async () => {
      const month = new Date(Date.now() + 7 * 3600000)
          .toISOString()
          .slice(0, 7),
        job = {
          villaId: first.id,
          month,
          type: "image",
          status: "pending",
          channel: "Facebook",
          publishedAt: "",
          postUrl: "",
          notes: "",
        }
      let r = await request("/admin/social-jobs", job, admin)
      assert.equal(r.status, 200, JSON.stringify(r.value))
      assert.equal(
        (await request("/admin/social-jobs", job, admin)).status,
        409,
      )
      assert.equal(
        (await request("/admin/social-jobs", { ...job, type: "video" }, admin))
          .status,
        200,
      )
      assert.equal(
        (
          await request(
            "/admin/social-jobs",
            { ...r.value.job, status: "published" },
            admin,
          )
        ).status,
        400,
      )
      assert.equal(
        (await request("/merchant/social-jobs", undefined, owner)).value.jobs
          .length,
        2,
      )
      assert.equal(
        (await request("/merchant/social-jobs", undefined, other)).value.jobs
          .length,
        0,
      )
    },
  )
  await t.test(
    "media upload dates, capture dates and actual team review dates remain independent",
    async () => {
      const file = {
        name: "photo.png",
        type: "image/png",
        data:
          "data:image/png;base64," +
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString("base64"),
      }
      let r = await request(
        "/merchant/property-media",
        { villaId: first.id, takenAt: "2020-01-01", file },
        owner,
      )
      assert.equal(r.status, 200, JSON.stringify(r.value))
      const m = r.value.media
      assert.equal(m.takenAt, "2020-01-01")
      assert.equal(m.reviewedAt, null)
      assert.ok(m.uploadedAt.startsWith(new Date().toISOString().slice(0, 10)))
      assert.equal(
        (
          await request(
            "/admin/property-media",
            { villaId: first.id, mediaId: m.id },
            admin,
          )
        ).status,
        200,
      )
      r = await request("/public/property-media?qr=" + first.qr)
      assert.ok(r.value.media[0].reviewedAt)
      assert.equal(r.value.latestUpdatedAt, m.uploadedAt)
      assert.equal((await request(m.url.replace("/api", ""))).status, 200)
      assert.equal(
        (
          await request(
            "/merchant/property-media",
            { villaId: first.id, takenAt: "2020-02-31", file },
            owner,
          )
        ).status,
        400,
      )
      const video = {
        name: "clip.mp4",
        type: "video/mp4",
        data:
          "data:video/mp4;base64," +
          Buffer.from([0, 0, 0, 20, 102, 116, 121, 112, 0, 0, 0, 0]).toString(
            "base64",
          ),
      }
      assert.equal(
        (
          await request(
            "/merchant/property-media",
            { villaId: second.id, file: video },
            owner,
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await request(
            "/merchant/property-media",
            { villaId: first.id, file: video },
            owner,
          )
        ).status,
        200,
      )
    },
  )
  await t.test(
    "expired paid package suspends paid QR and advertising, free villa stays active",
    async () => {
      await db
        .prepare(
          "UPDATE villas SET expires='2000-01-01T00:00:00.000Z' WHERE id=?",
        )
        .run(first.id)
      const paid = (await request("/public/qr/" + first.qr)).value,
        free = (await request("/public/qr/" + second.qr)).value
      assert.equal(paid.qrStatus, "EXPIRED")
      assert.equal(paid.valid, false)
      assert.equal(free.qrStatus, "ACTIVE")
      assert.equal(
        (await request("/public/advertisements?placement=detail")).value
          .advertisements.length,
        0,
      )
    },
  )
  await t.test(
    "CMS banners validate dates, safe URLs and configurable slide interval",
    async () => {
      const data = structuredClone(cmsDefaults)
      data.home.banners = [
        {
          id: "banner-one",
          image: "https://example.com/a.jpg",
          mobileImage: "https://example.com/mobile.jpg",
          title: "Banner",
          description: "Description",
          href: "#page=directory",
          label: "ค้นหา",
          visible: true,
          sponsored: false,
          startsAt: "2026-01-01T00:00:00+07:00",
          endsAt: "2027-01-01T00:00:00+07:00",
        },
      ]
      data.home.slideIntervalMs = 4000
      assert.equal(validateCms(data).home.banners.length, 1)
      data.home.banners[0].href = "javascript:alert(1)"
      assert.throws(() => validateCms(data))
      data.home.banners[0].href = "#page=directory"
      data.home.slideIntervalMs = 0
      assert.throws(() => validateCms(data))
      assert.throws(() => mediaDate("2026-02-31"))
      assert.equal(qrReference("https://example.com/not-a-villa"), null)
      assert.equal(qrReference("random text"), null)
      assert.equal(
        qrReference("https://example.com/#page=verify&item=VC-12345"),
        "VC-12345",
      )
    },
  )
})
