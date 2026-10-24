# Approval Runbook — Neon Preview → GitHub → Vercel

คู่มือนี้เตรียมไว้เท่านั้น ทุก external mutation ต้องได้รับอนุมัติตามชุด A–F ก่อน ห้ามตีความการอนุมัติสร้าง branch เป็นการอนุมัติ seed/migration/push/merge ด้วย

## A. Read-only mapping และ data classification

- [ ] Neon Console → เลือก project ที่แสดงชื่อ neon-citrine-xylophone ตรวจ project ID จริง, Branches → main, Databases → neondb และรายการ branch ทั้งหมด ตรวจ staging-preview ว่ามีแล้วหรือไม่
- [ ] Vercel design-villacheck → Storage/Integrations → Neon resource → ดู project/resource mapping และ Production/Preview connections
- [ ] หากเป็น native integration ตรวจ Neon Integrations → Vercel Settings → Production branch และ Preview Branching ที่เปิดจริง Default branch ชื่อ main เพียงอย่างเดียวไม่พิสูจน์ Vercel Production ใช้ main
- [ ] Settings → Environment Variables ตรวจ effective DATABASE_URL ที่มี precedence สูงกว่า VillaCheck_DATABASE_URL พร้อม direct/backup URLs ทุก scope/override โดยไม่คัดลอกค่าออกมา
- [ ] ระบุ DB ของ production hosting จริงแยกจาก staging หากยังไม่ทราบให้บันทึกไม่ยืนยัน ห้ามเปิด villacheckth.com หรือแก้บริการจริงเพื่อหาคำตอบในงานนี้
- [ ] เจ้าของข้อมูลระบุ main มีข้อมูลผู้ใช้/PII/เอกสาร/การเงิน/queues/secrets ใน schema หรือไม่ เก็บเฉพาะ classification/ผลเทียบไม่ dump ข้อมูล
- [ ] ตรวจ branch protection, root/compute/storage quota, schema-only option และ role ที่จำเป็น
- [ ] ตรวจ Branch Overview ของ staging-preview ว่ามีวันหมดอายุ/Automatically delete branch after หรือไม่ และบันทึก expires_at โดยไม่เผย credentials
- [ ] ยืนยันว่า branch นี้เป็น fixed manual branch หรือ integration-managed preview branch ตรวจ cleanup ของ Neon/Vercel, GitHub Apps/workflows และ Deployment Retention แยกจาก TTL

ผลตรวจที่ต้องบันทึก: □ mapping ยืนยัน □ isolation ยืนยัน □ data policy ยืนยัน / □ Blocked
ผู้ตรวจ __________ วันที่ __________ Evidence แบบไม่แสดงค่า __________

## B. อนุมัติสร้าง branch หลัง A ผ่าน

ขอบเขตเสนอ: project ที่ยืนยันจาก A → schema จาก main → **Schema only** → ชื่อ staging-preview → database neondb → QA compute/role ตามที่อนุมัติ คง main เดิม ไม่ copytable data ไม่ reset/deleteexistingbranch

1. Neon Console → Branches → New branch
2. เลือก schema source main และตัวเลือก Schema only ตรวจ project/ชื่อ/ค่าใช้จ่าย **รวม Automatically delete branch after** ก่อนกด Create เอกสาร Neon ปัจจุบันระบุ Console เปิด default 1 day; fixed QA branch ต้องให้ผู้อนุมัติตัดสินใจเอา expiration ออก ไม่สมมติว่า schema-only/root ไม่มี TTL
3. ถ้าชื่อมีอยู่/option ไม่มี/quota ไม่พอให้หยุด ไม่สร้างชื่ออื่นหรือ full-data child แทน
4. หลังสร้างเก็บ branch ID/endpoint mapping แบบ private ไม่เก็บ connectionstring ใน repo ยืนยันไม่มี app rows, ตรวจ schema/roles/extensions และ migration history ด้วยงานที่ได้รับอนุญาต
5. Schema-only เป็น root แยก ไม่ทำ reset-from-parent หรือ restore จาก main เพื่อเติมข้อมูล การทำเช่นนั้นอาจนำข้อมูลเดิมกลับมา

อนุมัติ B: ผู้อนุมัติ __________ วันที่ __________ ขอบเขต/งบ/role __________

## C. อนุมัติเปลี่ยน Preview connection/settings

ใช้ [Environment template](neon-preview-environment-template.md) เป็นรายการ review ก่อนแก้:

- [ ] คง Production scope/integrationmain ไว้ ตรวจอีกครั้งว่า main เป็น staging จริง
- [ ] Preview effective runtime/direct/backup keys ทุกตัวต้องชี้ staging-preview หรือไม่มีค่า fallbackmain
- [ ] ตรวจ automatic per-deployment injection ของ integration ถ้ามีให้ Operator ยืนยันวิธีรองรับ fixedbranch โดยไม่เปลี่ยน main ไม่สมมติว่า manual DATABASE_URL ชนะ injectedvalue เสมอ
- [ ] หากต้องเปลี่ยน Integration Preview scope ให้อนุมัติเป็นรายการเฉพาะ project นี้ ไม่ disconnectintegration ทั้ง project/ลบ globalkeys
- [ ] กำหนด paymentDISABLED/Omisefalse, APP_ENVstaging, seedfalse, QA-onlyEmail/OTPsecret และมาตรการ SMS ตาม scope จริง
- [ ] APP_URL ตรง approvedPrevieworigin ต้องตรวจ branch-specificoverrides ทั้ง DB และ origin

ก่อนอนุมัติ C ให้ inventory Preview deployments เก่าและผลกระทบต่อ PR อื่น fixed branch อาจแชร์ QA DB ระหว่างหลาย Preview และ env snapshot ของ artifact เก่าอาจยังชี้ main ต้องเสนอ access restriction/การจัดการที่อนุมัติแยก ไม่ลบหรือเปลี่ยน artifact เก่าเอง

อนุมัติ C: ผู้อนุมัติ __________ วันที่ __________ Before/After targets (ไม่มีค่า secret) __________

## D. อนุมัติ schema/QA bootstrap แยกจาก Create

- ตรวจ migrationhistory/_prisma_migrations กับ schema จริงก่อน Prisma deploy; schema-only ไม่มี tabledata รวม metadata อย่า mark ทุก migrationapplied โดยไม่เทียบ schema
- ไม่เพิ่ม `prisma migrate deploy`/seed เข้า Vercel Build Command โครงการนี้ Build ไม่มี DBmutation
- ถ้าต้อง initialize schema/migration/QAAdmin หรือ syntheticdata ให้ระบุ exactbranchID/schema/คำสั่ง/ผลคาดหวังและอนุมัติก่อน ห้ามใช้ข้อมูลลูกค้าหรือ Admin จริง
- คำสั่งด้านล่างเป็นตัวอย่างหลังผู้ดูแลสร้าง `.env.preview-qa` ที่ตรวจ target แล้ว และแยก exported DB variables/aliases เดิมไม่ให้ชนะไฟล์ ห้ามใส่ secret ค่าจริงในคำสั่ง/รายงาน:

```sh
node --env-file=.env.preview-qa scripts/staging-diagnostics.mjs
```

คำสั่งนี้ config-only ไม่ต่อ DB/network ไม่พิสูจน์ว่าค่าชี้ branch ถูก อย่ารัน deploy-db/seed/backup/restore เพียงเพราะ diagnostic ผ่าน ผู้ดูแลต้องอนุมัติงานเขียนแต่ละชนิดแยก

อนุมัติ D: ผู้อนุมัติ __________ วันที่ __________ target/schema/commands ที่อนุมัติ __________

## E. อนุมัติ Push → Preview → QA

ก่อน Push ต้อง A–D ที่เกี่ยวข้องผ่าน และมี APP_URL/previewpolicy ที่ review แล้ว:

```sh
git branch --show-current
git rev-parse HEAD
git status --short
git remote -v
git log --oneline origin/main..HEAD
git ls-remote --symref origin HEAD refs/heads/main refs/heads/fix/autonomous-business-security-20261024
```

origin/main เป็น localtracking ที่อาจเก่า ให้เทียบกับ remote refs จริงก่อน ไม่ force/reset ถ้ามี divergence งานผู้ใช้ที่ยังไม่ commit คงไว้; Push HEAD ส่งเฉพาะ commits ไม่ส่งไฟล์ untracked

หลังอนุมัติ E เท่านั้น:

```sh
git push origin HEAD:refs/heads/fix/autonomous-business-security-20261024
```

Pushfeaturebranch โดยปกติได้ Preview เพราะ ProductionBranch=main ไม่อัปเดต URL หลัก ถ้าต้อง firstPreview เพื่อได้ URL จริง ให้ระบุการตั้ง APP_URL/redeploy ใน approval นี้และยังไม่เริ่ม login/OTP/writeQA ก่อน env ถูกและตรวจ DBtarget แล้ว ไม่ใช้ URL เดา

ตรวจ GitHubVercelchecks → projectdesign-villacheck → commitSHA/source/EnvironmentPreview → ตรวจ deployment-injectedDBmapping กับ NeonbranchID → header/health/paymentgate → UAT16 กรณี/อุปกรณ์จริงเฉพาะข้อมูล QA การส่ง OTP จริงไป QAinbox ต้องได้รับอนุมัติแยก ไม่ส่งถึงลูกค้า

อนุมัติ E: ผู้อนุมัติ __________ วันที่ __________ SHA/previewtarget/redeployscope __________

## F. PR → Merge main → Staging Deployment

- ผู้ดูแลเปิด PR จาก featurebranch ไป main ตรวจ diff/tests และ QA evidence พร้อม runtime/direct/backup mapping ของ Productionscope ยังเป็น main/neondb ที่ตรวจแล้ว
- คุณเกมส์รับ BusinessUAT ตามรายการเดิม ไม่อ้างว่าผ่านจาก localtests
- ได้รับอนุมัติ Merge/deploy แยกก่อนทำผ่าน GitHub main จะ triggerProductiondeployment ของ projectstaging ต้องตรวจ CommitSHA และ domain จริง
- ตรวจ https://design-villacheck.vercel.app พร้อม paymentoff/headers/auth/QR/snapshot ไม่มีการนำ NeonPreviewdata กลับ main ไม่มี DBbranchmerge อัตโนมัติ
- villacheckth.com และ productionhosting จริงไม่อยู่ใน approval นี้

อนุมัติ F: ผู้อนุมัติ __________ วันที่ __________ PR/SHA/rolloutwindow __________

## Rollback และ cleanup

1. ก่อน rollout เก็บ previousdeploymentID/SHA/envmapping และแผน DBcompatibility ถ้า artifact เก่าก่อน paymentgate ต้อง Operator คง ingressrestriction/หยุด paymentworkers
2. rollbackapp ผ่าน VercelDashboard โดยผู้มีสิทธิ์/eligibledeployment ตาม environment แล้วตรวจ domain/SHA/payment/auth/QR ไม่ rollbackDB อัตโนมัติ
3. revert ผ่าน PR/GitHubreview เมื่ออนุมัติ ไม่ reset/forcepushmain ไม่ merge ข้อมูล Preview กลับ main เพื่อแก้ approllback
4. Previewdbbranch คงไว้ตรวจ QA ได้ตามนโยบายที่อนุมัติ การ Delete/Reset/Restore/เปลี่ยน retention หรือ compute เป็น mutation ใหม่ต้องอนุมัติเอง ไม่ cleanup อัตโนมัติ
5. ยืนยัน integration ไม่ได้สลับ Production ให้ใช้ Previewbranch โดยไม่ตั้งใจ เก็บ main และ invoice/grant/history เดิมไว้ครบ


## จุดตรวจ auto-delete ที่เพิ่มเติมหลังทบทวนเอกสาร provider

- Console default ของ schema-only อาจกำหนดลบหลัง 1 วัน ต้องตรวจค่าจริงของ branch หากมีอยู่แล้วที่ Branches → staging-preview → Branch Overview/Update expiration ไม่มีการแก้ expiration ในงานตรวจนี้
- Fixed branch ที่ต้องเก็บสำหรับ QA ควรไม่มี expires_at เมื่อได้รับอนุมัติให้ตั้งค่าแล้ว แต่การไม่มี TTL ไม่ปิด integration cleanup อัตโนมัติทุกแบบ
- Vercel-managed preview branches อาจถูกลบเมื่อ deployment สุดท้ายที่สัมพันธ์ถูกลบ รวม retention cleanup; Neon-managed preview branches อาจ cleanup เมื่อ Git branch หายและมี Preview deployment ถัดไป ต้องรู้ชนิด integration และ association จริง
- ไม่ใช้ชื่อ staging-preview หรือ schema-only/root เป็นหลักฐานว่าพ้น cleanup; อย่าลบ deployment/Git branch เพื่อทดสอบ เพราะอาจเป็น trigger ที่ลบ DB
- ไม่พบ workflow ลบ Neon branch ใน source ปัจจุบัน แต่ dashboard/webhooks/automation ภายนอกยังไม่ทราบ ไม่เพิ่ม cleanup workflow หรือตั้งค่า lifetime เอง

แหล่งยืนยัน: [Schema-only](https://neon.com/docs/guides/branching-schema-only), [Branch expiration](https://neon.com/docs/guides/branch-expiration), [Integration cleanup](https://neon.com/docs/guides/vercel-branch-cleanup)
