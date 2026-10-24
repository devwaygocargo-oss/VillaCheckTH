# รายงาน VillaCheck — 24 ตุลาคม 2026

## 1. Executive Summary

อ่าน Feedback PDF ครบ 11 หน้า เทียบกับโค้ดจริง และยึด BL-01 ถึง BL-07 จากเจ้าของธุรกิจเหนือข้อเสนอที่ขัดกันใน PDF ทำงานบน branch `fix/autonomous-business-security-20261024` โดยเก็บงานเดิมของผู้ใช้ไว้ ไม่มีการ deploy, merge, push, ใช้ Omise Live Keys, เรียกเก็บเงินจริง หรือแก้ฐานข้อมูล production

แก้ช่องทางเปิดเผยข้อมูล QR, การสมัครโดยยังไม่ยืนยันอีเมล, ความเสี่ยงวันคงเหลือหาย, สลิปซ้ำ, การปะปนสถานะชำระ/อนุมัติ และการเปลี่ยนข้อมูลสาธารณะโดยไม่ออก QR ใหม่ เพิ่ม Omise Test integration พร้อม mock และทดสอบ HTTP จริงบนฐานข้อมูลแยก

กรอบเวลาที่ร้องขอประมาณ 4 ชั่วโมงเป็นเพดานการทำงาน ไม่ได้อ้างว่าทำงานครบ 4 ชั่วโมง ผลงานรอบนี้สรุปตามหลักฐานการรันจริง งานที่ต้องใช้ credentials หรือการตัดสินใจเพิ่มเติมแยกไว้ชัดเจน

## 2. Completed Fixes

### ความปลอดภัย

- Public QR ไม่ส่งเบอร์โทร เลขบัญชี ชื่อเจ้าของบัญชีเต็ม หรือ UUID ผู้ตรวจ แม้ผู้ขอเป็น User ที่ล็อกอิน ข้อมูลเต็มอยู่ใน endpoint ตรวจของ Admin ที่ตรวจ role แล้ว
- Public listing ใช้รายการ field ที่อนุญาต เพิ่ม rate limit ฝั่ง public และจำกัดการตรวจข้อมูลก่อนโอนต่อบัญชี โดยเปลี่ยน IP ไม่ได้ทำให้ quota ของบัญชีเริ่มใหม่
- ข้อมูล Villa ที่รออนุมัติไม่เปิดเผยร่างผ่าน QR; สื่อที่ยังไม่ตรวจไม่ออกผ่านรายการ/ไฟล์สาธารณะ และไม่ส่งรหัสผู้ตรวจสื่อ
- Password signup ต้องยืนยัน Email OTP ก่อนสร้างบัญชีหรือ session ผูกเจตนาตั้งรหัสผ่านกับ cookie HttpOnly อายุสั้นของเบราว์เซอร์ที่เริ่มสมัคร ป้องกัน role injection และ OTP/คำขอซ้ำ
- เจ้าของอีเมลที่ยืนยัน OTP เข้าบัญชีเดิมครั้งแรกจะทำให้รหัสผ่าน/session ของผู้สมัครดักไว้ใช้ต่อไม่ได้ คงรูปแบบ hash เดิม และใช้ asynchronous scrypt สำหรับตรวจรหัสผ่าน
- การตรวจ OTP กับผู้ให้บริการอยู่นอก write transaction พร้อมตรวจหมดอายุ/จำนวนครั้ง/การใช้ซ้ำอีกครั้งแบบ atomic
- ปฏิเสธชื่อเอกสารที่ชน namespace ภายในทั้งเอกสารทั่วไปและหลักฐานเจ้าของบ้าน
- เพิ่ม CSP สำหรับ frame/object/base, X-Frame-Options, nosniff, Referrer-Policy และ Permissions-Policy

### เงินและสิทธิ์

- Basic แพ็กเกจเดียว ราคาปกติ 990 บาท ลด 100% สุทธิ 0 บาท เก็บ grant/โปรโมชั่นที่ใช้โดยไม่สร้างรายการเรียกเก็บ ปิด grant ใหม่ได้โดยไม่แตะสิทธิ์เดิม
- ปิดการสร้าง invoice Basic แบบเรียกเก็บจนกว่าเงื่อนไขสมัครแบบชำระเงิน/ต่ออายุจะยืนยัน ป้องกันการปิดโปรโมชั่นแล้วเรียกเก็บจากผู้มีสิทธิ์เดิมโดยไม่ตั้งใจ
- ป้องกันการเปลี่ยนแพ็กเกจที่ยังมีมูลค่าเหลือ รวมข้อมูลวันสิ้นสุดที่ไม่ครบ มี service คำนวณมูลค่าคงเหลือแบบเศษส่วนตรงตามยอดจ่ายจริงและช่วงเวลาจริง ไม่ปัดเศษหรือสร้างนโยบายเครดิตเอง
- ไม่สร้าง invoice ยอดบวกเมื่อไม่มีบัญชีรับเงิน/gateway ที่ตั้งค่าไว้ นอก Demo mode ค่า readiness และ config ใช้เกณฑ์เดียวกัน
- QR PromptPay ราย invoice มีจำนวนเงินและผู้รับตาม snapshot เดิม เปลี่ยนบัญชีรับเงินภายหลังไม่เปลี่ยนใบเก่า
- กันการใช้สลิปไฟล์เดียวกันและเลขอ้างอิงที่ปรับรูปแบบแล้วซ้ำข้าม invoice
- ทุก payment รวม renewal ต้องรอ Admin อนุมัติ Villa แยกจากการรับชำระ รายการซ้ำไม่เพิ่มวัน/จำนวนชำระซ้ำ การแก้ข้อมูลไม่ล็อกการตรวจรับชำระของ Villa ที่เคยอนุมัติแล้ว
- ใบแบบบัญชี Merchant รุ่นเดิมยังเก็บประวัติไว้ และทำให้ Villa ที่ได้รับผลทุกแห่งเข้าคิวตรวจ ป้องกันการเปลี่ยนแพ็กเกจทั้งบัญชีโดยทำมูลค่าเดิมหาย

### การอนุมัติและงานดูแล

- เก็บ approved snapshot แยกจากร่าง พร้อมประวัติการแก้ไข/อนุมัติ และออก QR ใหม่หลังอนุมัติข้อมูล สื่อ รายละเอียด ระดับตรวจ และผลยืนยันเจ้าของบ้าน
- เก็บไฟล์หลักฐานเจ้าของบ้านรุ่นก่อนแทนการลบทิ้งเมื่อส่งใหม่ ประวัติเป็นข้อมูลส่วนตัวที่ตรวจสิทธิ์ก่อนอ่าน
- Admin ผู้มีสิทธิ์หนึ่งคนเสนอและอนุมัติได้ รวมรายการของตนเอง ยังคงข้อจำกัด reviewer ที่ตั้งค่าไว้ ตรวจคำขอซ้ำ/เก่า และบันทึกผู้ทำ ผู้อนุมัติ เวลา ผล และคิวแจ้ง Owner
- การแจ้ง Owner เป็น durable private outbox และมีแสดงใน Admin dashboard **ยังไม่ใช่หลักฐานว่าส่งภายนอกถึง Owner แล้ว**
- แก้ Leads เปิดลิงก์ตรง/refresh ด้วยการกันผลโหลดเก่าทับใหม่ แสดง loading/error แทนยอด 0 ชั่วคราว
- ยกเลิก reminder ที่ invoice จ่ายแล้วหรือส่งหลักฐานแล้ว โดยเก็บประวัติ mail ไว้
- Build ไม่รัน migration หรือ seed; public demo seed ต้องเรียกเองและ opt-in ชัดเจน ไม่มีการล้าง demo production
- กฎตรวจรีวิวใช้ capability รายแพ็กเกจแทนราคา ซ่อนคำรับประกันที่ยังไม่ยืนยัน และแก้ข้อความไม่ให้สัญญาว่าฟรีตลอดไป เพิ่ม Open Graph พื้นฐาน

## 3. Business Logic Implementation

| ข้อ | สถานะ | ขอบเขตและข้อจำกัด |
|---|---|---|
| BL-01 | COMPLETED ในส่วนที่ยืนยัน | ราคา/ส่วนลด/สุทธิ, grant history, ปิดโปรโมชั่นใหม่, สิทธิ์เดิมคงอยู่; ระยะเวลาและ paid renewal ยัง BLOCKED รอข้อกำหนด |
| BL-02 | COMPLETED สำหรับ Calculation Service และ safeguards | คำนวณ exact value ทดสอบกลางรอบ/100%/หมดอายุ/ซ้ำ; flow ย้ายจริงและ settlement BLOCKED รอนโยบาย |
| BL-03 | COMPLETED สำหรับ integration layer/mock | REST/HTTP/status/webhook/audit/duplicate protection; provider จริงและ checkout source UI ยัง BLOCKED |
| BL-04 | COMPLETED | Payment, subscription, approval และ verification แยกกัน ทุก payment รออนุมัติ และคิว Admin/ข้อความ Merchant สอดคล้องกัน |
| BL-05 | COMPLETED สำหรับ workflow ที่แก้ | approved versions/history และ QR ใหม่หลังอนุมัติ; นโยบาย QR เก่า/การแสดงข้อมูลระหว่างรอ ยัง Pending Decision |
| BL-06 | COMPLETED สำหรับโครงสร้าง/ข้อความปลอดภัย | capability แยกจากราคา และ guarantee=null; ขอบเขตรับประกันจริงยัง BLOCKED |
| BL-07 | COMPLETED สำหรับ single approval/audit/outbox | permission, actor/reviewer/time/result และกันซ้ำ; การส่ง Owner ภายนอกยัง BLOCKED รอปลายทาง |

## 4. Omise Integration

เปิดเฉพาะ Test Mode และปิดโดยค่าเริ่มต้น ไม่พบ Omise test key ใน `.env` ที่ตรวจแบบแสดงเพียงว่าตั้งค่าหรือไม่ ไม่เปิดเผยค่า credentials

สร้าง charge จากยอด invoice ฝั่ง server และ test source, เก็บ `ref_id`/charge/transaction, ดูสถานะหลัง refresh, ตรวจ event และ charge ผ่าน provider API แทนเชื่อ payload, กันซ้ำ และเก็บ audit รายการ UNKNOWN จะไม่สร้างซ้ำอัตโนมัติ รายการกลับรายการคง receipt เดิมและเข้าคิวกระทบยอด โดยไม่สมมตินโยบายคืนเงินหรือหักสิทธิ์ย้อนหลัง

เมื่อเปิด test gateway ใบใหม่ใช้ Omise อย่างเดียว ไม่ส่งวิธีโอน manual ของใบใหม่นั้น ใบ manual เก่ายังตรวจได้ ไม่มีการลบ payment history ทั้งหมดนี้ทดสอบด้วย mock — **ยังไม่ได้ทดสอบ Omise จริง** รายละเอียดและแหล่งเอกสารทางการอยู่ใน [omise-test-integration.md](omise-test-integration.md)

## 5. Test Results

ผลยืนยัน source revision ขั้นสุดท้าย: PostgreSQL 242 ผ่าน/0 ล้มเหลว/0 ข้าม; SQLite 234 ผ่าน/0 ล้มเหลว/8 ข้าม; Chrome 4 ผ่าน ทั้งสองฐานข้อมูลใช้ชุดเดียวกัน 242 tests จึงไม่รวมจำนวนซ้ำเป็นคนละชุดใหม่ ดู [checks-2026-10-24.json](validation/checks-2026-10-24.json)

- PostgreSQL ใช้ cluster ชั่วคราวบน localhost และ schema แยก ครอบคลุม NestJS/Prisma, Next production และ legacy Vercel adapter
- SQLite เป็นชุดเร็ว ชุดที่ข้ามต้องใช้ PostgreSQL
- Chrome ตรวจ Leads หลัง direct link/refresh, ราคา 990 ลด 100% สุทธิ 0, mobile 390px และข้อความ/การปกปิดข้อมูล QR
- `npm run build`, `npm run typecheck` และ `npm run lint` ผ่านครบในรอบสุดท้าย (exit code 0)
- ไม่ใช้ผลจำลองแทน SMTP/Omise/OAuth จริง และไม่ได้ทดสอบบนอุปกรณ์จริงทุกประเภท

หลักฐานเบราว์เซอร์: [local-browser-2026-10-24.json](validation/local-browser-2026-10-24.json)

## 6. Files Changed

รายการไฟล์ครบถ้วนอยู่ใน [session-files-2026-10-24.json](validation/session-files-2026-10-24.json) แยกจาก audit-results/, reports/ และ `.DS_Store` ที่มีอยู่ก่อนงานนี้

กลุ่มหลัก: server/app/auth/registration/payment/Omise/promotion/approval/media; React registration/pricing/admin/QR; Next headers/metadata; build/demo scripts; regression tests; เอกสารปฏิบัติการ ไม่มีการเปลี่ยน dependency หรือ database architecture

## 7. Pending Business Decisions

ดู [pending-business-decisions.md](pending-business-decisions.md): วันจบ/ระยะเวลาโปรโมชั่นและการต่ออายุ, การปัดเศษ/เครดิต/คืนเงิน/วันเริ่มรอบเมื่อเปลี่ยนแพ็กเกจ, QR เก่าและ public visibility ระหว่างรอ, guarantee terms, Owner recipient/channel และ Omise methods/credentials

## 8. Remaining Issues

- SMTP มี config ใน local environment แต่ไม่ได้ยืนยันการส่งจริง รายงาน 535 ใน PDF เป็นหลักฐานเดิม ไม่อ้างว่าแก้ credentials production แล้ว
- Omise จริง, source-collection UI และ production readiness ของ gateway ยังไม่ตรวจรับ
- Owner outbox ยังไม่ส่งถึงช่องทางภายนอกจริง
- ไม่เปลี่ยน/ลบ demo หรือบัญชี try-* ใน production ไม่ย้าย invoice รุ่นเก่าหรือ reset รหัสผ่าน Admin จริงเอง ต้องมีการตรวจรับและกระทบยอดโดยผู้ดูแล
- Auth rate limit ยังอ้างอิง IP; trusted proxy สำหรับ standalone/Render และ quota ต่ออีเมลต้องตรวจเพิ่มก่อนใช้ topology นั้น
- Hash routes/client rendering ยังจำกัด SEO ราย Villa; การแยก public server-rendered route และปรับโครงสร้าง routing เป็นงานต่อไป
- Schema/adapter ซ้ำ, global write lock, prototype fallback และ domain ที่ hardcode ยังต้อง refactor แยก ไม่ลบ NestJS/SQLite/PostgreSQL ในรอบนี้
- PostgreSQL แสดง deprecation warning เรื่องการ query พร้อมกันบน pg client ในโค้ดเดิม แม้ tests ผ่าน ต้องแก้การจัดคิวใน adapter ต่อไป

## 9. Deployment Readiness

**ยังไม่พร้อมเปิดรับเงินจริงหรือ deploy production โดยอัตโนมัติ** ต้องปิดงาน provider acceptance, เงื่อนไขธุรกิจที่ค้าง, Owner delivery และข้อมูลจริงก่อน Production migration เป็นขั้นตอน operator แยกจาก build ไม่มี migration ใหม่ในรอบนี้ การมี build/tests ผ่านไม่ใช่ Go-live approval

## 10. Next Steps

1. ยืนยัน business decisions เพื่อปิด Basic paid onboarding และ prorated upgrade/downgrade โดยไม่เสียสิทธิ์เดิม
2. ตั้ง Omise test credentials/methods และทำ provider acceptance รวม success/failure/pending/reversal/replay ก่อนต่อ source UI
3. ยืนยัน SMTP และ Owner recipient/channel แล้วทดสอบการส่งที่จำเป็นใน staging
4. ตรวจบัญชี/invoice/demo/credentials เดิมใน production ด้วยแผนที่อนุมัติแยก ไม่ลบหรือ migrate อัตโนมัติ
5. ทำ business UAT/physical-device acceptance แล้วจึงพิจารณา refactoring ตาม [architecture-refactoring-plan.md](architecture-refactoring-plan.md)
