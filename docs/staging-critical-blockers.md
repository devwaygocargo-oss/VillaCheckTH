# Critical Blockers — Vercel Staging

| ID | ระดับ | ข้อค้นพบจริง/สิ่งที่ยังไม่ทราบ | วิธีปิดและผู้รับผิดชอบ |
|---|---|---|---|
| STG-01 | BLOCKER ก่อนอัปเดต/เขียนข้อมูล | Vercel GET project/alias/env ตอบ 403 จึงยืนยัน SHA/branch/alias owner/env/DB target ไม่ได้ | ดิว/ผู้ดูแลทีมตรวจสิทธิ์และ Dashboard บันทึก project/target/deployment SHA/env names โดยไม่เปิดเผยค่า |
| STG-02 | BLOCKER ก่อน Phase 1 write QA | Host paymentConfigured=true และ demoMode=true ไม่ส่ง paymentAccessMode จึงยังไม่มีหลักฐานปิด gate | Operator ยืนยัน runtime mode DISABLED/Omise ปิด, ทดสอบ server guards/aliases/worker ด้วยข้อมูล QA หลังตรวจ DB; flag นี้ไม่ใช่หลักฐานว่าเรียกเก็บเงินจริงได้ |
| STG-03 | BLOCKER ก่อนข้อมูลทดสอบภายนอก | ไม่ทราบ staging DB/provider/schema/migration/role/TLS/backup และความแยกจาก production | Operator ตรวจ target ทุก aliasและ backup/direct/runtime URL, schema/migration, ซ้อม restore แยก ไม่มีการต่อ DB ภายนอกในงานนี้ |
| STG-04 | HIGH | Headers รากขาดหลายรายการตาม source ล่าสุด; SHA บน host ไม่ทราบ | หลังตรวจ artifact/override/CDN และ deploy ที่อนุมัติ ให้ตรวจ HTTPS/security headers ใหม่ |
| STG-05 | HIGH ก่อนสมัครจริง | SMTP/Email OTP inbox acceptance ยังไม่ทดสอบ | ตั้ง exact QA mailbox allowlist ทดสอบ connection/Inbox/Spam/OTP ด้วยผู้รับที่ได้รับอนุญาต |
| STG-06 | HIGH ก่อน go-live | ยังไม่ได้ทำ 16 UAT บน staging/อุปกรณ์จริงหรือคุณเกมส์ลงนาม | QA + คุณเกมส์ตรวจพร้อม revision/evidence/วันที่ หลัง STG-01–03 ปิด |
| STG-07 | HIGH สำหรับ production | hosting บริษัทของ villacheckth.com ยังไม่ทราบ runtime/deploy/DB/backup/ingress | ผู้ดูแล hosting ให้ข้อมูลและแผนแยก ไม่สมมติว่า Vercel deployment คือ production |

บั๊กใน repository ที่พบและแก้แล้ว: script Vite รุ่นเก่าเขียนทับ Next config เพิ่ม guard พร้อม regression ไม่มี unresolved defect ภายใน scope ที่ยืนยันได้จาก tests รอบนี้

Omise acceptance/settlement/เครดิตใช้จ่าย/รับประกัน/LINE–Telegram ไม่ใช่ blocker ของ Phase 1 เมื่อปิดไว้ ไม่เพิ่มฟังก์ชัน Phase 2 และไม่ทดสอบรับเงินจริง
