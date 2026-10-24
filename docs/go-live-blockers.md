# ข้อขัดขวาง Go-Live — Phase 2 (24 ตุลาคม 2026)

เป้าหมายเปิดระบบ 31 ตุลาคม 2026 · ผลประเมินปัจจุบัน **NOT READY** สำหรับบริการครบวงจร/รับเงินจริง ไม่ใช่ใบอนุมัติ deploy

## ระดับและเกณฑ์ปิดงาน

| ID | ระดับ | ข้อค้นพบ/ผลกระทบ | เงื่อนไขปิดงาน | ผู้รับผิดชอบที่เสนอ |
|---|---|---|---|---|
| GL-01 | BLOCKER | Omise ทดสอบเฉพาะ mock ไม่มีหลักฐานบัญชีผู้ให้บริการจริง และยังไม่มี source-collection checkout UI; adapter รับเฉพาะ test mode | ทำ Omise Test acceptance ด้วยบัญชีจริง: pending/success/failure/expiry/reversal/replay, browser return/refresh, webhook ที่ host จริง และสร้าง source จาก UI; ตรวจรับ live configuration แยกโดยไม่เรียกเก็บในงานนี้ | ผู้พัฒนา + ผู้ดูแล Omise |
| GL-02 | BLOCKER | SMTP/Email OTP ยังไม่ยืนยันการส่งและรับจริง การสมัครใหม่พึ่งการยืนยันอีเมล | ทดสอบ staging ถึง Inbox/Spam, รหัสผิด/หมดอายุ/ขอซ้ำ, quota/TLS และตรวจผู้รับจริงที่ได้รับอนุญาต | ผู้ดูแล Email + QA |
| GL-03 | BLOCKER | ไม่มีหลักฐานตรวจ production env, DB TLS/permissions, demo/บัญชีเดิม, backup/restore และ monitoring บน host | operator ตรวจรายการใน production-readiness-checklist พร้อมหลักฐานที่ไม่เปิดเผย secrets; backup นอก host และ restore drill; ตรวจข้อมูล demo/บัญชี try-* ด้วยแผนแยก | Dew/ผู้ดูแลระบบ |
| GL-04 | HIGH | BL-01 วันจบโปรโมชั่น/ระยะสิทธิ์/paid renewal และ BL-02 rounding/credit/refund/รอบใหม่ยังไม่ยืนยัน | คุณเกมส์ลงนามข้อกำหนดก่อนเปิด Basic แบบเรียกเก็บหรือเปลี่ยนแพ็กเกจกลางรอบ ปัจจุบันระบบบล็อก flow เหล่านี้ | คุณเกมส์ |
| GL-05 | HIGH | BL-05 QR เก่ากับการแสดงข้อมูลระหว่างรอตรวจยังรอตัดสินใจ ปัจจุบันรอแล้วซ่อนรายละเอียด และ QR เก่า 404 หลังอนุมัติ | ตรวจรับพฤติกรรมนี้หรือกำหนดนโยบายใหม่ พร้อม UAT ลิงก์ที่พิมพ์/แจกไปแล้ว | คุณเกมส์ + QA |
| GL-06 | HIGH | Owner notification เป็น private durable outbox ยังไม่มีผู้รับ/ช่องทาง/worker ส่งภายนอก | ระบุ Owner, ช่องทาง, retry/dedup, ทดสอบส่งจริงและตรวจการเข้าถึงหลักฐานส่ง | คุณเกมส์ + ผู้พัฒนา |
| GL-07 | HIGH | Render/Nest/standalone ใช้ socket IP อย่างปลอดภัย แต่หลัง proxy ผู้ใช้หลายคนอาจแชร์ quota; ไม่มี quota ต่ออีเมลสำหรับ password login | ตรวจ trusted ingress/edge rate policy และทดสอบ topology จริงก่อนเปิด backend นี้สาธารณะ; OTP request มี quota ต่อ destination อยู่แล้ว | ผู้ดูแล backend |
| GL-08 | HIGH | สิทธิ์ Admin ส่วนใหญ่เป็น role ระดับเดียว มี designated reviewer เฉพาะบัญชีรับเงิน ไม่มี permission matrix ทั่วระบบ | ยืนยันว่า Admin ทุกคนได้รับสิทธิ์ระดับนี้ หรือกำหนด RBAC ก่อนให้บัญชีจำกัดสิทธิ์แก่บุคคลอื่น | คุณเกมส์ + ผู้ดูแลบัญชี |
| GL-09 | HIGH | Omise UNKNOWN/CREATING และ failed attempt ยังไม่มี operator reconciliation/retry UI; webhook ที่มาก่อนบันทึก charge ID จะได้ 409 | ยืนยัน provider retry/recovery จริง และทำคู่มือกระทบยอดที่ทดลองแล้ว; ห้ามสร้าง charge ใหม่แบบเดาสถานะ | ผู้พัฒนา + การเงิน |
| GL-10 | HIGH | การเปิดบริการเงินจริงต้องทบทวน lifecycle เมื่อบัญชีถูกระงับระหว่างมี invoice/charge ค้าง; legacy invoice บางแบบกระทบทั้งบัญชี | ทดสอบเหตุการณ์ suspension ระหว่างชำระ/คืนรายการและกระทบยอดใบเก่าบน staging ก่อนเปิด payment | ผู้พัฒนา + การเงิน |
| GL-11 | MEDIUM | บางหน้าพึ่ง hash routes, SSR/SEO ราย Villa จำกัด; adapter ซ้ำ/global write lock และ pg concurrency warning | แยกงาน performance/SEO; วัดโหลด/connection pool ก่อนเพิ่ม traffic | ผู้พัฒนา |
| GL-12 | HIGH | Business UAT/อุปกรณ์จริง/เครือข่ายจริงยังไม่มีผู้ตรวจรับ | คุณเกมส์ทำ UAT และทีมทดสอบ iOS/Android/desktop ตาม checklist | คุณเกมส์ + QA |
| GL-13 | HIGH | BL-06 เงื่อนไขรับประกันจริงยังไม่ยืนยัน | ปิดคำรับประกันไว้จนมีเอกสารธุรกิจที่ยืนยันแล้ว; capability ไม่ผูกกับราคา | คุณเกมส์ |

## ขอบเขตที่อาจเปิดแบบจำกัดหลังตรวจ host

ขณะนี้เปิดได้ใน **local/staging สำหรับ QA ด้วยข้อมูลทดสอบ**: หน้าแนะนำ, ค้นหา/รายละเอียด Villa ที่อนุมัติ, QR แบบปกปิด, ตรวจข้อมูลที่ผู้ใช้กรอก, Merchant Basic grant, คิวตรวจ Admin, audit และ outbox ภายใน

หากจะพิจารณา production แบบจำกัด ต้องปิด GL-02/GL-03 และความเสี่ยงด้านสิทธิ์/host ที่เกี่ยวข้องก่อน พร้อม UAT รับทราบ GL-04/GL-05 ไม่มีการยืนยันว่า public demo เป็นข้อมูลธุรกิจจริง

ต้องปิดไว้: การรับเงินจริงทุกช่องทาง (รวม manual ใหม่), Omise checkout สำหรับลูกค้า, Basic paid/renewal, upgrade/downgrade ที่ต้อง settlement, การกล่าวอ้างรับประกัน และการกล่าวอ้างว่าส่ง Owner สำเร็จแล้ว การตั้ง `OMISE_TEST_ENABLED=false` เพียงอย่างเดียว **ไม่ใช่** payment kill switch เพราะ manual invoice ยังสร้างได้ถ้ามีบัญชีรับเงิน ต้องตรวจ/จำกัดเส้นทางชำระฝั่ง server/ingress ก่อนเปิดแบบจำกัด

## บั๊กที่แก้ใน Phase 2

- HIGH: รูปปกที่อัปโหลดของ Villa รอตรวจ/ถูกปฏิเสธอ่านผ่าน URL ตรงได้ — เพิ่ม owner/Admin authorization และ private/no-store; ผู้ไม่มีสิทธิ์ได้ 404
- HIGH: Nest ใช้โหมด serverless ภายในแล้วเชื่อ header IP จากผู้เรียก — แยก trust จากโหมดจัดเก็บ quota; เชื่อเฉพาะ Vercel ที่กำหนด `VERCEL=1`
- HIGH: ตรวจข้อมูลก่อนโอนโดยไม่มีบัญชี/เบอร์ติดต่อให้เปรียบเทียบกลับได้ MATCHED — เปลี่ยนเป็น REVIEW_REQUIRED รวมกรณีมีเพียงช่องว่าง/ขีด
- HIGH: OTP provider diagnostic เก็บข้อความดิบที่อาจมีอีเมล/OTP/token — เปลี่ยนเป็นข้อความประเภทข้อผิดพลาดและจำกัด code
- MEDIUM: health/operations probes คาด packages เป็น public — เปลี่ยนให้ตรวจ 401 ตามสิทธิ์จริงและยัง fail เมื่อ outage/ข้อมูลรั่ว
- MEDIUM: สรุปสถานะ API ไม่แยก failed/reversal/suspended/ขอแก้ไข — แสดงสถานะตรงกับข้อมูลที่เก็บ โดยไม่แก้ receipt/สิทธิ์ย้อนหลัง
- LOW: ข้อความแพ็กเกจบอกว่าเปิดใช้หลังยืนยันสลิปอย่างเดียว — ระบุว่าต้องอนุมัติ Villa แยกด้วย

ข้อแก้ข้างต้นต้องรวมอยู่ใน revision ที่นำไปตรวจรับ ไม่ได้แก้ production ใน session นี้
