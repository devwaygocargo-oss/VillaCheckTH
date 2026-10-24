# ข้อขัดขวาง Go-Live — Phase 2 (24 ตุลาคม 2026)

ขอบเขตเปิดตัวล่าสุดจำกัด 6 ฟังก์ชันและปิดเงินจริง ดู [Phase 1 readiness](phase1-go-live-readiness.md) และ [Phase 1 blockers](phase1-critical-blockers.md) รายการด้านล่างยังใช้กับบริการครบวงจร/Phase 2 จึงไม่ใช้ Omise/settlement ที่ปิดไว้เป็น blocker ของ Phase 1

ปรับสถานะหลัง Phase 3: เตรียม Test checkout, payment gates และ staging email isolation แล้ว แต่ยังไม่ได้ deploy หรือผ่าน provider acceptance จริง ดู [รายงาน Phase 3](phase3-preparation-report.md) และ [คู่มือ staging](staging-deployment-guide.md)

เป้าหมายเปิดระบบ 31 ตุลาคม 2026 · ผลประเมินปัจจุบัน **NOT READY** สำหรับบริการครบวงจร/รับเงินจริง ไม่ใช่ใบอนุมัติ deploy

## ระดับและเกณฑ์ปิดงาน

| ID | ระดับ | ข้อค้นพบ/ผลกระทบ | เงื่อนไขปิดงาน | ผู้รับผิดชอบที่เสนอ |
|---|---|---|---|---|
| GL-01 | BLOCKER | Omise Test checkout/source/redirect/refresh UI เตรียมแล้วและทดสอบ mock; ยังไม่มีหลักฐานบัญชี/วิธีชำระจากผู้ให้บริการจริง และ adapter รับเฉพาะ test mode | ทำ Omise Test acceptance ด้วยบัญชีจริง: pending/success/failure/expiry/reversal/replay, browser return/refresh, webhook ที่ host จริง และสร้าง source จาก UI; ตรวจรับ live configuration แยกโดยไม่เรียกเก็บในงานนี้ | ผู้พัฒนา + ผู้ดูแล Omise |
| GL-02 | BLOCKER | SMTP/Email OTP ยังไม่ยืนยันการส่งและรับจริง; เตรียม diagnostic และ staging recipient allowlist แล้ว การสมัครใหม่พึ่งการยืนยันอีเมล | ทดสอบ staging ถึง Inbox/Spam, รหัสผิด/หมดอายุ/ขอซ้ำ, quota/TLS และตรวจผู้รับจริงที่ได้รับอนุญาต | ผู้ดูแล Email + QA |
| GL-03 | BLOCKER | ไม่มีหลักฐานตรวจ production env, DB TLS/permissions, demo/บัญชีเดิม, backup/restore และ monitoring บน host | operator ตรวจรายการใน production-readiness-checklist พร้อมหลักฐานที่ไม่เปิดเผย secrets; backup นอก host และ restore drill; ตรวจข้อมูล demo/บัญชี try-* ด้วยแผนแยก | Dew/ผู้ดูแลระบบ |
| GL-04 | HIGH | ยืนยันส่วนลด 100%/80%, Upgrade ส่วนต่าง และ Downgrade เครดิตเดือนถัดไปแล้ว; วันจบ/ระยะสิทธิ์ฟรีระดับ 2/paid renewal/ฐานเครดิต/rounding/รอบใหม่ยังรอ | คุณเกมส์ลงนามข้อกำหนดก่อนเปิด Basic แบบเรียกเก็บหรือเปลี่ยนแพ็กเกจกลางรอบ ปัจจุบันระบบบล็อก flow เหล่านี้ | คุณเกมส์ |
| GL-05 | HIGH | BL-05 ยืนยันและแก้แล้ว: QR เก่า redirect ล่าสุด และ pending ใช้ approved snapshot; ยังรอ Business UAT กับลิงก์แจกจริงและประวัติเก่าที่ไม่มี snapshot | ทำ UAT QR เก่า/ใหม่/pending/suspension และตรวจประวัติที่มีอยู่จริง | คุณเกมส์ + QA |
| GL-06 | HIGH | ยืนยัน Email + Notice แล้ว; มี outbox แยกช่องทางพร้อม event dedup แต่ยังไม่มีผู้รับ/worker ส่งภายนอก | ระบุ Owner/Email/ผู้เห็น Notice และ worker/retry; ทดสอบส่งจริงและสิทธิ์อ่าน | คุณเกมส์ + ผู้พัฒนา |
| GL-07 | HIGH | Render/Nest/standalone ใช้ socket IP อย่างปลอดภัย แต่หลัง proxy ผู้ใช้หลายคนอาจแชร์ quota; ไม่มี quota ต่ออีเมลสำหรับ password login | ตรวจ trusted ingress/edge rate policy และทดสอบ topology จริงก่อนเปิด backend นี้สาธารณะ; OTP request มี quota ต่อ destination อยู่แล้ว | ผู้ดูแล backend |
| GL-08 | HIGH | สิทธิ์ Admin ส่วนใหญ่เป็น role ระดับเดียว มี designated reviewer เฉพาะบัญชีรับเงิน ไม่มี permission matrix ทั่วระบบ | ยืนยันว่า Admin ทุกคนได้รับสิทธิ์ระดับนี้ หรือกำหนด RBAC ก่อนให้บัญชีจำกัดสิทธิ์แก่บุคคลอื่น | คุณเกมส์ + ผู้ดูแลบัญชี |
| GL-09 | HIGH | Omise UNKNOWN/CREATING/SOURCE_REJECTED และ failed attempt ยังไม่มี operator reconciliation/retry UI; webhook ที่มาก่อนบันทึก charge ID จะได้ 409 | ยืนยัน provider retry/recovery จริง และทำคู่มือกระทบยอดที่ทดลองแล้ว; ห้ามสร้าง charge ใหม่แบบเดาสถานะ | ผู้พัฒนา + การเงิน |
| GL-10 | HIGH | การเปิดบริการเงินจริงต้องทบทวน lifecycle เมื่อบัญชีถูกระงับระหว่างมี invoice/charge ค้าง; legacy invoice บางแบบกระทบทั้งบัญชี | ทดสอบเหตุการณ์ suspension ระหว่างชำระ/คืนรายการและกระทบยอดใบเก่าบน staging ก่อนเปิด payment | ผู้พัฒนา + การเงิน |
| GL-11 | MEDIUM | บางหน้าพึ่ง hash routes, SSR/SEO ราย Villa จำกัด; adapter ซ้ำ/global write lock และ pg concurrency warning | แยกงาน performance/SEO; วัดโหลด/connection pool ก่อนเพิ่ม traffic | ผู้พัฒนา |
| GL-12 | HIGH | Business UAT/อุปกรณ์จริง/เครือข่ายจริงยังไม่มีผู้ตรวจรับ | คุณเกมส์ทำ UAT และทีมทดสอบ iOS/Android/desktop ตาม checklist | คุณเกมส์ + QA |
| GL-13 | HIGH | BL-06 ยืนยัน capability ทั้ง 4 ระดับแล้ว; เงื่อนไขรับประกันระดับ 3–4 ยังไม่ยืนยัน | ปิดคำรับประกันไว้จนมีเอกสารธุรกิจที่ยืนยันแล้ว; capability ไม่ผูกกับราคา | คุณเกมส์ |

## ขอบเขตที่อาจเปิดแบบจำกัดหลังตรวจ host

ขณะนี้เปิดได้ใน **local/staging สำหรับ QA ด้วยข้อมูลทดสอบ**: หน้าแนะนำ, ค้นหา/รายละเอียด Villa ที่อนุมัติ, QR แบบปกปิด, ตรวจข้อมูลที่ผู้ใช้กรอก, Merchant Basic grant, คิวตรวจ Admin, audit และ outbox ภายใน

หากจะพิจารณา production แบบจำกัด ต้องปิด GL-02/GL-03 และความเสี่ยงด้านสิทธิ์/host ที่เกี่ยวข้องก่อน พร้อม UAT รับทราบ GL-04/GL-05 ไม่มีการยืนยันว่า public demo เป็นข้อมูลธุรกิจจริง

ต้องปิดไว้: การรับเงินจริงทุกช่องทาง, Omise checkout สำหรับลูกค้าจริง, Basic paid/renewal, upgrade/downgrade ที่ต้อง settlement, การกล่าวอ้างรับประกัน และการกล่าวอ้างว่าส่ง Owner สำเร็จแล้ว

Phase 3 เพิ่ม `PAYMENT_ACCESS_MODE=DISABLED` เพื่อปิด manual/positive invoice/worker ฝั่ง server; production-mode default ปิด และปฏิเสธ LEGACY_MANUAL การตั้ง `OMISE_TEST_ENABLED=false` เป็นเพียงการปิด gateway ต้องตรวจ mode/revision ทุก instance ด้วย โดยเฉพาะ rollout/rollback ไป revision เก่าที่ยังไม่มี gate ดู [แผนปิด manual](legacy-manual-shutdown-plan.md) การตั้งค่าบน host จริงยังไม่ได้ดำเนินการในงานนี้

## บั๊กที่แก้ใน Phase 2

- HIGH: รูปปกที่อัปโหลดของ Villa รอตรวจ/ถูกปฏิเสธอ่านผ่าน URL ตรงได้ — เพิ่ม owner/Admin authorization และ private/no-store; ผู้ไม่มีสิทธิ์ได้ 404
- HIGH: Nest ใช้โหมด serverless ภายในแล้วเชื่อ header IP จากผู้เรียก — แยก trust จากโหมดจัดเก็บ quota; เชื่อเฉพาะ Vercel ที่กำหนด `VERCEL=1`
- HIGH: ตรวจข้อมูลก่อนโอนโดยไม่มีบัญชี/เบอร์ติดต่อให้เปรียบเทียบกลับได้ MATCHED — เปลี่ยนเป็น REVIEW_REQUIRED รวมกรณีมีเพียงช่องว่าง/ขีด
- HIGH: OTP provider diagnostic เก็บข้อความดิบที่อาจมีอีเมล/OTP/token — เปลี่ยนเป็นข้อความประเภทข้อผิดพลาดและจำกัด code
- MEDIUM: health/operations probes คาด packages เป็น public — เปลี่ยนให้ตรวจ 401 ตามสิทธิ์จริงและยัง fail เมื่อ outage/ข้อมูลรั่ว
- MEDIUM: สรุปสถานะ API ไม่แยก failed/reversal/suspended/ขอแก้ไข — แสดงสถานะตรงกับข้อมูลที่เก็บ โดยไม่แก้ receipt/สิทธิ์ย้อนหลัง
- LOW: ข้อความแพ็กเกจบอกว่าเปิดใช้หลังยืนยันสลิปอย่างเดียว — ระบุว่าต้องอนุมัติ Villa แยกด้วย

ข้อแก้ข้างต้นต้องรวมอยู่ใน revision ที่นำไปตรวจรับ ไม่ได้แก้ production ใน session นี้

## อัปเดตคำตอบเจ้าของ 24 ตุลาคม 2026

ดู [business-logic-update-2026-10-24.md](business-logic-update-2026-10-24.md) และ [pending-business-decisions.md](pending-business-decisions.md) สำหรับพฤติกรรมล่าสุด รายงาน Phase 1–3 เป็นหลักฐานของ revision ก่อนหน้า Checkout ปัจจุบันจำกัด QR PromptPay Test เท่านั้น ระดับ 2 สุทธิ 0 ยังไม่เปิด activation; credit ledger เป็น proposal ใช้จ่ายไม่ได้ ไม่มีการเปิดรับเงินจริงจากงานนี้
