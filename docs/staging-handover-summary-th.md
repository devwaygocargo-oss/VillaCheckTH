# สรุปส่งมอบ Staging Readiness — 24 ตุลาคม 2026

1. **Staging เดิมพร้อมอัปเดตหรือไม่:** ยังยืนยันไม่ได้ Local linkage คือ `design-villacheck` แต่ API 403 ขาด SHA/env/DB target มี health 200 จริง แต่ paymentConfigured/demoMode ยัง true และ headers หลายจุดไม่ตรง source ล่าสุด
2. **โค้ดพร้อม deploy หรือไม่:** ผ่าน local build/tests และพร้อมเตรียม artifact หลังปิด preflight blockers/ได้รับอนุญาต ไม่มีการ deploy อัตโนมัติ
3. **Blockers:** สิทธิ์ Vercel, DB isolation/schema/backup, host payment gate/headers, SMTP จริง และ UAT/อุปกรณ์จริง ดู [รายการเต็ม](staging-critical-blockers.md)
4. **ต้องตั้ง/ตรวจอะไร:** project/team/alias/target, Next/`.next`/Node24, APP_URL, staging PostgreSQL/direct URL, Email OTP/allowlist, payment DISABLED/Omise ปิด/demo seed ปิด, monitoring/backup ตาม [Configuration Checklist](staging-configuration-checklist.md) Host env ยังไม่ทราบ ไม่แสดงค่าความลับ
5. **ดิวทำต่อเรียงลำดับ:** แก้ read access และยืนยัน project/alias/SHA → ยืนยัน staging DB แยก/backup/schema → ตรวจ env/payment/demo/headers → อนุมัติและ deploy staging revision ที่ตรวจแล้ว → smoke/SMTP inbox → QA 16 ข้อ/อุปกรณ์จริง → คุณเกมส์ตรวจรับ ไม่ข้ามไป production hosting ที่ยังไม่ทราบรายละเอียด
6. **เริ่ม Staging QA เมื่อใด:** อ่านหน้า/public smoke ทำแล้ว ส่วนทดสอบสมัคร/Owner/Admin/เขียนข้อมูลให้เริ่มหลัง STG-01–03 ปิดและ artifact/config ที่ตรวจผ่าน smoke ไม่ผูกวันโดยคาดเดา

## ผลทดสอบ

PostgreSQL 262 ผ่าน/0 ล้มเหลว/0 ข้าม; SQLite 254 ผ่าน/0 ล้มเหลว/8 ข้าม (ชุดเดียวกัน PostgreSQL-only); Chrome 66 ผ่าน (53 general + 13 payment mock), Build/Typecheck/Lint/Diff checks ผ่าน ไม่มี SMTP/Omise acceptance จริง

หลักฐาน [checks.json](validation/staging-readiness/checks.json), [Staging GET probes](validation/staging-readiness/public-probes.json), [Vercel read access](validation/staging-readiness/vercel-readonly.json)

## สิ่งที่แก้ / Git

แก้ legacy Vite configurator ไม่ให้เขียนทับ Next config พร้อม test และแยก test evidence รอบใหม่จาก revision เก่า Branch `fix/autonomous-business-security-20261024` ฐาน `1900926` รักษา commits เดิมทั้งหมด รายการไฟล์/revision อยู่ใน [session-files.json](validation/staging-readiness/session-files.json) ใช้ local commit ที่มีรายงานนี้เป็น revision ส่งมอบ

ไม่มี deploy staging/production, push, merge, เปลี่ยน Vercel settings, migration/เขียน DB ภายนอก, live payment หรือส่งเมลลูกค้า ไม่แตะ production `villacheckth.com` หรือ hosting บริษัท งานเดิมผู้ใช้และหลักฐานก่อนหน้าคงไว้

เอกสารประกอบ: [Readiness report](staging-readiness-report.md), [Database safety](staging-database-safety-assessment.md), [Staging QA 16 กรณี](phase1-staging-qa-checklist.md), [Deploy/Rollback](staging-deployment-and-rollback.md)
