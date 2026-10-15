import test from "node:test"
import assert from "node:assert/strict"
import { openTestDatabase } from "./test-database.mjs"
import { createUser, hashPassword, createInvoice } from "./database.mjs"
import { subscriptionInvoice } from "./subscriptions.mjs"
import { randomUUID } from "node:crypto"
import { createApp } from "./app.mjs"
import { cmsDefaults } from "./cms-defaults.mjs"
import { validateCms } from "./cms.mjs"

test("CMS drafts, release history, media privacy, permissions and optimistic concurrency", async (t) => {
  const db = await openTestDatabase()
  await createUser(
    db,
    "cms-admin@example.test",
    "CmsPassword123",
    "Editor",
    "admin",
  )
  await createUser(
    db,
    "cms-owner@example.test",
    "CmsPassword123",
    "Owner",
    "merchant",
  )
  const config = {
    appUrl: "http://localhost:3001",
    allowedOrigins: ["http://localhost:3001"],
    fakeHash: hashPassword("fake-password"),
    serverless: true,
    paymentInstructions: "Existing bank",
  }
  const server = createApp(db, config)
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    await db.close()
  })
  const request = async (path, data, session, headers = {}) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Origin: config.appUrl,
        "Content-Type": "application/json",
        ...(session
          ? { Cookie: session.cookie, "X-CSRF-Token": session.csrf }
          : {}),
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
    return {
      status: r.status,
      value: r.headers.get("content-type")?.includes("json")
        ? await r.json()
        : await r.arrayBuffer(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    }
  }
  const login = async (email) => {
    const r = await request("/api/auth/login", {
      email,
      password: "CmsPassword123",
    })
    return { cookie: r.cookie, csrf: r.value.csrf }
  }
  const admin = await login("cms-admin@example.test"),
    owner = await login("cms-owner@example.test")
  let state, media
  await t.test(
    "Guest and Merchant cannot read or change CMS, mutations require CSRF",
    async () => {
      assert.equal((await request("/api/admin/cms")).status, 401)
      assert.equal(
        (await request("/api/admin/cms", undefined, owner)).status,
        403,
      )
      assert.equal(
        (
          await request(
            "/api/admin/cms/save",
            { revision: 0, content: cmsDefaults },
            owner,
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await request(
            "/api/admin/cms/save",
            { revision: 0, content: cmsDefaults },
            admin,
            { "X-CSRF-Token": "bad" },
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await request(
            "/api/admin/cms/save",
            { revision: 0, content: cmsDefaults },
            admin,
            { Origin: "https://bad.test" },
          )
        ).status,
        403,
      )
    },
  )
  await t.test(
    "Upload accepts PNG, rejects disguised HTML and stays private until release",
    async () => {
      assert.equal(
        (
          await request(
            "/api/admin/cms/media",
            {
              file: {
                name: "bad.png",
                type: "image/png",
                data:
                  "data:image/png;base64," +
                  Buffer.from("<script>bad</script>").toString("base64"),
              },
            },
            admin,
          )
        ).status,
        400,
      )
      const file = {
        name: "dummy.png",
        type: "image/png",
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      }
      const r = await request("/api/admin/cms/media", { file }, admin)
      assert.equal(r.status, 200)
      media = r.value
      assert.equal((await request(media.url)).status, 404)
      assert.equal((await request(media.url, undefined, owner)).status, 404)
      assert.equal((await request(media.url, undefined, admin)).status, 200)
      assert.equal(
        (await request("/api/admin/cms/media", undefined, admin)).value.media
          .length,
        1,
      )
    },
  )
  await t.test(
    "Draft save does not change public site and content is normalized",
    async () => {
      const content = structuredClone(cmsDefaults)
      content.home.title = "Dummy CMS title"
      content.home.images = [media.url]
      content.site.paymentInstructions = "Dummy bank instructions"
      content.site.paymentQrImage = media.url
      content.articles.push({
        id: "hidden",
        title: "Private draft",
        description: "",
        body: "Never public",
        image: "",
        visible: false,
      })
      content.faqs = [
        {
          id: "faq-one",
          question: "Question",
          answer: "Answer",
          visible: true,
        },
      ]
      const r = await request(
        "/api/admin/cms/save",
        { revision: 0, content },
        admin,
      )
      assert.equal(r.status, 200)
      state = r.value
      assert.equal(state.draft.revision, 1)
      assert.equal(
        (await request("/api/public/cms")).value.content.home.title,
        cmsDefaults.home.title,
      )
      assert.equal((await request(media.url)).status, 404)
    },
  )
  await t.test(
    "Stale save/publish cannot overwrite a newer draft",
    async () => {
      assert.equal(
        (
          await request(
            "/api/admin/cms/save",
            { revision: 0, content: cmsDefaults },
            admin,
          )
        ).status,
        409,
      )
      assert.equal(
        (await request("/api/admin/cms/publish", { revision: 0 }, admin))
          .status,
        409,
      )
    },
  )
  await t.test(
    "Publishing releases draft; hidden articles and payment settings stay out of public payload",
    async () => {
      const r = await request("/api/admin/cms/publish", { revision: 1 }, admin)
      assert.equal(r.status, 200)
      state = r.value
      const pub = (await request("/api/public/cms")).value
      assert.equal(pub.content.home.title, "Dummy CMS title")
      assert.equal(pub.revision, 1)
      assert.equal(pub.content.site.paymentInstructions, "")
      assert.equal(pub.content.site.paymentQrImage, "")
      assert.equal((await request("/api/state", undefined, owner)).value.paymentBankQrImage, media.url)
      assert.ok(!pub.content.articles.some((a) => a.id === "hidden"))
      assert.equal(pub.content.faqs[0].question, "Question")
      assert.equal((await request(media.url)).status, 200)
      assert.equal(
        (await request("/api/state", undefined, owner)).value
          .paymentInstructions,
        "Dummy bank instructions",
      )
      assert.deepEqual(
        state.history.map((v) => v.revision),
        [1, 0],
      )
    },
  )
  await t.test(
    "Restore creates a new draft; only publishing it rolls back live site",
    async () => {
      const r = await request(
        "/api/admin/cms/restore",
        { revision: 1, version: 0 },
        admin,
      )
      assert.equal(r.status, 200)
      state = r.value
      assert.equal(state.draft.revision, 2)
      assert.equal(
        (await request("/api/public/cms")).value.content.home.title,
        "Dummy CMS title",
      )
      assert.equal(
        (await request("/api/admin/cms/publish", { revision: 2 }, admin))
          .status,
        200,
      )
      assert.equal(
        (await request("/api/public/cms")).value.content.home.title,
        cmsDefaults.home.title,
      )
      assert.equal((await request(media.url)).status, 404)
      assert.equal((await request(media.url, undefined, admin)).status, 200)
      assert.equal(
        (
          await request(
            "/api/admin/cms/restore",
            { revision: 2, version: 99 },
            admin,
          )
        ).status,
        404,
      )
    },
  )
  await t.test(
    "Unsafe URLs, malformed structures, duplicates and missing base pages are rejected",
    async () => {
      for (const change of [
        (c) => (c.site.facebook = "javascript:alert(1)"),
        (c) => (c.home.images = ["data:image/svg+xml,<svg/>"]),
        (c) => (c.site.paymentQrImage = "javascript:alert(1)"),
        (c) => (c.pages = []),
        (c) => (c.articles = [null]),
        (c) => (c.home.sections = [...c.home.sections, c.home.sections[0]]),
        (c) => c.pages.push(c.pages[0]),
        (c) => (c.home.images = []),
      ]) {
        const c = structuredClone(cmsDefaults)
        change(c)
        assert.throws(
          () => validateCms(c),
          (e) => e.status === 400,
        )
        assert.equal(
          (
            await request(
              "/api/admin/cms/save",
              { revision: 2, content: c },
              admin,
            )
          ).status,
          400,
        )
      }
    },
  )
  await t.test(
    "Revision writes persist transactionally with actor audit records",
    async () => {
      const rows = await db
        .prepare("SELECT action FROM audits WHERE action LIKE 'CMS_%'")
        .all()
      assert.equal(rows.filter((x) => x.action === "CMS_PUBLISH").length, 2)
      assert.equal(rows.filter((x) => x.action === "CMS_SAVE_DRAFT").length, 1)
      assert.equal(
        rows.filter((x) => x.action === "CMS_RESTORE_DRAFT").length,
        1,
      )
      const r = await request("/api/admin/cms", undefined, admin)
      assert.equal(r.value.draft.revision, 2)
      assert.equal(r.value.published.revision, 2)
      assert.equal(r.value.draft.updatedBy, "Editor")
    assert.ok(r.value.history.every(v=>!("content" in v)))
    },
  )
  await t.test(
    "Images referenced by historical releases cannot be deleted; unused uploads can",
    async () => {
      assert.equal(
        (await request("/api/admin/cms/media/delete", { id: media.id }, admin))
          .status,
        409,
      )
      const r = await request(
        "/api/admin/cms/media",
        {
          file: {
            name: "unused.png",
            type: "image/png",
            data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
          },
        },
        admin,
      )
      assert.equal(r.status, 200)
      assert.equal(
        (
          await request(
            "/api/admin/cms/media/delete",
            { id: r.value.id },
            admin,
          )
        ).status,
        200,
      )
      assert.equal((await request(r.value.url, undefined, admin)).status, 404)
    },
  )
  await t.test(
    "Concurrent editors get one committed draft and one conflict",
    async () => {
      const results = await Promise.all(
        [1, 2].map((i) =>
          request(
            "/api/admin/cms/save",
            {
              revision: 2,
              content: {
                ...structuredClone(cmsDefaults),
                site: { ...cmsDefaults.site, name: `Concurrent ${i}` },
              },
            },
            admin,
          ),
        ),
      )
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409])
      assert.equal(
        (await request("/api/admin/cms", undefined, admin)).value.draft
          .revision,
        3,
      )
      assert.equal((await request("/api/public/cms")).value.revision, 2)
    },
  )
  await t.test("Published business rules affect new invoices, preserve old terms, support annual billing and render email tokens",async()=>{
    const owner=(await db.prepare("SELECT id FROM users WHERE email=?").get("cms-owner@example.test")).id
    const fixture=async(payments=0)=>{
      const id=randomUUID(),doc=randomUUID(),stamp=new Date().toISOString()
      await db.prepare("INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)").run(doc,owner,"dummy.pdf","application/pdf",Buffer.from("%PDF-1.4 Dummy"))
      await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,created,payments) VALUES (?,?,?,?,?,?,?,?,?,?)").run(id,owner,"CMS Dummy Villa","ชลบุรี","Dummy Merchant","dummy@example.test","starter",doc,stamp,payments)
      return db.prepare("SELECT * FROM villas WHERE id=?").get(id)
    }
    const old=await createInvoice(db,await fixture(),config.appUrl)
    assert.equal((await db.prepare("SELECT months FROM invoices WHERE id=?").get(old)).months,3)
    const c=structuredClone(cmsDefaults);c.site.paymentQrImage=media.url;c.business.monthlyInitialMonths=6;c.business.monthlyRenewalMonths=2;c.business.paymentEmailSubject="CMS {{package}} / {{villa}}";c.business.paymentEmailIntro="Hello {{merchant}}"
    assert.equal((await request("/api/admin/cms/save",{revision:3,content:c},admin)).status,200)
    assert.equal((await request("/api/admin/cms/publish",{revision:4},admin)).status,200)
    const first=await createInvoice(db,await fixture(),config.appUrl),renew=await createInvoice(db,await fixture(1),config.appUrl)
    assert.equal((await db.prepare("SELECT months FROM invoices WHERE id=?").get(first)).months,6)
    assert.equal(JSON.parse((await db.prepare("SELECT value FROM system_settings WHERE key=?").get(`invoice_bank_qr:${first}`)).value),media.url)
    assert.equal(JSON.parse((await db.prepare("SELECT value FROM system_settings WHERE key=?").get(`invoice_bank_qr:${old}`)).value),"")
    assert.equal((await db.prepare("SELECT months FROM invoices WHERE id=?").get(renew)).months,2)
    assert.equal((await db.prepare("SELECT months FROM invoices WHERE id=?").get(old)).months,3)
    await db.prepare("UPDATE package_catalog SET billing_cycle='YEARLY' WHERE id='starter'").run()
    const annual=await createInvoice(db,await fixture(),config.appUrl)
    assert.equal((await db.prepare("SELECT months FROM invoices WHERE id=?").get(annual)).months,12)
    await db.prepare("UPDATE package_catalog SET billing_cycle='MONTHLY' WHERE id='starter'").run()
    await db.prepare("INSERT INTO subscriptions(owner_id,package_id,created) VALUES (?,?,?)").run(owner,"starter",new Date().toISOString())
    const invoice=await subscriptionInvoice(db,await fixture(),config.appUrl,"starter")
    const mail=await db.prepare("SELECT subject,body FROM mails WHERE invoice_id=?").get(invoice)
    assert.ok(mail.subject.startsWith("CMS Trust Starter / CMS Dummy Villa"))
    assert.ok(mail.body.startsWith("Hello Dummy Merchant"))
    assert.ok(mail.body.includes(invoice)&&mail.body.includes("6 เดือน"))
    const bad=structuredClone(c);bad.business.monthlyInitialMonths=0
    assert.equal((await request("/api/admin/cms/save",{revision:4,content:bad},admin)).status,400)
    bad.business.monthlyInitialMonths=3;bad.business.paymentEmailSubject="Bad {{unsupported}}"
    assert.equal((await request("/api/admin/cms/save",{revision:4,content:bad},admin)).status,400)
  })
})
