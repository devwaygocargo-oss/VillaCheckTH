# ข้อขัดขวางเฉพาะ Phase 1

สถานะท้องถิ่น READY FOR STAGING QA; ห้ามตีความว่า production พร้อม ข้อขัดขวางต่อไปนี้ต้องปิดก่อนเปิดฟังก์ชันที่เกี่ยวข้อง

| ID | ระดับ | ข้อขัดขวาง/หลักฐานที่ยังขาด | ผู้ทำและเงื่อนไขปิด |
|---|---|---|---|
| P1-B01 | BLOCKER | Email OTP ยังไม่ได้ส่งถึง staging inbox จริง การสมัครต้องพึ่ง Email | ผู้ดูแล Email ตรวจ SMTP/TLS/sender/quota/Inbox/Spam ด้วย allowlisted mailbox และทดสอบรหัสผิด/หมดอายุ/ซ้ำ |
| P1-B02 | BLOCKER | ยังไม่ได้ตรวจ host env/DB TLS/สิทธิ์/preview isolation/demo accounts/ingress/payment gate บน deployment | Operator deploy staging ที่ได้รับอนุญาต ตรวจ checklist ทุก instance และยืนยันไม่มี production DB/credential ปะปน |
| P1-B03 | BLOCKER | ไม่มีหลักฐาน backup นอก host/restore/rollback/monitoring ของระบบปลายทาง | Operator ทำ rehearsal กับฐานใหม่ เก็บเวลา/RPO/RTO และทดสอบ alert/cron ตามแผน; local test ไม่แทน host drill |
| P1-B04 | HIGH | คุณเกมส์ยังไม่ได้ตรวจรับ 6 ฟังก์ชัน | ลงผล UAT พร้อม revision/หลักฐาน/ผู้ตรวจ/วันที่ ห้ามทีมพัฒนากรอก Pass แทน |
| P1-B05 | HIGH | Browser จำลอง viewport ไม่ใช่ iOS/Android/camera/เครือข่ายจริง | QA ทดสอบกล้อง/อัปโหลด/สแกน QR/refresh/keyboard บนอุปกรณ์จริงและ HTTPS |
| P1-B06 | HIGH แบบมีเงื่อนไข | standalone/Render หลัง proxy อาจใช้ IP quota ร่วมกัน | หากใช้ topology นี้ Operator ยืนยัน trusted ingress/rate policy และทดสอบ; Vercel full-stack ไม่ได้เชื่อม Render อัตโนมัติ |
| P1-B07 | HIGH แบบมีเงื่อนไข | QR แจกเก่าที่ไม่มี alias/history ไม่มีหลักฐานกู้ ownership | ตรวจ inventory รหัสที่จำเป็นก่อนใช้กับฝ่ายขาย; unknown QR ต้อง 404 ไม่สร้าง mapping โดยเดา |

## งาน Phase 2 ที่เลื่อนได้เมื่อปิดไว้

Omise acceptance/live checkout, เครดิตใช้จ่าย/settlement/คืนเงิน, paid renewal, guarantee terms, Owner external notification automation และ LINE/Telegram ไม่ใช่ blocker ของขอบเขต 6 ฟังก์ชันนี้ ห้ามนำผลการเลื่อนมาใช้เปิด route เหล่านี้ ต้อง `PAYMENT_ACCESS_MODE=DISABLED`, `OMISE_TEST_ENABLED=false`, ไม่มี bank instructions/QR ให้ผู้ใช้และ hold workers เดิม

MEDIUM: hash-route SEO, global write lock/pg concurrency deprecation warning และการวัดโหลดจริงก่อนขยาย traffic ยังต้องติดตาม ไม่พบ security blocker ที่ยังเปิดค้างจาก regression ที่แก้ใน repository แต่ยังไม่ได้พิสูจน์ host configuration จริง
