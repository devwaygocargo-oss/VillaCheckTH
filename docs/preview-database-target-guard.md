# แผนปัจจุบัน: ใช้ Neon main ผ่าน Native Integration เดิม

คำสั่งล่าสุดของผู้ใช้แทนแผน fixed staging-preview และ signed target attestation ทั้งหมด งานนี้แก้เฉพาะ local ไม่ได้ Push/Deploy/Migrate/Seed หรือแก้ Vercel/Neon/Production ภายนอก

## สิ่งที่เปลี่ยน

คืน source ของ Prisma, runtime, migrations, backup/restore และ local tooling ให้ตรง revision 7977a9e ก่อนเพิ่มระบบ guard ถอดไฟล์ guard/tests เฉพาะระบบนี้และเครื่องมือออก attestation ออกจาก repository ไม่มีการ reset Git หรือแก้ข้อมูลเดิม งานเดิม .DS_Store/audit-results/reports คงอยู่ เก็บสำเนาโค้ดที่ถอดเฉพาะ local ใน /tmp/villacheck-withdrawn-target-guard เพื่อทบทวนได้ ไม่ใช่ artifact สำหรับ deploy

ไม่ต้องตั้ง QA_DB_TARGET_PUBLIC_KEY, QA_DB_TARGET_ATTESTATION, QA_NEON_* หรือ signing private key สำหรับแอปอีกต่อไป หากเคยตั้ง Management API key ไว้ใน Vercel ให้ผู้ดูแลตรวจ scopes และ revoke ผ่านขั้นตอนอนุมัติแยก ไม่เพิกถอน/ลบ settings อัตโนมัติ

ยังคง payment gate, auth/role checks, OTP/email allowlist, PII masking, transaction/duplicate protection, approved snapshots/QR history และข้อจำกัด remote restore/empty target เดิม การยกเลิก guard หมายถึงแอปเชื่อถือ effective DB configuration ของ operator/Native Integration อีกครั้ง ไม่มี runtime attestation ตรวจ branch ให้แล้ว

## main และ Preview มีหน้าที่ต่างกัน

ตามข้อมูลที่ผู้ใช้ยืนยัน Vercel project design-villacheck ใช้ Production Branch main และ Neon Native Integration มี Production database branch main แต่ automated Preview branching สร้าง branch จาก Neon default branch จึงไม่ควรอ้างว่า Preview ใช้ main โดยตรงหรือเป็น schema-only โดยอัตโนมัติ

แผนนี้คง Native Integration เดิม ไม่เปลี่ยน default branch/Production mapping และไม่บังคับ staging-preview อีกต่อไป ถ้าต้องการให้ทุก Preview เขียน main โดยตรงจริง ต้องระบุและอนุมัติการตั้งค่าภายนอกนั้นแยก เพราะอาจกระทบข้อมูล Staging ร่วมกัน ขณะนี้ยังไม่ยืนยัน actual deployment DB target และความแยกจาก production hosting จริง

## Environment mapping ที่โค้ดใช้

| ส่วน | ลำดับการเลือก |
|---|---|
| Prisma/runtime | DATABASE_URL → VillaCheck_DATABASE_URL |
| Migration | DIRECT_URL → DATABASE_URL_UNPOOLED → VillaCheck_DATABASE_URL_UNPOOLED → VillaCheck_POSTGRES_URL_NON_POOLING → runtime URL |
| Manual backup/restore | BACKUP_DATABASE_URL → DIRECT_URL → DATABASE_URL |

Production scope ของ project staging ต้องคง main/neondb ที่ operator ยืนยัน Preview ที่ integration สร้างต้องมี runtime/direct URL ของ deployment branch เดียวกัน อย่าคง DIRECT_URL แบบ manual ที่ชี้ main ขณะที่ DATABASE_URL ถูก inject เป็น Preview branch; DIRECT_URL มี precedence สูงกว่า injected unpooled alias การตั้งสองชื่อไว้ใน Dashboard ไม่พิสูจน์ effective values ตอน deploy

## Checklist ก่อนอนุมัติ Push/Deploy

1. Neon → project neon-citrine-xylophone → Integrations → Vercel Settings: ยืนยัน Production database branch main และ Neon default branch ที่ Preview ใช้เป็น source ไม่เปลี่ยนการตั้งค่าเอง ตรวจ main ไม่มีข้อมูล production จริงที่ห้าม QA copy หรือระบุการจัดการข้อมูลที่อนุมัติแล้ว
2. Vercel → design-villacheck → Storage → Neon resource → Projects: ตรวจ connection scope/automated Preview branching/prefix ปัจจุบัน คง integration เดิม ตรวจ endpoint-to-branch mapping ของ actual deployment แบบไม่เปิดเผย URI หากไม่มีสิทธิ์ให้ผู้ดูแลตรวจหน้าจอหรือ Support ไม่เดา
3. Settings → Environment Variables → Production/Preview และ branch overrides: ตรวจ runtime/direct/backup variables ตามตาราง ไม่ให้ migration/backup ชี้คนละ branch กับแอป ไม่ลบ provider-managed variables โดยเดา ไม่แก้ Production scope ในรอบ local นี้
4. คง PAYMENT_ACCESS_MODE=DISABLED, OMISE_TEST_ENABLED=false, APP_ENV=staging, COOKIE_SECURE=true, DEMO_MODE=false, SEED_DEMO_ACCOUNTS=false และ SEED_PUBLIC_DEMO_DATA=false; DB system_settings.demo_mode อาจ override env ต้องตรวจตามสิทธิ์
5. APP_URL ต้องตรง HTTPS origin ที่อนุมัติจริง Preview ไม่ derive จาก VERCEL_URL ในโค้ด วางแผน stable origin/การตั้งค่าหลังรู้ URL จริงก่อนเริ่ม auth/OTP/write QA ไม่เดา URL
6. OTP_SECRET ใช้ QA secret อย่างน้อย 32 ตัว, STAGING_EMAIL_ALLOWLIST เป็น exact QA inbox ตรวจ SMTP_* และ CMS email OTP template ที่อาจ override ไป ThaibulkSMS; allowlist ไม่คุม SMS ห้ามส่งจริงโดยไม่มีอนุมัติ
7. ตรวจ schema/migration history และข้อมูล Admin/catalog ของฐานเป้าหมายแบบ read-only ก่อน API แรก Build ใช้ npm run build ไม่มี migrate/seed แต่ runtime bootstrap สามารถเขียน catalog/Admin ได้ ห้ามเพิ่ม migration เข้า Build Command หรือรัน migration/seed เพียงเพราะถอด guard แล้ว
8. ตรวจ diff/Commit เฉพาะเอกสารที่เปลี่ยนแผนและไฟล์ที่จำเป็น ไม่รวมงานผู้ใช้ .DS_Store/audit-results/reports หาก runtime ตรง HEAD อยู่แล้วไม่ต้องสร้าง commit ปลอมเพื่อ deploy
9. หลังได้รับอนุมัติ Push feature branch ไป origin เพื่อ Preview ตรวจ project/SHA/Environment/DB mapping/payment off และ QA ก่อน PR ไป main การ merge main เพื่ออัปเดต design-villacheck.vercel.app ต้องอนุมัติแยก ไม่ใช่ผลจาก Push feature branch
10. เก็บ previous deployment/SHA/env mapping และ DB compatibility สำหรับ rollback โดย operator ไม่ restore/reset/delete DB ไม่ย้ายข้อมูล Preview กลับ main และไม่แตะ villacheckth.com

ยัง BLOCKED จน operator ยืนยัน actual environment/DB mapping, data classification/isolation, schema/bootstrap และ QA inbox/APP_URL ไม่มีการตรวจ Omise/SMTP จริงในงาน local นี้

## ผลตรวจ local หลังเปลี่ยนแผน

- Runtime/backend/scripts/prisma.config.ts ตรง HEAD 7977a9e ทุกไฟล์ ไม่มี guard/attestation imports เหลือ
- Automated suite: 262 tests, ผ่าน 254, ล้มเหลว 0, ข้าม 8 ที่ต้องใช้ PostgreSQL แยก ไม่ใช้ผลนี้อ้างว่าทดสอบ Neon จริง
- npm run build, npm run typecheck, npm run lint และ git diff --check ผ่าน
- Test รอบแรกติด sandbox ห้ามเปิด localhost; รันซ้ำเมื่ออนุญาต local server แล้วผ่าน ไม่ใช่บั๊กแอป
- ไม่มีการทดสอบฐานข้อมูลภายนอก, SMTP/OTP/SMS หรือ payment provider จริง ไม่มี Push/Deploy/Commit ในรอบนี้

## Demo Villas visibility switch

Admin → ตั้งค่าระบบ → แสดงที่พักสาธิตจากฐานข้อมูล → แสดง Demo Villas → บันทึกการแสดง Demo Villas

อ่านรายการจากฐานข้อมูลของ deployment จริง และบันทึก boolean ใน system_settings key public_demo_villas_visible ผ่าน /api/admin/settings/demo-villas ไม่เพิ่ม schema/migration และไม่ seed ค่าเริ่มต้นเมื่อไม่มี setting คือแสดง เพื่อรักษาพฤติกรรมเดิม

ปิดแล้วซ่อนจาก public listing ที่หน้าค้นหาและส่วนรายการที่พักหน้าแรกใช้ร่วมกัน ก่อน pagination เปิดแล้วคืนรายการที่ยังผ่าน approval/ACTIVE ตามกฎเดิม ไม่ต่ออายุ ไม่แก้สิทธิ์ ไม่ลบ Villa/Invoice/เอกสาร Admin ยังเห็นข้อมูล QR โดยตรงและโฆษณาแยกใช้กฎเดิม สวิตช์นี้ไม่ใช่การเพิกถอน QR หรือซ่อนทุก public resource ผู้เปิดหน้าเดิมค้างต้อง refresh

ระบุ Demo จาก villa.email รูปแบบ demo-...@villacheck.example ร่วมกับ merchant label สาธิตเดิมของ seed ไม่เดาจากชื่อที่พัก Public ได้เพียง isDemo พร้อมข้อความข้อมูลสาธิต ไม่ส่ง email/PII หากข้อมูล Neon เปลี่ยน label/email แล้วต้องตรวจจำแนกแยก ไม่เดาแล้วแก้ข้อมูลจริง

เฉพาะ Admin เปลี่ยนได้ ผ่าน auth/CSRF เดิม มี audit เมื่อค่าเปลี่ยน ไม่เพิ่ม audit ซ้ำเมื่อส่งค่าเดิม และปฏิเสธค่าที่ไม่ใช่ boolean สวิตช์แยกจาก Demo Mode การเงิน/อีเมล

ผล local: 263 tests ผ่าน 255/ล้มเหลว 0/ข้าม 8 ที่ต้องใช้ PostgreSQL; Build/Typecheck/Lint และ diff checks ผ่าน ยังไม่ได้อ่านหรือเปลี่ยน setting บน Neon จริง ยังไม่มี Commit/Push/Deploy ของฟีเจอร์นี้ ผู้ดูแลต้องยืนยัน target ก่อนทดสอบ Admin QA เปิด–ปิด/refresh บน Preview โดยไม่ seed
