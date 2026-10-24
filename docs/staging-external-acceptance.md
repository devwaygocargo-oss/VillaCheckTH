# Staging / External Integration Acceptance

การเตรียม Phase 3 ไม่ใช่หลักฐานว่า Omise หรือ SMTP จริงผ่านแล้ว รายการด้านล่างให้ผู้ดูแลทำบน staging แยกและผู้รับทดสอบที่อนุญาตเท่านั้น

## Environment Variables — ชื่อเท่านั้น

| ขอบเขต | ชื่อที่ต้องตั้ง/ตรวจ |
|---|---|
| App/runtime | `APP_ENV`, `NODE_ENV`, `APP_URL`, `DATABASE_URL`, `DIRECT_URL`, `BACKEND_HOST`, `BACKEND_PORT` |
| Payment gate | `PAYMENT_ACCESS_MODE`, `OMISE_TEST_ENABLED` |
| Omise Test | `OMISE_TEST_PUBLIC_KEY`, `OMISE_TEST_SECRET_KEY`, `OMISE_TEST_METHODS` |
| Email OTP | `OTP_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `STAGING_EMAIL_ALLOWLIST` |
| Initial Admin | `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
| Operations | `CRON_SECRET`, `PUBLIC_URL`, `ALERT_WEBHOOK_URL` |
| Backup | `BACKUP_DATABASE_URL`, `BACKUP_SECRET`, `BACKUP_DIR`, `BACKUP_RETENTION_DAYS`, `BACKUP_SCHEMA` |
| Demo controls | `DEMO_MODE`, `SEED_DEMO_ACCOUNTS`, `SEED_PUBLIC_DEMO_DATA`, `DEMO_PASSWORD` |
| Optional OAuth/SMS | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_GRAPH_VERSION`, `FACEBOOK_LOGIN_ENABLED`, `THAIBULKSMS_API_KEY`, `THAIBULKSMS_API_SECRET`, `THAIBULKSMS_EMAIL_OTP_TEMPLATE_ID`, `THAIBULKSMS_OTP_KEY`, `THAIBULKSMS_OTP_SECRET`, `THAIBULKSMS_SENDER` |

ค่าจริงให้เก็บใน private host settings/secret manager เท่านั้น ห้ามใส่ secret ใน NEXT_PUBLIC/VITE ไม่มี Omise Live key ที่ต้องตั้งใน revision นี้ ตัวตรวจ `scripts/staging-diagnostics.mjs` แสดงชื่อและ configured boolean ไม่แสดงค่า/URL

## Omise Test — ผู้ดูแล Omise + QA

- [ ] ยืนยัน Test account, public/secret key pair และ methods ที่เปิดใน account ตรงกับรายการ staging
- [ ] สร้าง source จริงจาก UI ด้วยยอด invoice และสร้าง charge เพียงหนึ่งครั้งเมื่อกดซ้ำ
- [ ] PromptPay Test QR แสดงจาก charge ที่ตรง invoice ไม่สแกนด้วยแอปธนาคารจริง; จำลอง success/failure ผ่าน Test Dashboard
- [ ] QR Test browser return ที่ staging host จริง ตรวจ allowlisted URL; ทดสอบ refresh/กลับเข้า invoice เดิมทั้งก่อนและหลัง callback
- [ ] pending, successful, failed, expired และ reversed ตาม capability ของ account พร้อมหลักฐาน provider ที่ปกปิดแล้ว หาก account ไม่รองรับ scenario ให้บันทึกขอบเขตและวิธีที่ provider แนะนำ
- [ ] Replay/duplicate/reordered/early webhook ที่ host จริง ผลไม่เพิ่มวัน/payments ซ้ำ ไม่เชื่อ payload หรือ URL success claim
- [ ] Provider timeout/charge creation ambiguous: คง attempt เดิมและกระทบยอดจาก ref_id ไม่สร้างรายการเดาใหม่
- [ ] จ่ายสำเร็จยังรอ Admin approval ของ Villa และ QR เปลี่ยนตาม revision หลังอนุมัติ
- [ ] ยืนยัน external redirect/QR download host/path รูปแบบจริงตรงกับ allowlist ใน code หาก provider เปลี่ยนรูปแบบให้แก้พร้อม tests ไม่เปิดรับ arbitrary URL
- [ ] legacy manual endpoints ถูกปิดเมื่อ mode ที่ใช้เป็น OMISE_TEST; ประวัติ manual ยังอยู่และไม่ถูกแปลงเป็น charge ใหม่

ผล: [ ] Pass [ ] Fail [ ] Blocked ผู้ตรวจ/วันที่/revision/evidence: __________

## SMTP / Email OTP — ผู้ดูแล Email + QA

- [ ] ตั้ง APP_ENV เป็น staging และ allowlist เฉพาะ mailbox ของทีม; ทดสอบนอก list ต้องถูกปฏิเสธก่อนส่ง ทั้ง SMTP และ Email OTP API
- [ ] ใช้ diagnostic verify-only ทดสอบ DNS/connect/auth/TLS โดยไม่ส่งเมล ตรวจ diagnostic ไม่มี secret/provider raw text
- [ ] ส่ง OTP จาก flow สมัครจริงให้ mailbox ที่อนุญาต ตรวจ Inbox/Spam และเนื้อหา/เวลา ไม่ส่งให้ลูกค้า
- [ ] ก่อน OTP ยังไม่มีบัญชี/session, ผิดรหัส/หมดอายุ/replay/ขอใหม่/เปิดหลาย tab และจำกัด destination/IP ทำงานถูกต้อง
- [ ] ขัดข้อง SMTP/provider ต้องแจ้งข้อความที่ปลอดภัย ไม่สร้างบัญชีใช้งานได้เอง และไม่มี OTP/token ใน logs
- [ ] ตรวจ SPF/DKIM/DMARC, sender ownership และ provider quota บน domain จริง; connection verified ไม่เท่ากับ Inbox acceptance
- [ ] ใช้ SMTP สำหรับ smoke acceptance ก่อน หากเปิด ThaiBulkSMS template ต้องตรวจ provider/allowlist/credentials ของช่องทางนั้นแยก SMS ยังต้องอนุมัติผู้รับและวิธีทดสอบก่อนเปิด keys

ผล: [ ] Pass [ ] Fail [ ] Blocked ผู้ตรวจ/วันที่/evidence: __________

## Host / backup / business — operator + คุณเกมส์

- [ ] HTTPS/certificate/headers/Secure cookie และ origin/host ตรงกัน; preview ไม่ชี้ production DB
- [ ] Vercel/Render topology ที่เลือกทำงานจริง และ quota หลัง ingress ไม่ปฏิเสธผู้ใช้รวมโดยไม่ตั้งใจ
- [ ] Backup นอก host, migration rehearsal, restore บน DB ใหม่และ app rollback ภายใต้ payment restriction ผ่านแล้ว
- [ ] Monitoring ส่ง alert ถึงทีมจริงโดยไม่เปิดเผยข้อมูลส่วนตัว; cron/outbox lag ตรวจได้
- [ ] ตัดสินใจ BL-01/02/05/06/07 และคุณเกมส์ทำ [Business UAT](business-uat-checklist.md) ตามขอบเขตที่เปิด
- [ ] Owner notification ต้องมีผู้รับ/ช่องทาง/หลักฐานส่งจริง; private outbox ยังไม่ใช่ delivery receipt

ผล: [ ] Pass [ ] Fail [ ] Blocked ผู้ตรวจ/วันที่/evidence: __________

เอกสาร provider ที่ตรวจประกอบ implementation: [Omise.js](https://docs.omise.co/omise-js), [Charges API](https://docs.omise.co/charges-api), [PromptPay](https://docs.omise.co/promptpay) ลิงก์เหล่านี้ไม่ใช่หลักฐานว่า account ของ VillaCheck ผ่านการตรวจรับ
