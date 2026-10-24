# Checklist เตรียม Staging สำหรับ Phase 1

ยังไม่ได้ deploy staging/production เอกสารนี้ให้ Operator ทำหลังได้รับอนุญาต เลือก revision ตาม [session-files.json](validation/phase1-release/session-files.json) และตรวจ HEAD จริงก่อนส่ง source

## 1. Target และ topology

- [ ] ใช้ project/domain/database/staging mailboxes แยก production; preview ห้ามได้รับ production DB URL หรือ credentials
- [ ] Vercel: Next frontend + API adapter เรียก Nest/Prisma ภายใน function เดียว ตาม `vercel.json` และ `pages/api/[...route].ts`
- [ ] Render: เป็น Nest backend แยก ตาม `render.yaml`/Dockerfile ไม่ได้ถูก Next เรียกอัตโนมัติ Browser API ปัจจุบัน same-origin `/api` ถ้าจะใช้ Render ต้องยืนยัน routing/ingress จริงก่อน ไม่สร้าง architecture ใหม่ในงานนี้
- [ ] ตรวจ DB TLS/pool/runtime role และ direct migration role, HTTPS APP_URL/cookie/host/CORS; ห้ามใช้ `prisma db push`, reset หรือสั่งล้างข้อมูล
- [ ] ตรวจ `.vercelignore`/`.dockerignore` ป้องกัน `.env*`, credentials, `.git`, local artifacts และรายงานลูกค้าเข้า upload context

## 2. Environment ที่ต้องตั้ง (แสดงเฉพาะชื่อ)

| ชื่อ | จำเป็นหรือไม่ | จุดตรวจ |
|---|---|---|
| `NODE_ENV`, `APP_ENV`, `APP_URL` | จำเป็น | runtime/host/staging boundary และ HTTPS |
| `DATABASE_URL` | จำเป็น | PostgreSQL staging แยก; alias เดิม `VillaCheck_DATABASE_URL` ใช้แทนได้แต่ต้องไม่มีค่าขัดกัน |
| `DIRECT_URL` | ตาม topology migration | direct session ไม่ใช้ transaction pooler; fallback aliases ให้ตรวจคู่มือเดิม |
| `OTP_SECRET` | จำเป็นสำหรับ Email OTP | secret manager; ไม่แสดงค่าหรือใส่ใน frontend |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM` | จำเป็นสำหรับส่ง OTP จริง | sender/TLS/port ตามผู้ให้บริการ |
| `SMTP_USER`, `SMTP_PASSWORD` | ตามผู้ให้บริการ | credentials staging เท่านั้น |
| `STAGING_EMAIL_ALLOWLIST` | จำเป็นใน staging | exact mailbox ที่ได้รับอนุญาต; ว่างต้องส่งไม่ได้ |
| `PAYMENT_ACCESS_MODE` | จำเป็นใน release checklist | ต้อง DISABLED; production runtime มี default ปิด แต่ยังต้องตรวจ env จริง |
| `OMISE_TEST_ENABLED` | จำเป็นใน release checklist | ต้องปิดใน Phase 1 |
| `OMISE_TEST_PUBLIC_KEY`, `OMISE_TEST_SECRET_KEY`, `OMISE_TEST_METHODS` | ไม่จำเป็น Phase 1 | ไม่ตั้ง keys บน Phase 1; ไม่มี Live mode |
| `SEED_DEMO_ACCOUNTS`, `SEED_PUBLIC_DEMO_DATA`, `DEMO_MODE` | จำเป็นต้องตรวจว่าปิด | ไม่ seed/build demo หรือสร้างผู้ใช้ demo บน production |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | จำเป็นเฉพาะ bootstrap เมื่อยังไม่มี Admin | ใช้บัญชีผู้ดูแลที่กำหนด ไม่ reset ของเดิมอัตโนมัติ |
| `CRON_SECRET` | จำเป็นถ้าเปิด cron | private authorization; ตรวจ worker ไม่ส่ง payment instructions |
| `BACKUP_DATABASE_URL`, `BACKUP_SECRET`, `BACKUP_DIR`, `BACKUP_RETENTION_DAYS` | จำเป็นตาม backup topology | ตรวจ target/การเข้ารหัส/นอก host/retention |
| `PUBLIC_URL`, `ALERT_WEBHOOK_URL` | จำเป็นสำหรับ health/alert ที่เลือกใช้ | ระบุ staging URL ทุกครั้ง ไม่ใช้ host default; alert เป็นปลายทางอนุมัติ |
| `BACKEND_PORT`, `BACKEND_HOST` | ตาม standalone/Render | port/bind ตาม host และ ingress |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ไม่จำเป็นสำหรับ password+Email OTP | ปิด OAuth หากยังไม่ตรวจรับ callback/provider |

ตารางนี้เป็น requirement inventory ไม่อ้างว่าได้อ่านค่าบน host; diagnostics ค่าเริ่มต้นแสดง configured boolean เท่านั้น

## 3. คำสั่งก่อนส่ง artifact

ใช้ clean checkout ที่ไม่มี production env ปะปน เลือก Node ตามโครงการ/lockfile ตรวจ exported variables เดิมด้วย secret manager โดยไม่พิมพ์ค่า ล้าง DB aliases เดิมตามคู่มือ staging ก่อนโหลด `.env.staging`

```sh
npm ci
npm run typecheck
npm run lint
npm run build
node --env-file=.env.staging scripts/staging-diagnostics.mjs
```

Build ไม่มี migration/seed คำสั่งต่อไปนี้ทำเฉพาะหลัง Operator ยืนยัน DB staging แล้ว:

```sh
node --env-file=.env.staging scripts/deploy-db.mjs
node --env-file=.env.staging scripts/application-backup.mjs backup /path/to/protected/staging-before.vcb
```

DB ใหม่ต้อง migrate ก่อน backup; DB เดิมต้อง backup ก่อน migrate ไม่มี migration ใหม่ในรอบนี้ แต่ deploy script เดิมอาจ baseline/migrate จึงต้องตรวจ target และ schema อย่างละเอียด

## 4. ส่ง staging และตรวจภายนอก

ให้ Operator ใช้ขั้นตอน [คู่มือ staging เดิม](staging-deployment-guide.md) เลือก project staging ก่อน deploy ห้าม production flag/promote ในขั้นตอนนี้ ไม่มีคำสั่ง deploy ถูกรันใน session นี้

- [ ] Health บน staging ด้วย `PUBLIC_URL` ที่ยืนยันแล้ว และดู `/api/health`, public CMS/listing, packages 401 เมื่อไม่ล็อกอิน
- [ ] `node --env-file=.env.staging scripts/staging-diagnostics.mjs --verify-smtp` ตรวจ connection เท่านั้น ไม่แทน inbox acceptance
- [ ] สมัครผ่าน UI ด้วย allowlisted mailbox รับ OTP จริง; ตรวจ Inbox/Spam, wrong/expired/replay/resend และ refresh/session/logout
- [ ] ทำ Owner/Admin/Public/QR journeys ตาม UAT รวมรูปปก/gallery ที่รอ/ถูกปฏิเสธ/นำออก
- [ ] ใช้บัญชี Owner/Admin ทดสอบตรง API ว่า invoice ใหม่/proof/slip/confirm/approve/Omise/payment QR ปิด แม้มี bank config เดิม; old history ยังอ่านได้ ไม่มี bank instructions/QR ใน DTO/UI/worker
- [ ] ตรวจ HTTPS cookies/headers, proxy rate limit, safe errors/logs, demo accounts/records และ cached artifacts
- [ ] ทำ backup/restore drill + monitoring/cron/rollback ด้วย staging target และบันทึก revision/operator/time/evidence
- [ ] คุณเกมส์ลงนาม Phase 1 UAT; เก็บผลอุปกรณ์จริงก่อนพิจารณา production โดยกระบวนการอนุมัติแยก
