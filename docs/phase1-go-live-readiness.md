# ความพร้อมเปิด Phase 1 — 24 ตุลาคม 2026

**ข้อเสนอ: READY FOR STAGING QA** เป้าหมายเปิด 31 ตุลาคม และทีมขายเริ่มติดต่อ 2 พฤศจิกายน 2026 ยังไม่ใช่การรับรอง production หรืออนุมัติ deploy

ขอบเขตที่เจ้าของยืนยันมีเพียง Authentication, Owner Villa Management, Admin Review, Public Discovery, Verification QR และ Package/Promotion Display ปิดการชำระเงินจริงทั้งหมด งาน provider payment, settlement, เครดิตใช้จ่ายได้, paid renewal, LINE/Telegram และรับประกันเป็น Phase 2 ไม่ใช้เป็นเหตุขวาง Phase 1 เมื่อปิดเส้นทางเหล่านั้นจริง

| ขอบเขต | สิ่งที่ตรวจ/ปรับแล้ว | ข้อจำกัด |
|---|---|---|
| P1-01 | OTP ก่อนสร้างบัญชี, uniqueness/replay/expiry/rate limit, password hash, session/logout, role/CSRF และบัญชีระงับ | ส่ง Email จริงยังต้องตรวจ staging; ไม่ bypass OTP |
| P1-02 | สร้าง/แก้/ส่งตรวจ/รูปปก/สื่อ, validation rollback, owner isolation; เพิ่มนำรูปปกออกและ soft-remove gallery พร้อมส่งตรวจ | เก็บไฟล์ประวัติ ไม่ลบ approved media ก่อนอนุมัติ; กล้อง/อุปกรณ์จริงยังต้องตรวจ |
| P1-03 | คิว, approve/reject/reason, audit actor/time, duplicate/stale request, approved version, outbox | Admin เป็น role เดียวตามระบบเดิม ไม่ได้สร้าง granular RBAC |
| P1-04 | ชื่อ/จังหวัด/filter/sort เดิม, รายละเอียด, privacy allowlist; แก้ listing กรอง ACTIVE ก่อน limit | ไม่เพิ่ม filter/SSR/แผนที่ใหม่; SEO/hash routes ยังจำกัด |
| P1-05 | QR เก่า redirect ล่าสุด, pending/rejected revision ใช้ snapshotเดิม, ระงับ/hold ไม่หลบผ่าน QR/สื่อ | รหัสที่ไม่มีหลักฐาน alias/history ยัง 404; ต้อง inventory รหัสแจกจริง |
| P1-06 | ราคาเต็ม/เปอร์เซ็นต์/จำนวนส่วนลด/สุทธิจาก catalog, เพิ่มแสดงส่วนลด 0% เมื่อปิดโปรโมชั่น | ระดับ 2 display-only จนยืนยันระยะสิทธิ์ ไม่เปิด settlement/รับประกัน |

ราคาเต็มอ้างอิง source: Basic 990 / Starter 1,990 / Pro 2,990 / Premium 4,990 บาท สุทธิเปิดตัว 0 / 0 / 598 / 998 ตามลำดับ ยังไม่ได้อ่าน production catalog และไม่เดาระยะสมาชิกหรือวันจบโปรโมชั่น

## ข้อบกพร่องที่แก้ในรอบนี้

- HIGH: listing เคยรวมรายการอนุมัติที่ subscription/QR ถูกระงับหรือหมดอายุ → ใช้ eligibility และกรองก่อน pagination
- HIGH: account access suspension เคยปิด login แต่ไม่ครอบคลุม public trust → อ่านสถานะบัญชีใน trust ทั้งแบบเดี่ยวและ batch
- HIGH: รูปปก/gallery/รีวิวเคยตรวจเพียง approved status → ตรวจ ACTIVE เพิ่ม; public QR ที่ไม่ eligible ตอบสถานะจำกัด ไม่ส่งชื่อ/รูป/รายละเอียด
- MEDIUM: QR public ยังมีชื่อธนาคาร → ส่งเฉพาะ authorized Admin DTO
- MEDIUM: Owner ไม่มีการนำ gallery ออกอย่างปลอดภัย → soft removal, audit, pending review, duplicate guard; approved snapshot/ไฟล์เดิมยังอยู่จนอนุมัติ
- LOW: โปรโมชั่นปิดแล้วแสดงเฉพาะราคาเดียว → แสดงราคาเต็ม/ส่วนลด 0/สุทธิชัดเจน

ไม่มี migration/dependency/architecture change งานเดิมและ commit ก่อนหน้ายังอยู่ ไม่มี deploy/push/merge/production DB mutation/live keys/เงินจริง/เมลลูกค้า

ดู [ผลทดสอบ](phase1-test-evidence.md), [Blockers](phase1-critical-blockers.md), [UAT](phase1-business-uat-checklist.md) และ [Staging checklist](phase1-staging-deployment-checklist.md) สถานะ Business UAT ยังเว้นให้เจ้าของตรวจเอง
