# GitHub → Vercel Staging — คู่มือที่ใช้จริง

24 ตุลาคม 2026 · **ยังไม่แนะนำให้ Push เพื่อ trigger deploy จนกว่าจะปิด preflight blockers** โค้ดผ่าน local QA แล้ว ผู้ใช้ยืนยัน Git integration และ Production Branch แล้ว แต่ DB/payment บน host ยังต้องยืนยัน งานนี้ไม่มี Push/Merge/Deploy/แก้ Branch Configuration/แก้ DB

## 1. ข้อเท็จจริงจาก Git

| รายการ | ผลตรวจเริ่ม session |
|---|---|
| Branch | `fix/autonomous-business-security-20261024` |
| HEAD | `f95e03f` ก่อนแก้เอกสารรอบนี้; ใช้ `git rev-parse HEAD` หลัง local commit เอกสารเป็น revision ส่งมอบ |
| origin | `https://github.com/devwaygocargo-oss/VillaCheckTH.git` |
| legacy | `https://github.com/dewpm/DesignVillaCheck-finish.git` |
| Upstream branch | ยังไม่ได้ตั้ง |
| origin default/main | `9e2b160efd989e17a2cdfe62a6d37c17a55e8d15` |
| legacy default/main | `2ef088a593dd81e30a742d48821fee441237a89c` |
| Branch งานบน GitHub | ไม่พบ branch นี้ทั้ง origin และ legacy จาก `git ls-remote` |
| Working tree เดิม | `.DS_Store` 1 tracked modification และ 216 untracked paths ใน audit-results/reports; คงไว้ ไม่รวม Push ด้วย HEAD |

origin/main เป็น ancestor ของ HEAD ณ ตรวจ และมี 6 local commits เพิ่มจาก origin/main ก่อนเอกสารรอบนี้ แต่ **GitHub default branch = main ไม่ได้พิสูจน์ว่า Vercel Production Branch = main** ชื่อ origin/legacy เป็นเพียงชื่อในเครื่อง ไม่บอกว่า Vercel ต่อ repository ใด

ไม่มี `.github` workflow ใน source ที่ตรวจ แต่ GitHub Apps/webhooks หรือ Vercel projects อื่นอาจผูก repository เดียวกันได้ `.vercel/project.json` อยู่ใน gitignore จึงไม่ถูกส่งด้วย Git push และไม่ได้ควบคุม Git integration ของ Vercel

## 2. Vercel ที่ต้องตรวจจาก Dashboard

ผู้ใช้ยืนยันจาก Dashboard แล้วว่า project `design-villacheck` เชื่อม `devwaygocargo-oss/VillaCheckTH` และ Production Branch=`main` ข้อมูลนี้แทนข้อจำกัดเรื่อง repo/Production Branch ใน audit รอบก่อนที่ API 403 ส่วน live SHA, custom Branch Tracking/domain mapping และ effective env/DB ยังไม่ได้ตรวจโดย agent ดู [Environment Mapping ตาม Source](vercel-staging-environment-mapping.md)

ดิวเปิด **Vercel → เลือก Team ที่ถูกต้อง → project ที่เป็นเจ้าของ design-villacheck.vercel.app** แล้วบันทึก:

1. **Settings → Git → Connected Git Repository**: owner/repo ต้องตรง origin หรือ legacy ที่ตรวจข้างต้น ตรวจ GitHub App ว่ามีสิทธิ์ repo นี้
2. **Settings → Environments → Production → Branch Tracking** (หรือช่อง Production Branch ใน Git ตาม UI): branch ที่ใช้ Production environment และการ auto-assign domains เปิดอยู่หรือไม่
3. **Environments → Preview/custom staging → Branch Tracking**: มี rule พิเศษของ branch งานหรือไม่
4. **Settings → Domains → design-villacheck.vercel.app** และรายละเอียด deployment ที่เสิร์ฟจริง: ผูก Production, Preview branch หรือ custom environment ใด ถ้า default domain แก้ mapping ไม่ได้ ให้ตรวจใน deployment Domains/Project Overview แทน ไม่สมมติว่าย้ายได้ทุกชนิด
5. **Deployments → deployment ปัจจุบัน → Source/Environment/Domains**: repository, branch, full SHA, target, status และ alias จริง
6. **Settings → Git/Build and Deployment**: Git deployments เปิดหรือไม่, Ignored Build Step, Root Directory, Next.js/`.next`/Node24/build overrides และสิทธิ์ commit author
7. **Settings → Environment Variables**: target scopes/branch-specific overrides ของ runtime/direct/backup DB, payment/OTP/SMTP ตรวจด้วย secret manager ไม่คัดลอกค่าลงรายงาน
8. GitHub repo **Settings → Integrations/Installed GitHub Apps/Webhooks** และ commit/PR checks: ตรวจ project อื่นหรือบริการ production hosting ที่อาจถูก trigger พร้อมกัน

ชื่อ Production environment ใน Vercel project สำหรับ staging ไม่ได้หมายถึง production hosting บริษัท `villacheckth.com` ต้องยืนยัน DB/services แยก แม้ทดสอบผ่าน Preview URL ก็อาจใช้บริการ production หาก env ตั้งผิด

## 3. Push branch ไหนแล้วได้อะไร

ตามข้อมูลยืนยันล่าสุด ให้ใช้ **origin** และ Production Branch=main; push branch งานโดยปกติได้ Preview ไม่อัปเดต URL หลัก เว้นแต่มี custom rule/domain mapping ที่ตรวจยืนยันต่างหาก งานนี้ไม่ push/merge เข้า main

| เงื่อนไขที่ Dashboard ยืนยัน | Push branch งานนี้แล้วเกิดอะไร |
|---|---|
| Repo ถูกต้อง + branch นี้เป็น Production Branch + URL หลักผูก Production + auto deployment/domain assignment เปิด | โดยปกติสร้าง deployment Production ของ **project staging** และอัปเดต URL หลักเมื่อ build/approval ผ่าน |
| Repo ถูกต้อง + Production Branch เป็น main/branch อื่น และไม่มี custom tracking/domain mapping สำหรับ branch งาน | โดยปกติได้ Preview URL; **ไม่อัปเดต design-villacheck.vercel.app** |
| Repo ถูกต้อง + custom/Preview branch tracking และ domain ผูก branch นี้จริง | ได้ environment/domain ตาม mapping ที่ตรวจ ไม่ตัดสินจากชื่อ branch อย่างเดียว |
| Push ผิด repository หรือ Git deployment ถูกปิด/ignored | ไม่อัปเดต project ที่ต้องการ และอาจ trigger project อื่น |
| ยังไม่ทราบ integration/branch/domain | ระบุปลายทางไม่ได้ — ให้หยุดก่อน Push |

หลักการอ้างอิง [Vercel Git integration](https://vercel.com/docs/git) และ [Environments](https://vercel.com/docs/deployments/environments) ไม่ใช่หลักฐาน configuration ของ VillaCheck ไม่เปลี่ยน Production Branch หรือ domain mapping ในรอบนี้

## 4. Safety gate ก่อน Push ทุกกรณี

- [ ] ยืนยัน repository ที่เชื่อมจริงและ project/branch/environment/domain mapping รวม project อื่นที่จะ trigger
- [ ] ยืนยัน **PostgreSQL staging แยก production** ทุก `DATABASE_URL`/alias/`DIRECT_URL`/backup URL และ schema/TLS/role ไม่ใช้ local `.env` พิสูจน์ host
- [ ] ตั้งและตรวจ `PAYMENT_ACCESS_MODE=DISABLED`, `OMISE_TEST_ENABLED=false`; ปิด demo seed และ hold payment mail workers; old manual proof/confirm/QR/Omise routes ปิดจริง
- [ ] ตั้ง `APP_ENV=staging`, APP_URL ให้ตรง URL ที่ทดสอบ, SMTP/OTP และ exact QA inbox allowlist; Preview/custom scopes ต้องตรวจแยก ไม่ copy production env โดยไม่ทบทวน
- [ ] สำรองฐาน staging/ตรวจ schema compatibility และ rollback artifact โดย Operator ไม่มี migration ใหม่จากเอกสารรอบนี้ ไม่รัน DB migration ภายนอกเอง

หลักฐาน Staging GET จากรอบก่อน (รอบ Environment Mapping นี้ไม่เรียก host): health 200, packages 401, public listing 200; `/api/config` เป็น `paymentConfigured=true`, `demoMode=true` และไม่ส่ง paymentAccessMode จึง **ยังยืนยัน gate ปิดไม่ได้** ไม่อ้างว่ารับเงินจริงได้จาก flag นี้ Headers บางรายการยังขาดตาม source ล่าสุด และไม่ทราบ Git SHA/DB จึงยังไม่แนะนำ deploy ก่อนตรวจ

## 5. คำสั่ง Git ที่เตรียมให้ดิว — ยังไม่ได้รัน Push

ตรวจ local และ remote refs ใหม่ก่อนใช้งาน ไม่ใช้ `git add .`, force push, reset หรือ push HEAD เข้า main โดยตรง งานเดิมที่ยังไม่ commit ไม่ถูกส่งด้วย HEAD:

```sh
git branch --show-current
git rev-parse HEAD
git status --short
git log -8 --oneline
git remote -v
git ls-remote --symref origin HEAD refs/heads/main refs/heads/fix/autonomous-business-security-20261024
git ls-remote --symref legacy HEAD refs/heads/main refs/heads/fix/autonomous-business-security-20261024
```

ต้องอยู่ branch งานที่ระบุ และ commit ที่จะส่งต้องตรง revision ที่ตรวจรับ Secret-safe remote ที่ตรวจรอบนี้ไม่มี credentials ฝังใน URL หากเครื่องอื่นมีให้ดูโดยไม่แชร์ค่า

**หลัง safety gate ผ่าน และ Dashboard ยืนยันเชื่อม devwaygocargo-oss/VillaCheckTH เท่านั้น:**

```sh
git push origin HEAD:refs/heads/fix/autonomous-business-security-20261024
```

**ไม่ใช้ legacy เป็นปลายทางของ staging นี้** เพราะ Dashboard ที่ผู้ใช้ยืนยันเชื่อม repository ของ origin แล้ว เก็บ remote เดิมไว้โดยไม่ลบหรือเปลี่ยน configuration

คำสั่งไม่ตั้ง upstream ไม่เปลี่ยน remote configuration และไม่ merge ไม่รับรองว่า URL หลักจะเปลี่ยน ต้องใช้ตารางข้อ 3 หากมี remote branch ใหม่หรือ divergent ให้ fetch/review/แก้ conflict ในงานที่ได้รับอนุญาตแยก ห้าม force แทนการตรวจ

ถ้า Production Branch เป็น main และ branch งานได้เพียง Preview: ให้ตรวจ Preview ก่อน จากนั้นต้องผ่าน PR/การอนุมัติและกระบวนการนำ commit เข้า branch ที่ผูกไว้ตามทีม **ไม่ Push HEAD:main หรือ Merge เองในรอบนี้** ไม่จำเป็นต้องเปลี่ยน Branch Configuration เพื่อแก้เฉพาะหน้า

## 6. หลัง Push โดยดิว

1. เปิด commit/PR บน GitHub ดู Vercel checks ว่า project ถูกต้องและ SHA ตรง local HEAD ที่ส่ง หากไม่มี check ให้ตรวจ GitHub App/ignored builds/permission ไม่ Push ซ้ำสุ่ม
2. Vercel → Deployments: ตรวจ Source repository/branch/full SHA, Environment และ build/runtime logs ต้องใช้ `npm run build`/Next/`.next` ไม่ใช่ Vite/dist และไม่มี migration/seed ใน build
3. เปิด deployment URL ที่ได้ ตรวจ APP_URL/cookie/security headers/health/DB isolation/payment gate และ legacy routesด้วยบัญชี QA หลัง target ปลอดภัย อย่าใช้ข้อความ Ready แทนการทดสอบ
4. ตรวจ `design-villacheck.vercel.app` ว่า alias ชี้ deployment SHA นี้จริง ถ้ายังชี้เก่าและ deployment เป็น Preview ถือว่า **ยังไม่ได้อัปเดต URL หลัก** อย่า promote/เปลี่ยน branch โดยไม่ได้อนุมัติ
5. ทดสอบ OTP ถึง QA inbox จริง แล้วทำ [Phase 1 UAT เดิม 16 กรณี](phase1-business-uat-checklist.md) และอุปกรณ์จริง แยก local/mock/staging/Business UAT ให้ชัด

## 7. Rollback ผ่าน GitHub/Vercel Dashboard

ก่อน deploy เก็บ previous deployment ID/URL/SHA/env scope/DB backup ที่ตรวจจริงและยืนยันว่ารุ่นเก่าปิด payment ได้

- หากเป็น Production deployment ของ project staging และมี eligible deployment ให้ Operator ที่ได้รับอนุญาตใช้ **Project Overview/Deployments → Instant Rollback** ไป artifact ที่ตรวจแล้ว หลัง rollback ตรวจ domain/SHA/payment/headers/auth อีกครั้ง อาจปิด auto-assignment จึงต้องตรวจสถานะก่อน Push ครั้งต่อไป ตาม [เอกสาร rollback](https://vercel.com/docs/instant-rollback)
- Preview/custom environment อาจไม่มี Instant Rollback ที่ใช้กับ URL นั้นได้ ให้ Operator ตรวจกลไก domain/environment ของ project จริง ไม่สมมติว่า Preview promotion เท่ากับ rollback และไม่เปลี่ยน mapping โดยพลการ
- การแก้กลับใน GitHub ใช้ revert commit/PR ที่ระบุชัดและผ่าน review เพื่อให้ sourceตรงกับ artifact ย้อนกลับ ไม่ force/reset history ตัวอย่าง `git revert <APPROVED_BAD_COMMIT>` เฉพาะหลังเลือก commit ถูกต้องและได้รับอนุญาต ไม่สั่งช่วง commit กว้าง/merge revert โดยเดา
- ย้อนก่อน `21d226a` ต้อง ingress restriction และหยุด payment mail workers เพราะ app เก่าอาจไม่รู้จัก DISABLED
- ไม่ restore DB อัตโนมัติหรือทับฐานที่มีรายการใหม่ ถ้าจำเป็นใช้ฐานใหม่ว่างพร้อมแผนที่อนุมัติแยก เก็บ invoice/grant/QR/history เดิม

## ผลตรวจความพร้อม Push ของ source

source/runtime ไม่มีการแก้ในรอบเอกสารนี้ Local QA ล่าสุด PostgreSQL 262 ผ่าน, SQLite 254 ผ่าน/8 ข้าม, Chrome 66 ผ่าน, Build/Typecheck/Lint ผ่าน จาก revision `f95e03f` ตรวจ hashes ของไฟล์ที่บันทึกไว้ก่อนแก้เอกสารแล้วตรง ไม่มี tracked `.env` จริง/ไฟล์ key/backup จาก filename scan ไม่อ้างว่า scan นี้พิสูจน์ไม่มี secret ทุกชนิด/ทุก Git history

**พร้อมด้าน code review/local validation แต่ HOLD การ Push ที่จะ trigger deployment จนยืนยัน DB/payment safety และ env scopes ได้** หลักฐานใหม่อยู่ใน [git-readiness.json](validation/github-staging/git-readiness.json), [Vercel API](validation/github-staging/vercel-readonly.json) และ [Staging GET](validation/github-staging/public-probes.json)
