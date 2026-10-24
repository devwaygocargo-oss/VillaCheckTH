# Checklist ก่อนเปิด Production — 31 ตุลาคม 2026

วันที่ตรวจ source/local: 24 ตุลาคม 2026 · Branch `fix/autonomous-business-security-20261024`

ช่อง `[ ]` คือยังต้องตรวจ/ลงนามบน staging หรือ host จริง ไม่ใช่ผลผ่านจากการเห็น config ใน repository ห้ามนำค่า secrets หรือข้อมูลลูกค้ามาแนบหลักฐาน

## Environment Variables

สถานะ local ตรวจจาก `.env` โดยรายงานเฉพาะชื่อและการมีค่า ไม่ได้เปิด connection ไปยัง DB ที่ระบุไว้ Production ทุกชื่อ **ยังไม่ยืนยันจาก host** ตารางเต็มพร้อมสถานะ local อยู่ใน [source-config-audit.json](validation/phase2/source-config-audit.json)

| ชื่อ | จำเป็นหรือไม่ | สถานะ local | Production |
|---|---|---|---|
| DATABASE_URL | จำเป็น (หรือ VillaCheck_DATABASE_URL) | พบการตั้งค่า | ยังไม่ยืนยัน |
| DIRECT_URL | จำเป็นตอน migration | ไม่พบค่า | ยังไม่ยืนยัน |
| APP_URL | จำเป็น HTTPS | พบการตั้งค่า | ยังไม่ยืนยัน |
| NODE_ENV | จำเป็น production | ไม่พบค่า | ยังไม่ยืนยัน |
| OTP_SECRET | จำเป็นสำหรับ OTP | พบการตั้งค่า | ยังไม่ยืนยัน |
| SMTP_HOST | จำเป็นเมื่อใช้ SMTP OTP | พบการตั้งค่า | ยังไม่ยืนยัน |
| SMTP_PORT | จำเป็นเมื่อใช้ SMTP | พบการตั้งค่า | ยังไม่ยืนยัน |
| SMTP_SECURE | จำเป็นเมื่อใช้ SMTP | พบการตั้งค่า | ยังไม่ยืนยัน |
| SMTP_USER | ตามผู้ให้บริการ SMTP | พบการตั้งค่า | ยังไม่ยืนยัน |
| SMTP_PASSWORD | ตามผู้ให้บริการ SMTP | ไม่พบค่า | ยังไม่ยืนยัน |
| SMTP_FROM | จำเป็นเมื่อใช้ SMTP | พบการตั้งค่า | ยังไม่ยืนยัน |
| OMISE_TEST_ENABLED | จำเป็นต้องปิดใน production ปัจจุบัน | ไม่พบค่า | ยังไม่ยืนยัน |
| OMISE_TEST_SECRET_KEY | จำเป็นเฉพาะทดสอบ Omise | ไม่พบค่า | ยังไม่ยืนยัน |
| CRON_SECRET | จำเป็นสำหรับ scheduled worker | ไม่พบค่า | ยังไม่ยืนยัน |
| ADMIN_EMAIL | จำเป็นเฉพาะ bootstrap Admin | พบการตั้งค่า | ยังไม่ยืนยัน |
| ADMIN_PASSWORD | จำเป็นเฉพาะ bootstrap Admin | ไม่พบค่า | ยังไม่ยืนยัน |
| SEED_DEMO_ACCOUNTS | จำเป็นต้องปิด | พบการตั้งค่า | ยังไม่ยืนยัน |
| SEED_PUBLIC_DEMO_DATA | จำเป็นต้องปิด | ไม่พบค่า | ยังไม่ยืนยัน |
| DEMO_MODE | จำเป็นต้องปิด และตรวจ DB setting | ไม่พบค่า | ยังไม่ยืนยัน |
| COOKIE_SECURE | production บังคับ Secure อยู่แล้ว | ไม่พบค่า | ยังไม่ยืนยัน |
| BACKUP_SECRET | จำเป็นสำหรับ encrypted backup | ไม่พบค่า | ยังไม่ยืนยัน |
| BACKUP_DATABASE_URL | จำเป็นสำหรับ scheduled backup; manual มี fallback | ไม่พบค่า | ยังไม่ยืนยัน |
| GOOGLE_CLIENT_ID | เฉพาะเปิด Google Login | พบการตั้งค่า | ยังไม่ยืนยัน |
| GOOGLE_CLIENT_SECRET | เฉพาะเปิด Google Login | พบการตั้งค่า | ยังไม่ยืนยัน |
| LINE_CHANNEL_ID | เฉพาะเปิด LINE Login | พบการตั้งค่า | ยังไม่ยืนยัน |
| LINE_CHANNEL_SECRET | เฉพาะเปิด LINE Login | พบการตั้งค่า | ยังไม่ยืนยัน |
| FACEBOOK_APP_ID | เฉพาะเปิด Facebook Login | ไม่พบค่า | ยังไม่ยืนยัน |
| FACEBOOK_APP_SECRET | เฉพาะเปิด Facebook Login | ไม่พบค่า | ยังไม่ยืนยัน |
| FACEBOOK_LOGIN_ENABLED | เฉพาะเปิด Facebook Login | ไม่พบค่า | ยังไม่ยืนยัน |
| THAIBULKSMS_API_KEY | เฉพาะเลือก ThaiBulkSMS | ไม่พบค่า | ยังไม่ยืนยัน |
| THAIBULKSMS_API_SECRET | เฉพาะเลือก ThaiBulkSMS | ไม่พบค่า | ยังไม่ยืนยัน |
| THAIBULKSMS_EMAIL_OTP_TEMPLATE_ID | เฉพาะ Email OTP provider | พบการตั้งค่า | ยังไม่ยืนยัน |
| THAIBULKSMS_OTP_KEY | เฉพาะ SMS OTP provider | พบการตั้งค่า | ยังไม่ยืนยัน |
| THAIBULKSMS_OTP_SECRET | เฉพาะ SMS OTP provider | พบการตั้งค่า | ยังไม่ยืนยัน |
| THAIBULKSMS_SENDER | เฉพาะ SMS API | ไม่พบค่า | ยังไม่ยืนยัน |
| ALERT_WEBHOOK_URL | เฉพาะเปิดแจ้งเตือน monitoring | ไม่พบค่า | ยังไม่ยืนยัน |
| PUBLIC_URL | จำเป็นเมื่อรัน health/operations probe กับ host ที่เลือก | ไม่พบค่า | ยังไม่ยืนยัน |
| BACKUP_DIR | จำเป็นเมื่อใช้ scheduled backup | ไม่พบค่า | ยังไม่ยืนยัน |
| BACKUP_RETENTION_DAYS | จำเป็นต้องกำหนดนโยบาย retention | ไม่พบค่า | ยังไม่ยืนยัน |
| BACKUP_SCHEMA | ตัวเลือกเมื่อใช้ schema แยก | ไม่พบค่า | ยังไม่ยืนยัน |
| BACKEND_HOST | จำเป็นตาม topology backend | ไม่พบค่า | ยังไม่ยืนยัน |
| BACKEND_PORT | จำเป็นตาม topology backend | พบการตั้งค่า | ยังไม่ยืนยัน |
| FACEBOOK_GRAPH_VERSION | เฉพาะเปิด Facebook Login | ไม่พบค่า | ยังไม่ยืนยัน |
| DATABASE_URL_UNPOOLED | ตัวเลือก direct migration | ไม่พบค่า | ยังไม่ยืนยัน |
| VillaCheck_DATABASE_URL | ตัวเลือกแทน DATABASE_URL | ไม่พบค่า | ยังไม่ยืนยัน |

- [ ] ตรวจว่าไม่มี secret อยู่ใน `NEXT_PUBLIC_*`, `VITE_*`, client bundle หรือ build logs
- [ ] `NODE_ENV` เป็น production, `APP_URL` เป็น origin HTTPS ที่ใช้งานจริง, cookie Secure; ทดสอบแยก Admin/Public session
- [ ] ปิด seed flags และตรวจ DB setting `demo_mode`/ข้อมูล demo จริงด้วย แค่ env ปิดไม่ลบข้อมูลเดิม
- [ ] ยืนยัน Admin bootstrap ใช้เฉพาะครั้งจำเป็น; env password ไม่เปลี่ยนรหัส Admin เดิม อนุมัติ rotation แยก

## Database / migration / seed

- [x] Build script ไม่เรียก migration/seed; migration tests ใช้ DB แยกและตรวจ preservation/เรียกซ้ำ
- [ ] runtime URL ใช้ PostgreSQL ที่เปิด TLS ตรวจใบรับรองและสิทธิ์ตามผู้ให้บริการจริง; ไม่มีการพิสูจน์ TLS ของ production ใน local test
- [ ] แยก runtime user กับ migration user, pooled runtime/direct migration, ประเมิน max pool 5 ต่อ instance กับจำนวน instance
- [ ] operator ทำ backup ก่อน `npm run db:deploy`; ตรวจ baseline ฐานเก่าให้ครบ ไม่ถือว่ามีชื่อตารางครบแล้ว schema ทุกช่องถูกต้อง
- [ ] rehearsal migration บนสำเนาข้อมูลที่ปกปิดแล้ว ตรวจจำนวน invoice/payment/QR/เอกสารก่อนและหลัง
- [ ] ห้าม migrate reset/db push/แก้ migration ที่เคย deploy; rollback schema ต้องวางแผน forward fix/restore ที่เข้ากับ app revision
- [ ] ใช้ Next → Nest → Prisma ตาม deployment หลัก; legacy `server/postgres.mjs` ยังเตรียม schema/backfill/catalog เมื่อ open จึงต้องตรวจสิทธิ์และผลก่อนเปิด adapter นี้ ไม่เหมารวมว่า runtime ทุกแบบ read-only
- [ ] ไม่มี `db:seed`/`demo:seed-public` ใน release command; production guard ตรวจ local demo หลักสามบัญชี ไม่ครอบคลุม try-* หรือ demo fixtures ทุกชนิด

## Payment / Email / notifications

- [x] Test adapter ปฏิเสธ live keys; zero-net Basic ไม่เรียก gateway; mock ตรวจ server amount, owner, webhook retrieval, duplicate และ approval แยก
- [ ] ทำ provider acceptance GL-01; webhook `POST /api/webhooks/omise` ต้องเข้าถึงผ่าน HTTPS และไม่ redirect ไป login
- [ ] ตรวจ success/failure/pending/reversal, duplicate/reordered/early webhook และ outage/UNKNOWN บน provider จริง; reconciliation ไม่เพิ่มวันซ้ำ
- [ ] ตรวจ payment restrictions ฝั่ง server ก่อนเปิดแบบจำกัด ไม่พึ่งซ่อนปุ่ม และไม่ใช้ test mode รับเงินลูกค้า
- [ ] SMTP TLS/credentials/ผู้ส่ง/DKIM/SPF/DMARC ตามบริการจริง; ยืนยัน Inbox/Spam และ timeout โดยผู้รับทดสอบที่อนุญาต
- [ ] OTP provider quota/expiry/replay/rate policy และ OAuth callbacks/consent ตรวจบน domain จริง
- [ ] ระบุ Owner recipient/channel; outbox PENDING_DELIVERY ไม่ใช่ delivery receipt
- [ ] ตั้ง `CRON_SECRET`, ตรวจ scheduled run และ retry mail จริง ตาราง Vercel 02:00 UTC เป็นรอบรายวัน ไม่ใช่ SLA ส่งทันที

## HTTP / security / monitoring

- [x] local Next production HTTP ตรวจ security headers และ Secure cookie ผ่าน automated test
- [ ] ตรวจ HTTPS redirect/certificate/security headers ที่ custom domain/CDN จริง รวม HSTS policy; source CSP ตอนนี้มี frame/object/base protection ไม่ใช่ script-src policy เต็มรูปแบบ
- [x] การปลอม forwarding headers นอก Vercel ไม่รีเซ็ต quota; checks ใช้ quota ต่อบัญชี
- [ ] Vercel platform ต้อง overwrite header จริง; Render/standalone ใช้ socket IP อาจรวม quota หลายคน ต้องทดสอบ ingress ที่เลือกก่อนเปิด auth
- [ ] ทดสอบ CSRF/origin/logout/expiry/account suspension และ Admin reviewer policy บน staging
- [ ] ยืนยันสิทธิ์ Admin ที่จะแจกจริง ปัจจุบันไม่มี RBAC ราย action ทั้งระบบ
- [ ] ตั้ง error/uptime monitoring, alert ผู้รับผิดชอบ, request correlation และทดลองแจ้งเตือน 5xx/DB outage/mail backlog/webhook failure โดยไม่บันทึก secrets/OTP/เอกสาร/เลขบัญชี
- [x] SMTP/ThaiBulkSMS diagnostic ไม่เก็บ free-text provider message; Phase 2 เพิ่ม regression อีเมล/OTP/opaque token ที่ provider echo กลับมา
- [ ] ตรวจ access/retention ของ diagnostics และ log collector บน host จริง
- [ ] ตั้ง retention/access สำหรับ audits, user checks (มีข้อมูลที่กรอก), private documents, approved snapshots และ backup; ตรวจ storage growth

## Vercel / backend / backup / rollback

- [x] `vercel.json` ใช้ `npm ci`/`npm run build`, API no-store, maxDuration 60; `Dockerfile` build backend แยกและไม่ migrate อัตโนมัติ
- [ ] ตรวจ environment scope production/preview และ deploy branch protection; ไม่มีการ deploy ใน session นี้
- [ ] Render ยังต้องเพิ่ม env ที่จำเป็นจากตารางตามฟังก์ชัน; render.yaml ไม่ใช่หลักฐานว่าตั้ง SMTP/OTP/cron/provider แล้ว
- [ ] health check `/api/health` เป็น liveness ของ handler ไม่ใช่การยืนยัน DB/provider พร้อมทุกตัว ต้องมี synthetic/readiness monitor ที่ตรวจจริงโดยไม่ทำธุรกรรม
- [x] encrypted backup/restore ทดสอบบน disposable PostgreSQL: consistent snapshot, binary rows, restore empty target, ไม่ restore sessions
- [ ] ตั้ง `BACKUP_DATABASE_URL`, `BACKUP_SECRET`, `BACKUP_DIR`, `BACKUP_RETENTION_DAYS`, scheduler นอก ephemeral Vercel filesystem และ replicate ไป storage แยกสิทธิ์
- [ ] กู้คืนบน DB ใหม่จริงใน staging จับเวลา ยืนยัน RPO/RTO, key custody และ on-call owner; provider PITR/retention ยังไม่ยืนยัน
- [ ] บันทึก previous app artifact/revision และวิธี rollback app; หาก schema เปลี่ยนให้ตรวจ compatibility ก่อน rollback อย่า restore ทับฐานที่มีธุรกรรมใหม่โดยไม่กระทบยอด
- [ ] ก่อนปล่อย 31 ต.ค. คุณเกมส์ลงนาม UAT, operator แนบหลักฐานด้าน host, การเงินตรวจ provider; หากยังไม่ครบใช้สถานะ NOT READY และเลื่อน flow ที่เกี่ยวข้อง

## ข้อกำหนดเจ้าของล่าสุด — 24 ตุลาคม 2026

- [ ] ตรวจราคาเต็มบน host เทียบ catalog จริง; launch ระดับ 1–2 ลด 100%, ระดับ 3–4 ลด 80% โดยไม่เปลี่ยน invoice/grant เดิม
- [ ] ใช้ `OMISE_TEST_METHODS=promptpay` เท่านั้นใน staging; คง payment gate ปิดเงินจริง
- [ ] UAT QR เก่า/ใหม่และ approved snapshot ระหว่าง pending รวมรูป/ข้อมูลตรวจเทียบและการระงับสิทธิ์
- [ ] ยังปิด activation ฟรีระดับ 2 และ settlement Upgrade/Downgrade จนรายละเอียดใน [Pending Decisions](pending-business-decisions.md) ครบ
- [ ] Email/In-App outbox ยังรอผู้รับและ worker; ห้ามถือการมีแถว outbox เป็นหลักฐานส่งถึง
- [ ] ไม่เผยแพร่คำรับประกันระดับ 3–4 ก่อนอนุมัติเงื่อนไข

ผลปรับและหลักฐานล่าสุด: [business-logic-update-2026-10-24.md](business-logic-update-2026-10-24.md) ไม่เปลี่ยนสถานะ NOT READY ของการเปิดรับเงินจริง
