# Staging Configuration Checklist

ผู้ใช้ยืนยันจาก Dashboard: project `design-villacheck`, repo `devwaygocargo-oss/VillaCheckTH`, Production Branch `main`, URL `design-villacheck.vercel.app` ไม่สร้าง project ใหม่ ดู [Environment Mapping ล่าสุด](vercel-staging-environment-mapping.md) สำหรับค่า non-secret และ DB alias precedence

## Revision / Runtime

- [ ] บันทึก project/team, deployment ID/URL, Git branch และ commit SHA จาก alias ที่เสิร์ฟจริง เทียบ `git rev-parse HEAD` กับ branch `fix/autonomous-business-security-20261024`
- [ ] Dashboard Framework = Next.js, install `npm ci`, build `npm run build`, output `.next`, Node ตาม `.mise.toml`/Dockerfile (24); ตรวจ root directory และ overrides จริง
- [ ] Next API `pages/api/[...route].ts` เรียก compiled Nest backend/Prisma ใน function เดียว `maxDuration=60`; ไม่ rewrite `/api` ไป Render โดยไม่มีแผน routing
- [ ] ไม่ใช้ `scripts/configure-vercel.mjs` รุ่น Vite; guard ใหม่จะปฏิเสธ Next ก่อนแก้ไฟล์
- [ ] ตรวจ app origin HTTPS, cookie HttpOnly/Secure/SameSite, CSRF/origin และ security headers บน deployment จริง

## Environment — ชื่อและความจำเป็นเท่านั้น

ทราบชื่อกลุ่ม integration/scopes ตามที่ผู้ใช้แจ้ง แต่ effective host values และ DB isolation ยังไม่ตรวจยืนยัน ตารางนี้เป็นข้อกำหนด ไม่ใช่หลักฐานว่าตั้งครบแล้ว

| ชื่อ | จำเป็น/การใช้งาน |
|---|---|
| `NODE_ENV`, `APP_ENV`, `APP_URL` | จำเป็น; APP_ENV staging และ APP_URL เป็น origin staging ที่เสิร์ฟจริง |
| `DATABASE_URL` หรือ `VillaCheck_DATABASE_URL` | จำเป็น; staging PostgreSQL แยก ห้าม aliases ชี้ต่างฐานโดยไม่ตั้งใจ |
| `DIRECT_URL` | จำเป็นตาม migration topology; direct session สำหรับ migration; fallback aliases เดิมต้องตรวจให้ครบ |
| `OTP_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM` | จำเป็นสำหรับ Email OTP จริง; sender/TLS ตาม provider |
| `SMTP_USER`, `SMTP_PASSWORD` | ตามผู้ให้บริการ SMTP |
| `STAGING_EMAIL_ALLOWLIST` | จำเป็น staging; exact test inbox เท่านั้น ว่างต้องส่งไม่ได้ |
| `PAYMENT_ACCESS_MODE` | จำเป็นต้องกำหนดและตรวจว่า DISABLED |
| `OMISE_TEST_ENABLED` | จำเป็นต้องปิดใน Phase 1 |
| `OMISE_TEST_PUBLIC_KEY`, `OMISE_TEST_SECRET_KEY`, `OMISE_TEST_METHODS` | ไม่จำเป็น Phase 1; ไม่ใช้ Live keys |
| `DEMO_MODE`, `SEED_DEMO_ACCOUNTS`, `SEED_PUBLIC_DEMO_DATA` | ต้องตรวจว่าปิดสำหรับ release QA; CMS demo เดิมต้อง inventory แยก ไม่ลบข้อมูลเอง |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | เฉพาะ bootstrap เมื่อยังไม่มี Admin; ไม่ reset บัญชีจริง |
| `CRON_SECRET`, `PUBLIC_URL`, `ALERT_WEBHOOK_URL` | จำเป็นตาม cron/monitoring ที่เปิดใช้; PUBLIC_URL ชี้ staging ชัดเจน |
| `BACKUP_DATABASE_URL`, `BACKUP_SECRET`, `BACKUP_DIR`, `BACKUP_SCHEMA`, `BACKUP_RETENTION_DAYS` | ตาม backup topology แยก target/สิทธิ์/ที่เก็บนอก host |
| `BACKEND_HOST`, `BACKEND_PORT` | เฉพาะ standalone/Render ไม่สมมติว่า Render เชื่อมกับ Vercel |
| OAuth/SMS credentials เดิม | ไม่จำเป็นสำหรับ password+Email OTP Phase 1; ปิดถ้ายังไม่ตรวจรับ |

Environment scope ของ Vercel (Preview/Production/custom) ต้องตรง deployment ที่ alias ใช้ คำว่า Production ใน project staging ของ Vercelไม่ใช่ production hosting ของบริษัท ต้องให้ Operator ยืนยัน target ก่อนเลือก flags ใด ๆ

## หลัง Deploy ที่ได้รับอนุญาต

- [ ] `/api/config` ต้อง paymentConfigured=false และไม่แสดง bank/QR/instructions ใน Owner DTO/UI/worker
- [ ] HEAD/deployment SHA ตรง, headers ครบ, health 200, packages 401 เมื่อไม่ login
- [ ] ลงชื่อผู้ตรวจ/เวลา/หลักฐาน DB isolation, migration, SMTP/OTP และ UAT แยกกัน ไม่ใช้ health แทนทั้งหมด

## การอัปเดตผ่าน GitHub

ใช้ [GitHub → Vercel](github-vercel-staging-deployment.md) แทนการ deploy ด้วย CLI ต้องตรวจ Connected Repository/Branch Tracking/Domain/env ก่อน Push ผู้ใช้ยืนยันใช้ origin และ Production Branch=main แล้ว ส่วน DB/payment/Preview scopes ยังต้องตรวจ ไม่เปลี่ยน branch configuration ในงานนี้
