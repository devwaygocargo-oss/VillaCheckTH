# ส่งมอบ Phase 1 ให้ผู้พัฒนา ผู้ดูแล และคุณเกมส์

**พร้อมสำหรับ Staging QA — ยังไม่อนุมัติ Production** ขอบเขต 6 ฟังก์ชันตาม [รายงานความพร้อม](phase1-go-live-readiness.md) และเป้าหมายเปิด 31 ตุลาคม/ฝ่ายขายเริ่ม 2 พฤศจิกายน 2026

## สิ่งที่ส่งมอบ

- Authentication/Email OTP/session/สิทธิ์เดิม พร้อม regression ที่ไม่ bypass การยืนยันอีเมล
- Owner สร้าง/แก้/อัปโหลด/นำรูปออก/ส่งตรวจ พร้อม approved snapshot และเก็บไฟล์ประวัติ
- Admin queue/approve/reject/เหตุผล/audit/outbox และป้องกันคำขอซ้ำ/เก่า
- Public listing/detail/search/filter เดิม เพิ่ม ACTIVE eligibility ก่อน limit และป้องกัน account/subscription suspension ผ่าน public media
- QR เก่า→ล่าสุด, pending/rejected ไม่เผย draft, public DTO ไม่มีข้อมูลธนาคาร/เบอร์/บัญชี/ผู้ตรวจเต็ม
- ราคา 4 ระดับพร้อมส่วนลดและยอดสุทธิจาก catalog ไม่แก้ราคาเต็มหรือสิทธิ์เดิม ระดับ 2 display-only และการชำระปิด

## ใครต้องทำอะไรต่อ

1. **Operator** เลือก staging project/DB แยก ตั้ง env ตาม [Checklist](phase1-staging-deployment-checklist.md) ตรวจ payment gate/demo/HTTPS/proxy/backup และ deploy staging หลังได้รับอนุญาต
2. **ผู้ดูแล Email + QA** ทดสอบ OTP ถึง allowlisted inbox จริง ปิด P1-B01 เก็บหลักฐานโดยไม่บันทึกรหัสหรือ credentials
3. **QA + Operator** ตรวจ journeys บน staging/อุปกรณ์จริง ซ้อม backup/restore/rollback/monitoring และเก็บ revision/ผล
4. **คุณเกมส์** ทำ [Phase 1 UAT](phase1-business-uat-checklist.md) ลงชื่อวันที่และขอบเขตที่ตรวจรับ ไม่ต้องรอ Omise/settlement/guarantee Phase 2 หากยังปิดไว้
5. **ผู้มีอำนาจอนุมัติ Release** ตรวจหลักฐานครบก่อนตัดสินใจ production แยกจากงาน repository นี้

## งานที่เลื่อนไป Phase 2

Omise/เงินจริง/paid renewal/settlement/เครดิตใช้ได้/รับประกัน/LINE–Telegram/Owner delivery automation ไม่ได้เปิดหรืออ้างว่าผ่าน provider ภายในคง code/ประวัติไว้ ไม่มีข้อมูลการเงินถูกลบ

## Git และหลักฐาน

Branch `fix/autonomous-business-security-20261024` ฐานก่อนงาน `9c5f8ba` และรักษา `21d226a`, `5fc7615`, `816195d` ไว้ทั้งหมด Revision ส่งมอบให้ใช้ local commit ที่มีเอกสารนี้และตรวจ `git rev-parse HEAD` รายการไฟล์/ฐาน revision อยู่ใน [session-files.json](validation/phase1-release/session-files.json); source hashes/ผลตรวจอยู่ใน [checks.json](validation/phase1-release/checks.json)

ไม่มี push/merge/deploy/staging deployment/production DB mutation/live key/เงินจริง/ส่งเมลลูกค้า งานเดิม `.DS_Store`, audit-results/ และ reports/ ไม่รวม commit นี้ หลักฐาน Phase 1–3 และ business update ก่อนหน้าคงอยู่; เอกสาร Phase 1 ชุดใหม่นี้จำกัด scope release จึงไม่ตีความ blockers ของ payment Phase 2 เป็นเงื่อนไขเปิด 6 ฟังก์ชันทั้งหมด
