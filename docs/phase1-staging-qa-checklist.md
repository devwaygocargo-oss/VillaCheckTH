# Phase 1 Staging QA — ใช้ UAT เดิม 16 กรณี

รายการหลักอยู่ใน [phase1-business-uat-checklist.md](phase1-business-uat-checklist.md) ไม่สร้างเกณฑ์ธุรกิจใหม่หรือกรอก Pass แทนคุณเกมส์ รอบนี้ตรวจ staging เฉพาะ public GET 6 จุด ไม่ login/สร้างบัญชี/ส่ง OTP/เขียนข้อมูลภายนอก

## เงื่อนไขก่อนเริ่มเขียนข้อมูล

- [ ] ยืนยัน project/alias/deployment revision และ DB แยก production
- [ ] ปิด payment + Omise, ตรวจ workers/legacy routes และปิดหรือแยก demo โดย Operator
- [ ] ตั้ง SMTP/OTP exact test mailbox allowlist และจัดบัญชี Admin/Owner ทดสอบอย่างปลอดภัย
- [ ] Deploy revision ที่ตรวจแล้วโดยผู้ได้รับอนุญาต; health/headers/APP_URL ผ่าน smoke tests

## ข้อมูลทดสอบที่ต้องจัดเตรียมโดยผู้ดูแล

| Actor/ข้อมูล | วิธีเตรียม | การใช้งาน |
|---|---|---|
| Owner A | สมัครผ่าน Email OTP ด้วย QA inbox ที่อนุมัติและอยู่ใน allowlist | Villa `QA-P1-A`, ชื่ออังกฤษ `QA Phase One A`, จังหวัดจากตัวเลือกจริง และรูป/เอกสารสมมติ |
| Owner B | QA inbox อีกบัญชีหนึ่ง แยกจาก Owner A | ทดลอง cross-owner และ private media ไม่ใช้บัญชีลูกค้า |
| Admin QA | ผู้ดูแลสร้าง/ให้บัญชี Admin ที่ได้รับสิทธิ์ไว้แล้ว | approve/reject/reason/history ไม่มีการสมัคร role Admin ผ่าน public form |
| Public | private/incognito browser ไม่ login | listing/filter/detail/QR และไม่เห็น draft/PII |
| สื่อ | JPG/PNG ที่ทีมมีสิทธิ์ใช้และเอกสารระบุว่าเป็นข้อมูล QA ชัดเจน ไม่มีบัตรประชาชนจริง | upload/replace/remove/invalid file และ snapshot |
| Invoice เก่า/hold | ใช้เฉพาะ staging fixture ที่ Operator จัดด้วยแผนแยกหลังตรวจ target | ห้ามสร้างรายการเงินจริงหรือเปลี่ยน invoice ลูกค้าเพื่อทดสอบ |

อย่าใช้ mailbox ตัวอย่าง `.test` เป็นผู้รับ SMTP จริง ผู้ดูแลต้องระบุ QA inbox จริงที่ได้รับอนุญาตเอง เก็บรหัสผ่าน/OTP นอกเอกสารและใช้ Password Manager แยกชุด production

## สถานะหลักฐานแต่ละกรณี

| UAT | Local automated coverage | Staging จริง | ส่วนที่ต้องรอ |
|---|---|---|---|
| 01 สมัคร/Email | logic ผ่าน, mail transport mock | รอ | inbox/SMTP และ Owner signup จริง |
| 02 OTP ผิด/หมดอายุ/ซ้ำ | ผ่าน boundary/replay/quota | รอ | delivery/resend จริง |
| 03 Login/session/logout | ผ่าน HTTP และ browser refresh | รอ | cookies/HTTPS/session บน host |
| 04 สร้าง Villa/รูป | ผ่าน HTTP+DB จริง | รอ | Owner UI บน staging |
| 05 invalid file/rollback | ผ่าน | รอ | upload บนเครือข่ายจริง |
| 06 แก้/นำรูปออก | ผ่าน snapshot/soft-remove/duplicate | รอ | Owner/Admin UI จริง |
| 07 Admin approve | ผ่าน role/CSRF/history | รอ | บัญชี Admin staging |
| 08 Reject/resubmit | ผ่าน reason/snapshot | รอ | ผู้ตรวจจริง |
| 09 Duplicate/stale review | ผ่าน | รอ | หลายหน้าต่างบน staging |
| 10 Public search/filter | ผ่าน Chrome+API | เฉพาะ listing GET 200 | search/filter/ข้อมูลทดสอบยังไม่ตรวจ |
| 11 QR เก่า/pending | ผ่าน HTTP/Chrome | รอ | approved revision จริงบน staging |
| 12 Unknown/suspension/hold | ผ่าน API/media isolation | รอ | fixture ที่แยกปลอดภัย |
| 13 ราคา 4 ระดับ | ผ่าน 0/0/598/998 จาก catalog source | unauth packages 401 เท่านั้น | login แล้วตรวจ host catalog |
| 14 Payment disabled | ผ่าน server/aliases/workers และ real local browser request | ยังยืนยันไม่ได้ | host paymentConfigured=true/demoMode=true ต้องตรวจ gate ก่อน |
| 15 Role/privacy | ผ่าน | เฉพาะ packages 401 | cross-owner/Admin/ไฟล์ตรงบน staging |
| 16 Mobile/tablet/keyboard | Chrome 390/768/1440 ผ่าน | รอ | iOS/Android/กล้อง/keyboard/เน็ตจริง |

คุณเกมส์ตรวจทั้ง 16 ข้อพร้อม revision/evidence/ผู้ตรวจ/วันที่ก่อนลงนาม Business UAT; ผล local ไม่แทน business acceptance และ health 200 ไม่แทนทั้งหมด
