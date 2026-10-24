import test from "node:test"
import assert from "node:assert/strict"
import {openTestDatabase} from "./test-database.mjs"
import {createUser,createInvoice} from "./database.mjs"
import {seedCatalog,listPlans,getPlan} from "./catalog.mjs"
import {basicPricing,basicPromotionApi,grantBasicPromotion} from "./basic-promotion.mjs"
import {packageEntitlementsApi} from "./package-entitlements.mjs"
import {reviewsApi} from "./reviews.mjs"

test("Basic is one 990-baht plan, 100% discounted; disabling promotion retains immutable old grants",async t=>{
 const db=await openTestDatabase();t.after(()=>db.close());await seedCatalog(db)
 const admin=await createUser(db,"basic-admin@example.test","Password12345","Admin","admin")
 const plans=await listPlans(db);assert.equal(plans.filter(p=>p.id==="basic").length,1)
 const basic=await getPlan(db,"basic");assert.equal(basic.regularAmount,99000);assert.equal(basic.discountAmount,99000);assert.equal(basic.netAmount,0)
 await db.transaction(()=>grantBasicPromotion(db,"old-villa",admin.id))
 const grant=(await db.prepare("SELECT value FROM system_settings WHERE key='basic_grant:old-villa'").get()).value
 await assert.rejects(basicPromotionApi(db,{role:"merchant"},{method:"POST"},"/api/admin/basic-promotion",async()=>({active:false,revision:1})),{status:403})
 await basicPromotionApi(db,admin,{method:"POST"},"/api/admin/basic-promotion",async()=>({active:false,revision:1}))
 assert.equal((await basicPricing(db)).netAmount,99000)
 await assert.rejects(createInvoice(db,{id:"old-villa",package_id:"basic",owner_id:admin.id},"http://test"),{status:409})
 await assert.rejects(db.transaction(()=>grantBasicPromotion(db,"new-villa",admin.id)),{status:409})
 await db.transaction(()=>grantBasicPromotion(db,"old-villa",admin.id))
 assert.equal((await db.prepare("SELECT value FROM system_settings WHERE key='basic_grant:old-villa'").get()).value,grant)
 assert.equal((await db.prepare("SELECT count(*) AS n FROM invoices").get()).n,0)
 await assert.rejects(basicPromotionApi(db,admin,{method:"POST"},"/api/admin/basic-promotion",async()=>({active:true,revision:1})),{status:409})
})
test("moderation is a package capability independent of price; unconfirmed guarantees are not advertised",async t=>{
 const db=await openTestDatabase();t.after(()=>db.close());await seedCatalog(db)
 const owner=await createUser(db,"entitlement-owner@example.test","Password12345","Owner"),admin=await createUser(db,"entitlement-admin@example.test","Password12345","Admin","admin")
 await db.prepare("INSERT INTO documents VALUES ('ent-doc',?,?,?,?)").run(owner.id,"proof.pdf","application/pdf",Buffer.from("%PDF-"))
 await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,created) VALUES ('ent-villa',?,'Villa','Bangkok','Owner','entitlement-owner@example.test','pro','ent-doc','approved','VC-ent','now')").run(owner.id)
 const call=()=>reviewsApi(db,null,{method:"GET"},"/api/public/reviews",new URL("http://test?qr=VC-ent"))
 assert.equal((await call()).moderationRequired,true)
 await db.prepare("UPDATE package_catalog SET amount=100 WHERE id='pro'").run()
 assert.equal((await call()).moderationRequired,true)
 await packageEntitlementsApi(db,admin,{method:"POST"},"/api/admin/package-entitlements/pro",async()=>({revision:1,reviewModerationRequired:false}))
 assert.equal((await call()).moderationRequired,false)
 const plans=await listPlans(db);assert(plans.every(p=>p.guarantee===null&&!p.features.some(f=>f.includes("การันตีบ้านตรงปก"))))
 assert(plans.every(p=>!p.description.includes("การันตีบ้านตรงปก")))
 await assert.rejects(packageEntitlementsApi(db,admin,{method:"POST"},"/api/admin/package-entitlements/pro",async()=>({revision:2,reviewModerationRequired:true,guarantee:"Unapproved guarantee"})),{status:400})
})
