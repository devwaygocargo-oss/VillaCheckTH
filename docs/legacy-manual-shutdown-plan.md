# แผนปิด Legacy Manual Payment อย่างปลอดภัย

Phase 3 · 24 ตุลาคม 2026 · ดำเนินการเฉพาะ repository ไม่มีการเปลี่ยน production

Manual flow ไม่ได้ debit บัตร/บัญชีผ่าน provider แต่เปิดเผยคำแนะนำ/QR รับโอน และให้ Admin ยืนยันเพื่อเพิ่มสิทธิ์ได้ จึงยังเป็นเส้นทางรองรับเงินจริงหาก operator เปิด legacy mode และตั้งบัญชีรับเงินจริงไว้

## เส้นทางที่ตรวจและมาตรการ

| เส้นทาง | ก่อน Phase 3 | เมื่อ DISABLED / OMISE_TEST |
|---|---|---|
| POST `/api/merchant/villa-package` | สร้าง invoice ยอดบวกเมื่อมี receiver/demo/gateway | DISABLED ปฏิเสธ invoice ใหม่; Basic grant ยอด 0 เดิมยังใช้ได้; OMISE_TEST สร้าง invoice ใหม่แบบ Omise Test |
| POST `/api/villas/:id/renew` | สร้างใบต่ออายุ/manual instructions | DISABLED ปฏิเสธ; Basic paid/renewal ยังบล็อกตามข้อกำหนดเดิม |
| POST `/api/invoices/:id/proof`, `/api/payments/:id/slip` | Merchant ส่งสลิปจริงให้ตรวจได้ | ทั้งสองโหมดปฏิเสธ manual proof |
| POST/PATCH `/api/invoices/:id/confirm`, PATCH `/api/admin/payments/:id/approve` | Admin ยืนยันแล้วบันทึกจ่าย/เพิ่มสิทธิ์ | ทั้งสองโหมดปฏิเสธ ไม่สามารถ bypass ด้วย alias |
| POST `/api/payments/:id/qr`, `/demo-slip` | ออก internal payment-page QR/สลิปจำลอง | ปฏิเสธทั้งสองโหมด; Omise ใช้ provider action/QR ของ Test แยก |
| GET `/api/payments/attempt` | อ่าน internal QR ที่นำไปหน้าชำระ | ปฏิเสธทั้งสองโหมด |
| POST `/api/admin/receiving-bank/email` | ส่งคำแนะนำโอนและ QR จริงให้ Merchant ได้ | ปฏิเสธทั้งสองโหมด |
| GET `/api/receiving-bank/qr/:id`, invoice CMS QR image | Merchant ดาวน์โหลด QR รับเงินจริงที่มีอยู่ | Merchant ถูกบล็อกในสองโหมด; Admin ยังตรวจเอกสารได้ตามสิทธิ์ |
| invoice/state DTO | มี bank QR/payment instructions | ซ่อน bank/payment-page QR และ instructions ของ legacy; เก็บยอด/status/proof/history |
| mail worker + bank-notification worker | ส่ง/ลองใหม่คำแนะนำจ่ายที่ค้าง | หยุด drain ในสองโหมด ไม่ลบ queue หรือปลอม sent |
| POST `/api/payments/:id/omise` | Test charge เท่านั้น แต่ไม่มี global off switch | DISABLED ปฏิเสธ; โหมดที่เปิด gateway ยังรับเฉพาะ Test key/source/charge |
| POST `/api/webhooks/omise` | reconcile test charge จาก API provider | คงไว้เพื่อรับผลรายการ Test ที่สร้างก่อนปิด; ไม่รองรับ live events/charges |
| invoice reject / read history | ดู/ปฏิเสธรายการเดิม | คงการตรวจสิทธิ์และประวัติ ไม่เพิ่มสิทธิ์จากการจ่ายใหม่ |

## การตั้งค่าและ rollout

1. ก่อนแตะ host ให้ operator inventory invoice ค้าง/ส่งสลิปแล้ว/paid/legacy subscription-owner, queued mail, bank notifications และ receiver snapshots โดยไม่ dump ข้อมูลลูกค้าลงรายงาน
2. สำรอง DB และเก็บ artifact เดิม ตรวจการกู้คืนใน staging
3. ทดสอบ revision Phase 3 บน staging ด้วย `PAYMENT_ACCESS_MODE=DISABLED` ยืนยัน endpoint ในตารางถูกปิดแม้มี receiver ตั้งไว้ และ Basic grant/history ยังอ่านได้
4. operator วาง maintenance/payment restriction ที่ ingress ระหว่างเปลี่ยน revision/config เพื่อไม่ให้ instance เก่ารับ manual confirm หรือส่ง queue ค้าง
5. production-mode runtime ที่ไม่กำหนด mode จะเป็น DISABLED และปฏิเสธ LEGACY_MANUAL โดยตรง ค่า CMS `demo_mode` หรือการมี bank config ไม่เปิด bypass gate นี้
6. เมื่อต้องตรวจ provider ให้ใช้ OMISE_TEST ใน **staging ใหม่แยกข้อมูล** เท่านั้น ไม่แปลง/ลบ legacy invoice เดิมอัตโนมัติ; ไม่มี Live mode ให้เปิดใน revision นี้
7. รอให้ทุก instance/worker เปลี่ยน config แล้วตรวจ HTTP, cached HTML, image access และ mail queue อีกครั้ง บันทึก operator/time/revision โดยไม่เก็บ secrets

## รายการค้างและ rollback

- สลิป/การโอนที่เกิดจริงก่อนปิดต้องให้การเงินตรวจและกระทบยอดแยก ห้ามนำไปจำลองเป็น Omise Test และห้ามแก้ paid_at/วันสิทธิ์/ลบประวัติเพื่อให้ tests ผ่าน
- SOURCE_REJECTED/UNKNOWN/CREATING/failed attempts ไม่มี automatic retry UI ให้ตรวจ charge/ref_id ผ่าน provider dashboard ก่อนพิจารณาการแก้รายการที่ได้รับอนุมัติแยก
- Gate หยุด API/UI/worker ที่ระบุ ไม่สามารถเรียกคืน QR/เลขบัญชีจากอีเมลหรือรูปที่เคยแจก และไม่สามารถห้ามการโอนนอกระบบไปธนาคารได้ ต้องมีข้อความ/ช่องทางรับเรื่องโดย operator
- หาก rollback app ไปก่อน Phase 3 จะไม่มี gate นี้ จึงต้องคง ingress restriction และหยุด workers ก่อน rollback ไม่ถือว่าตั้ง env ใหม่แล้ว app เก่าจะเข้าใจ
- ห้ามเปิด LEGACY_MANUAL ใน production เพื่อแก้ปัญหาเฉพาะหน้า หากต้องตรวจ legacy activation ให้จัดแผน reconciliation ที่มีผู้มีสิทธิ์อนุมัติแยก

สิ่งที่ทำแล้วใน repository: server guards, DTO/UI suppression, worker hold และ regression tests สิ่งที่ยังไม่ทำ: เปลี่ยน host env/ingress, ส่งประกาศให้ลูกค้า, กระทบยอด production หรือย้าย invoice
