# หลักฐานทดสอบ Phase 1

รอบ 24 ตุลาคม 2026 ใช้ localhost และข้อมูลสมมติเท่านั้น ผล machine-readable อยู่ใน [checks.json](validation/phase1-release/checks.json)

| คำสั่ง | ขอบเขต | ผล |
|---|---|---|
| `npm run test:backend` | SQLite compatibility ชุดเดียวกับ PostgreSQL | 253 ผ่าน / 0 ล้มเหลว / 8 ข้าม |
| `node scripts/test-postgres.mjs --phase1-browser` | PostgreSQL ชั่วคราว, Prisma/Nest/Next/Vercel adapter, migration/backup/restore และ Chrome | 261 ผ่าน / 0 ล้มเหลว / 0 ข้าม; browser ดู JSON ที่ลิงก์ด้านล่าง |
| `npm run build` | Prisma generate, backend compilation, Next production build | ผ่าน |
| `npm run typecheck` | frontend/backend TypeScript | ผ่าน |
| `npm run lint` | ESLint 0 warnings | ผ่าน |
| `git diff --check` | whitespace/conflict patch checks | ผ่าน |

8 รายการข้ามบน SQLite ต้องใช้ PostgreSQL รวม bootstrap/migration/backup/adapter จึงตรวจใน PostgreSQL ครบแล้ว ไม่บวกจำนวนสองฐานเป็นคนละชุดใหม่ การสำรอง/restore ใช้ schema ว่างเฉพาะทดสอบ ไม่ใช้ production

## Journey และหลักฐานพฤติกรรมจริง

| Journey | หลักฐาน | สิ่งที่ยืนยัน |
|---|---|---|
| A สมัคร→OTP→Owner→Villa→Upload→Submit | `phase2-journey.test.mjs`, `password-registration.test.mjs` | HTTP server จริง + DB จริง; SMTP transport จำลอง ตรวจไม่สร้างบัญชีก่อน OTP, ภาพ/เอกสารและ validation rollback |
| B Admin approve/history | `villa-review.test.mjs`, journey เดิม | roles, CSRF, actor/history, stale/duplicate approval |
| C Public listing/search/detail/QR | `phase1-release.test.mjs`, `read-performance.test.mjs`, browser | eligible-only ก่อน limit, SQL parameters, ภาพ/DTO, search empty/clear |
| D/E แก้→pending→approve→QRเก่า | `business-update.test.mjs`, journey และ browser | approved snapshot ไม่เปิด draft, QRเก่า redirect, browser URL เปลี่ยนตาม |
| F Reject | journey และ `phase1-release.test.mjs` | เหตุผลและสถานะ Owner ถูกต้อง สาธารณะยังแสดงเวอร์ชันเดิม |
| G Security | `phase1-release.test.mjs`, privacy/security/registration/OTP/Phase3 suites | cross-owner, private bytes, account/subscription/QR suspension, hold, CSRF, payment gates/aliases/workers |
| H Mobile | Chrome 390px และ tablet 768px/desktop 1440px | layout หน้าหลัก; ไม่เท่ากับการสแกนกล้องหรืออุปกรณ์จริง |
| I Session/refresh | journey/logout tests, Chrome reload/deep link | session คงอยู่หลัง refresh และ logout ทำให้ token ใช้ไม่ได้ |
| J Zero-payment | Phase3 disabled tests + business promotion + Chrome | ไม่มี charge/manual proof/confirm/QR/คำแนะนำโอนผ่าน gate, ประวัติเดิมอ่านได้ตามสิทธิ์ |

รูป/ผล Chrome: [general/browser.json](validation/phase1-release/general/browser.json) และ [payment/payment-browser.json](validation/phase1-release/payment/payment-browser.json) ผล Chrome 66 รายการผ่าน: General 53 (รวม desktop/tablet/mobile 1440/768/390px) และ Payment UI 13 รายการ General ใช้ข้อมูล backend จริง; payment UI จำลอง API/Omise SDK/redirect จึงเป็น regression งานเดิมที่ยังปิด ไม่ใช่ provider acceptance หรือการเปิด payment Phase 1

## Security/configuration review

ตรวจ parameterized query/identifier allowlist, React escaping/URL checks/file signature+size, owner/Admin/session/CSRF/origin, public allowlist, secret-safe errors, staging mailbox restriction, headers และ build/seed isolation ไม่พบ raw HTML/eval รับข้อมูลผู้ใช้ใน frontend ที่ค้น ความปลอดภัยจากการอ่าน source/ชุดทดสอบนี้ไม่ครอบคลุมการเจาะ public host หรือทั้ง Git history

CSP ปัจจุบันจำกัด frame/object/base ไม่มี script CSP ครบระบบ บัญชี Admin เป็น role เดียว ไม่รับรอง RBAC ราย action ที่ไม่ได้กำหนด Rate-limit topology, HTTPS/cookies และ log retention จริงยังรอ staging/operator

ไม่มีการเรียก SMTP/Omise จริง ไม่มีการส่งเมลลูกค้า/รับเงินจริง/เรียก production health endpoint โดยปริยาย เก็บผล scan เป็นชื่อไฟล์/เลขบรรทัดเท่านั้น ไม่แสดง secret values

รายชื่อ environment/configured boolean ฝั่ง local: [environment-names.json](validation/phase1-release/environment-names.json) ไม่ใช่ค่าของ production; ผล pattern scan: [security-scan.json](validation/phase1-release/security-scan.json) พบ 2 จุดใน test fixtures สำหรับปฏิเสธ live keys ไม่พบ candidate นอก test จาก pattern ชุดนี้
