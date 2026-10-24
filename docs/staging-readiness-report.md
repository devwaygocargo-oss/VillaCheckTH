# รายงาน Vercel Staging Readiness — 24 ตุลาคม 2026

**โค้ดพร้อมเตรียม deploy เมื่อปิด preflight blockers; Staging ปัจจุบันยังไม่ผ่าน Phase 1 QA** ไม่มีการ deploy หรือแก้ Vercel Settings ในรอบนี้

ฐาน source `1900926` บน `fix/autonomous-business-security-20261024` รักษา commit ก่อนหน้าและงานเดิมทั้งหมด เป้าหมายเปิด 31 ตุลาคม/ทีมขายเริ่ม 2 พฤศจิกายน 2026

## สิ่งที่ตรวจยืนยันได้จริง

| รายการ | ผล/หลักฐาน | ขอบเขต |
|---|---|---|
| Local linkage | `.vercel/project.json` ระบุ project `design-villacheck` | เป็นข้อมูล local ยังไม่ยืนยัน project/alias ปัจจุบันจาก Dashboard |
| Vercel project/deployment/env names | GET API ทั้งสามรายการตอบ 403 | ไม่ทราบ host Git branch/SHA/env values/names/runtime overrides หรือ DB target; ไม่เดาว่าตรง HEAD |
| Staging `/`, `/admin/login` | HTTP 200 ผ่าน HTTPS | เปิดหน้าได้ ไม่ได้ login หรือทดสอบ session จริง |
| `/api/health` | HTTP 200, `ok=true` | health จริง ไม่พิสูจน์ DB isolation/migration/revision หรือครบ journey |
| `/api/packages` ไม่ login | HTTP 401 ไม่ส่ง packages | ตรวจขอบเขต unauthenticated จริง |
| `/api/public/villas` | HTTP 200 มี 52 รายการขณะตรวจ | ไม่เก็บชื่อ/PII ไม่ยืนยันว่าเป็นข้อมูลสมมติหรือข้อมูลธุรกิจจริง |
| `/api/config` | HTTP 200, `paymentConfigured=true`, `demoMode=true`, ไม่พบ field paymentAccessMode | ยังไม่พิสูจน์ DISABLED; demo อาจทำให้ flag true จึงไม่อ้างว่ารับเงินจริงได้/มี Live keys แต่ต้องตรวจ host gate ก่อนทำ QA ที่เขียนข้อมูล |
| Headers | หน้ารากไม่พบ X-Frame-Options/nosniff/CSP/Referrer/Permissions ใน response; API health มี nosniff/Referrer และ no-store | ต่างจาก headers ที่ตั้งใน source ล่าสุด ต้องตรวจ artifact/host/CDN ไม่สรุป SHA จากอาการ |
| HTML | พบ `/_next/` ไม่พบ Vite-style asset pattern ที่ตรวจ | บ่งชี้ Next assets แต่ไม่ยืนยัน version/Nest/Prisma บน host |

หลักฐาน: [public-probes.json](validation/staging-readiness/public-probes.json), [host-flags.json](validation/staging-readiness/host-flags.json), [vercel-readonly.json](validation/staging-readiness/vercel-readonly.json) ไม่เปิดเผย token, env values, บัญชีธนาคาร, QR หรือข้อมูล Villa ในรายงาน

## สิ่งที่แก้ใน repository

พบ `scripts/configure-vercel.mjs` รุ่น Vite เดิมสามารถเขียนทับ `vercel.json` เป็น Vite/dist/Render rewrites ทั้งที่โครงการปัจจุบันเป็น Next/Nest full-stack เพิ่ม guard ให้ปฏิเสธก่อนเขียนเมื่อ package ใช้ Next พร้อม regression ยืนยันไฟล์เดิมไม่เปลี่ยน **ไม่ได้รัน script นี้กับ config โครงการหรือแก้ settings บน Vercel**

เพิ่ม `--staging-browser` ให้ test runner บันทึกหลักฐานรอบใหม่แยกจาก Phase 1–3 โดยใช้ชุด desktop/tablet/mobile เดิม ไม่ลดคุณภาพหรือข้าม tests เพิ่ม

## ผล local รอบนี้

PostgreSQL 262 ผ่าน/0 ล้มเหลว/0 ข้าม; SQLite 254 ผ่าน/0 ล้มเหลว/8 ข้าม; Chrome 66 ผ่าน (53 หน้า/ราคา/search/session/payment-disabled และ 13 payment UI mock) Build/Typecheck/Lint/Diff checks ผ่าน รายละเอียด [checks.json](validation/staging-readiness/checks.json)

8 รายการ SQLite ต้องใช้ PostgreSQL และตรวจครบแล้ว ไม่บวกเป็นคนละชุดใหม่ SMTP transport และ Omise boundary เป็น mock ไม่มี SMTP inbox acceptance หรือ external payment test ไม่มีการใช้ provider จริง/ส่งเมลลูกค้า/เขียนฐานภายนอก

## ข้อสรุป

- โค้ดล่าสุด: พร้อมเข้าสู่ staging deployment process หลัง Operator ยืนยัน project/env/DB และได้รับอนุญาต
- Staging เดิม: ยังไม่พร้อมยืนยันว่าอัปเดตได้อย่างปลอดภัย เพราะ Vercel read access ถูกปฏิเสธ, SHA/DB/env ไม่ทราบ และ payment gate/headers ยังไม่ตรงหลักฐานที่ต้องการ
- เริ่ม QA ที่เขียนข้อมูลได้เมื่อยืนยัน DB แยกและ gate ปิด จากนั้น deploy revision ที่ตรวจแล้วโดย Operator และผ่าน smoke tests ก่อนเปิด UAT 16 กรณี
- Production `https://villacheckth.com/` อยู่ hosting บริษัทตามข้อมูลผู้ใช้ ไม่ใช่ Vercel รายละเอียด hosting ยังไม่ทราบ ไม่ตรวจหรือเปลี่ยน production ในรอบนี้
