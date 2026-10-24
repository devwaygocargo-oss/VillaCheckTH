# ผลปรับ Business Logic ตามเจ้าของธุรกิจ — 24 ตุลาคม 2026

ทำต่อจาก `21d226a` บน `fix/autonomous-business-security-20261024` โดยรักษา commit Phase 1–3 และงานผู้ใช้เดิม เปลี่ยนเฉพาะ repository/local test ไม่มี deploy, merge, push, แก้ production database หรือเรียกเก็บเงินจริง คำตอบเจ้าของใน session นี้เป็นข้อกำหนด; PDF/รายงานก่อนหน้าเป็นข้อมูลอ้างอิง

## ราคาและโปรโมชั่น

ตรวจราคาเต็มจาก `server/database.mjs` และการอ่าน `package_catalog` ไม่ได้เชื่อมต่อฐานข้อมูล production จึงไม่ยืนยันว่า catalog บน host มีค่าเดียวกับ source

| ระดับ / รหัสเดิม | ราคาเต็มใน source (บาท) | ส่วนลดเปิดตัว | ส่วนลด (บาท) | สุทธิ (บาท) |
|---|---:|---:|---:|---:|
| 1 / basic | 990 | 100% | 990 | 0 |
| 2 / starter | 1,990 | 100% | 1,990 | 0 |
| 3 / pro | 2,990 | 80% | 2,392 | 598 |
| 4 / premium | 4,990 | 80% | 3,992 | 998 |

Engine คำนวณจากราคาเต็มใน catalog ขณะอ่านและเปอร์เซ็นต์รายแพ็กเกจ ไม่ผูกจำนวนส่วนลดกับราคาในตารางข้างต้น ไม่แก้ราคาเต็ม/ระยะสมาชิก เพิ่ม Admin API `POST /api/admin/package-promotions/:id` รับ `revision`, `active`, `percent` ใช้ auth/CSRF เดิม ตรวจ revision และเก็บ actor/time/history การตั้งค่าทำผ่าน API ยังไม่มีหน้าแก้โปรโมชั่นเฉพาะใหม่

Invoice ใหม่เก็บยอดและ snapshot โปรโมชั่น ณ ออกใบ Invoice เดิม/grant เดิม/วันหมดอายุเดิมไม่ถูกคำนวณใหม่ ห้ามซ้อน coupon กับ launch จนมีนโยบาย หากคำนวณส่วนลดมีเศษต่ำกว่าสตางค์จะบล็อก ไม่เดาวิธีปัดเศษ การปิดโปรโมชั่นใหม่ไม่ยกเลิก grant เดิม

Basic grant เดิมยังทำงาน ระดับ 2 แสดงสุทธิ 0 ถูกต้อง แต่ **ยังไม่เปิดการให้สิทธิ์ฟรีระดับ 2** เพราะยังไม่ยืนยันระยะเวลา/activation/renewal ระบบไม่สร้าง invoice ยอด 0 หรือแปลงเป็นยอดบวกเพื่อชำระ Basic paid onboarding ยังบล็อก

## QR และข้อมูลอนุมัติ

- QR เก่าอ่านผ่าน alias หรือประวัติ approved revision และตอบ redirect 307 ไป QR ล่าสุดที่อนุมัติ Browser hash URL เปลี่ยนตาม
- ระหว่างแก้ไข/รอตรวจ แสดง approved snapshot เดิมสำหรับชื่อ รายละเอียด ข้อมูลที่ใช้ตรวจเทียบ สื่อ และผลยืนยันเจ้าของ ห้าม fallback ไป draft แม้ข้อมูลเดิมว่าง
- รูปปกเดิมยังอ่านได้ระหว่างรอ รูป draft ใหม่เป็น private; หลังอนุมัติจึงเผยแพร่รูปใหม่
- PII ใช้ DTO allowlist เดิม ไม่มีเบอร์/บัญชีเต็ม/ชื่อเจ้าของบัญชีหรือรหัสผู้ตรวจออก public
- Account suspension, QR override และ financial hold ไม่ถูกปลดด้วย QR เก่า การไม่อนุมัติการแก้ไขไม่ลบ approved version เดิมโดยอัตโนมัติ
- QR รุ่นเก่าที่ไม่มีทั้ง alias และ approved history กู้ความเป็นเจ้าของอย่างปลอดภัยไม่ได้ ต้องตรวจข้อมูลจริงก่อนรับรอง QR ที่พิมพ์ไว้ทุกใบ

## การคิดส่วนต่างและสิทธิ์ตรวจสอบ

`package-change.mjs` คำนวณ exact rational preview จากยอดจ่ายจริง ช่วงเวลา และราคาเป้าหมายที่ระบุชัดเจน Upgrade แสดงส่วนต่างในช่วงเวลาเดียวกัน Downgrade ไม่คืนเงินและเตรียมมูลค่าคงเหลือสำหรับทบทวนเครดิตเดือนถัดไป ยังไม่ยืนยันฐานหักค่าระดับใหม่/รอบบัญชี/rounding/สิทธิ์โปรโมชั่น จึงไม่สร้าง settlement หรือเปลี่ยนสิทธิ์

Credit ledger ปัจจุบันเป็น private proposal `PROPOSED_NOT_SPENDABLE` ตรวจเจ้าของ/Admin และรหัสคำขอซ้ำพร้อม fingerprint **ไม่ใช่ balance ใช้จ่ายได้** ไม่มี Merchant settlement endpoint หรือ automatic invoice offset

Capabilities ทั้ง 4 ระดับแยกจากราคา: เอกสารเบื้องต้น, ยืนยันเจ้าของออนไลน์, สิทธิ์รับประกันการจองได้บ้าน, และตรวจบ้าน/ภาพล่าสุดพร้อมสิทธิ์บ้านจริงตรงปก ตามลำดับ ระดับ 3–4 เก็บขอบเขตภายในเท่านั้น Public guarantee ยังเป็น null และกรองคำโฆษณารับประกันจนอนุมัติเงื่อนไข ไม่ได้เปิด workflow เคลมหรือรับรองว่าตรวจบ้านจริงแล้ว

## การแจ้งเตือนและ Checkout

Email และ In-App outbox แยกช่องทาง บันทึก atomic กับ event dedup ไม่สร้างซ้ำเมื่อใช้ event เดียวกัน Admin ยังเห็นคิว Owner เดิม ข้อมูลทั้งสองช่องทางยัง `PENDING_RECIPIENT` ไม่มี worker/ผู้รับ/หลักฐานส่งภายนอก และยังไม่ใช่ Notice ที่ Owner ได้รับแล้ว LINE/Telegram ไม่ได้เปิด

Checkout UI และ server อนุญาต `promptpay` เท่านั้น แม้ config ส่งวิธีอื่น UI จะไม่แสดงและ server ปฏิเสธ ยังคง Test keys, ยอด invoice ฝั่ง server, ป้องกัน charge/webhook ซ้ำ และ payment access gate เดิม การอนุมัติ Villa แยกจากรับชำระ **ยังปิดเงินจริง**

## หลักฐานและการตรวจรับ

- PostgreSQL: 259 ผ่าน, 0 ล้มเหลว, 0 ข้าม
- SQLite: 251 ผ่าน, 0 ล้มเหลว, 8 ข้าม (ชุดเดียวกัน; 8 รายการต้องใช้ PostgreSQL)
- Chrome: 38 กรณีหน้าเว็บ/ราคา/QR และ 13 กรณี payment UI ผ่าน (payment จำลอง API/provider)
- Build, typecheck และ lint ผ่าน

ผลรัน/ขอบเขตอยู่ใน [checks.json](validation/business-20261024/checks.json) ภาพและผล browser อยู่ใต้ [general/browser.json](validation/business-20261024/general/browser.json) และ [payment/payment-browser.json](validation/business-20261024/payment/payment-browser.json) หลักฐาน Phase 1–3 เดิมไม่ถูกแทนที่

Test fixtures สำหรับ journey รุ่นเก่าปิด launch เฉพาะฐานทดสอบเพื่อรักษาเงื่อนไขการเงินเดิม มีชุดใหม่เปิด launch ทดสอบยอดครบทุกระดับ รวมราคา catalog ที่เปลี่ยนและเศษสตางค์ ไม่ใช้ fixture เก่าอ้างว่ายอดใหม่ผ่าน

## งานที่ต้องรอ

ดู [pending-business-decisions.md](pending-business-decisions.md) และให้คุณเกมส์ตรวจ [business-uat-checklist.md](business-uat-checklist.md) โดยเฉพาะอายุฟรีระดับ 2, วันจบโปรโมชั่น, ฐานเครดิต/รอบใหม่/rounding, เงื่อนไขรับประกัน และผู้รับ/worker Email–Notice

Go-Live ยังคง **NOT READY**: ยังไม่มี provider acceptance Omise/SMTP จริง, host/backup/restore acceptance และ Business UAT ไม่มีการใช้ผล mock แทนระบบจริง
