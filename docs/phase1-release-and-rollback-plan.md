# แผน Release และ Rollback — Phase 1

เตรียมใน repository เท่านั้น ไม่ได้ deploy หรือเปลี่ยน production ขั้นตอนที่แตะ host/DB ให้ Operator ตรวจ target และดำเนินการหลังได้รับอนุญาต

## ก่อน Release

1. ปิด P1-B01 ถึง B05 ที่เกี่ยวข้องใน [Blockers](phase1-critical-blockers.md), ลงนาม UAT และบันทึก revision/artifact/dependency lock/env names โดยไม่เก็บค่า secrets
2. Inventory บัญชี demo/try-*, Villa approved/pending, QR alias/history, invoice/slip/mail queues เดิม ห้ามลบหรือแก้ย้อนหลังโดยไม่มีแผนที่อนุมัติ
3. สำรอง DB ที่เข้ารหัสและเก็บนอก host พร้อม host snapshot/PITR; `application-backup.mjs` เก็บ application data ไม่แทน schema/host/PITR สำรองแยก encryption key และกำหนด RPO/RTO
4. ซ้อม migrate/restore ลง DB ใหม่ว่าง ห้าม restore ทับฐานที่มีข้อมูล Script บล็อก target ไม่ว่างและ remote restore โดยค่าเริ่มต้น คำสั่งตัวอย่างให้ดูคู่มือ staging ไม่มีการรันกับ production
5. วาง ingress/payment restriction และหยุด worker ส่งคำแนะนำโอนก่อน rollout ให้ทุก instance ใช้ `PAYMENT_ACCESS_MODE=DISABLED` และปิด Omise/Test/live keys

## ระหว่าง Release ที่ได้รับอนุมัติ

- ใช้ artifact ที่ตรง revision ที่ตรวจ ห้าม migrate/seed ใน build ไม่ seed demo เข้า production ไม่มี migration ใหม่ในรอบนี้
- ถ้าฐานเก่าต้องใช้ deploy-db เดิม ให้ Operator ตรวจ schema/baseline/direct URL และ backup ก่อน ห้าม mark baseline จากการมีชื่อตารางครบอย่างเดียว
- ตรวจ health, cookies, Email OTP, owner edit/approve/reject, public eligibility, QR เก่า/ใหม่, privacy และ payment-disabled API จริง โดยใช้ข้อมูลทดสอบที่แยกได้
- ตรวจสถิติ errors/latency/OTP/rate-limit/DB pool และ cron auth; health green ไม่ใช่ business acceptance

## Trigger Rollback

พบ draft/PII หลุด, auth/owner isolation ผิด, OTP ใช้งานไม่ได้, approved QR ผิดที่พัก, การชำระเปิดโดยไม่ตั้งใจ, migration/data integrity ผิด หรือ errors กระทบ journey หลัก ให้หยุด rollout และจำกัด public route ที่ได้รับผลทันทีโดย Operator

## Rollback อย่างปลอดภัย

1. คง ingress restriction และหยุด payment/mail workers ก่อนเปลี่ยน revision โดยเฉพาะกลับไป revision ก่อน `21d226a` ซึ่งยังไม่มี gate เดิม
2. เก็บ log/audit/backup ปัจจุบันก่อนเปลี่ยน ไม่เปิดเผย secrets/ข้อมูลลูกค้าใน incident report อย่าย้อน DB จาก backup จนสูญเสียรายการใหม่โดยอัตโนมัติ
3. rollback application artifact ไป revision ที่ทดสอบ compatibility แล้ว คง payment DISABLED; หาก app รุ่นเก่าไม่เข้าใจ env นี้ต้องบล็อกที่ ingress ต่อไป
4. ถ้าต้องกู้ข้อมูล ให้ restore backup ลง target ใหม่ว่างและตรวจ schema/counts/เอกสาร/QR/สิทธิ์ก่อนพิจารณาสลับ connection ด้วยการอนุมัติแยก เก็บฐานเดิมไว้ตรวจสอบ ไม่ truncate/drop/reset production
5. sessions/login OTP/rate limits เป็น transient ไม่รวม application backup ผู้ใช้ต้องล็อกอินใหม่หลัง restore; ตรวจว่าไม่เปิดโอกาส OTP replay
6. ตรวจ journeys/payment gates/worker อีกครั้ง เก็บเวลา/revision/ผู้ทำ/ผลและข้อมูลที่อาจสูญหาย RPO/RTO จริงยังต้องซ้อมบน host ไม่อ้างจาก local test

QR/เลขบัญชีที่เคยส่งนอกระบบเรียกคืนไม่ได้ Ingress ป้องกัน app ไม่สามารถห้ามการโอนนอกระบบ ต้องให้ Operator/การเงินดูแลรายการเก่าแยก ไม่เปิดรับเงินจริงเพื่อกระทบยอด
