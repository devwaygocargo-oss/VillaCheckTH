# รายงาน Final QA / Security / Go-Live — VillaCheck Phase 2

วันที่ตรวจ: 24 ตุลาคม 2026 · เป้าหมายเปิดระบบ: 31 ตุลาคม 2026

**ผลประเมิน: NOT READY สำหรับเปิดระบบครบวงจรหรือรับเงินจริง** เหตุหลักคือยังไม่มี Omise provider acceptance จริง, Email OTP delivery acceptance, หลักฐาน configuration/backup/monitoring ของ production และ business UAT ที่ลงนาม งานที่ตรวจได้อย่างปลอดภัยใน local เสร็จแล้ว รายการภายนอกแยกเป็น blockers ไม่อ้างว่า mock เป็นผลจากผู้ให้บริการ

## ขอบเขตและหลักฐานอ้างอิง

ทำต่อบน `fix/autonomous-business-security-20261024` ตรวจ diff รอบก่อน `9e2b160..816195d` ทั้งรายการ 95 ไฟล์ แยก review source, tests, build/config และเอกสาร อ้างอิง PDF 11 หน้า, BL-01–BL-07 จากคำสั่งเจ้าของธุรกิจ และ [รายงานรอบก่อน](final-implementation-report.md) ข้อความเสนอแนะใน PDF เป็นข้อมูลประกอบ ไม่มีอำนาจสั่ง deploy/เปลี่ยนนโยบายที่ขัดกับ BL

นี่เป็นการทบทวน implementation อีกครั้งโดย agent เดิม ไม่ใช่ independent human penetration test ไม่ได้ deploy, merge, push, ใช้ live key, เรียกเก็บเงินจริง, ส่งอีเมลลูกค้าจริง หรือเชื่อมต่อ/แก้ production DB ใช้ disposable PostgreSQL บน localhost และ SQLite memory พร้อมข้อมูลสมมติ ไม่เปลี่ยน architecture/dependencies/migrations งานเดิม `.DS_Store`, `audit-results/`, `reports/` คงไว้

## บั๊กที่ยืนยันและแก้

| ID | ระดับ | ก่อนแก้ → หลังแก้ | Regression |
|---|---|---|---|
| QA-01 | HIGH | URL รูปปกอัปโหลดอ่านได้แม้ Villa pending/rejected → ตรวจสถานะและสิทธิ์ owner/Admin; guest/บัญชีอื่น 404; private/no-store | phase2-security และ operations ทดสอบ bytes/role/approved/rejected |
| QA-02 | HIGH | serverless flag ที่ Nest ใช้ภายในทำให้เชื่อ header IP ของผู้เรียก → trust เฉพาะ `VERCEL=1`, นอกนั้นใช้ socket IP; แยกจาก shared DB quota | ปลอมทั้ง forwarding headers 31 IP แล้วคำขอที่ 31 ถูก 429; Vercel fixture ระบุ platform header ชัดเจน |
| QA-03 | HIGH | QR active แต่ไม่กรอกบัญชี/เบอร์เลยได้ MATCHED → ต้องมีข้อมูลหลัง normalize อย่างน้อยหนึ่งค่า จึงพิจารณาว่าตรง | operations ตรวจ missing details เป็น REVIEW_REQUIRED และคง positive/negative/duplicate tests |
| QA-04 | HIGH | OTP provider diagnostic อาจเก็บ free-text ที่มีอีเมล/token → เก็บข้อความจาก category ที่กำหนดและจำกัด error code | login-otp ตรวจ email/OTP/opaque token ไม่อยู่ใน diagnostic |
| QA-05 | MEDIUM | health/operations probes คาดว่า protected packages ต้องตอบ 200 ทำให้แจ้งระบบล่มผิด → คาด 401 และไม่ส่ง packages; outage/การเปิดข้อมูลผิดต้อง fail | health-check และ operations-scheduling ใช้ local HTTP server ตรวจ healthy/outage/leak/alert |
| QA-07 | MEDIUM | สรุป API แสดง PAID เมื่อกลับรายการ และ ACTIVE/PROMOTIONAL เมื่อระงับ subscription → แยก FAILED/RECONCILIATION_REQUIRED, SUSPENDED/CANCELLED และ CHANGE_REQUESTED โดยคง receipt/สิทธิ์เดิม | omise-http และ phase2-journey ตรวจสถานะหลัง refresh |
| QA-06 | LOW | ข้อความแพ็กเกจบอกเปิดใช้เมื่อยืนยันสลิป → บอก payment กับ Villa approval แยกกัน | typecheck/lint และ browser pricing |

## ผล Security Review

- Authentication: ตรวจ OTP ก่อนสร้างบัญชี, cookie ผูก browser intent, role injection, OTP replay/expiry/races, legacy mailbox claim/session revocation, password compatibility, login/logout และ Admin cookie แยก ผ่าน tests ที่ตรวจบัญชี/session/hash จริง Email/OAuth provider delivery ยังจำลอง
- Authorization: ตรวจ owner isolation ทั้ง invoice/เอกสาร/สื่อ, public/Admin QR DTO, CSRF/origin และ designated bank reviewer พบและปิดช่องรูปปกตาม QA-01 **Admin ส่วนใหญ่เป็น role เดียว ไม่มี permission ราย action ทั่วระบบ** จึงไม่รับรอง limited Admin ที่ยังไม่ได้กำหนดสิทธิ์
- SQL injection: ค่าผู้ใช้ส่งผ่าน bind parameters รวม Prisma raw adapter; dynamic clauses/identifiers ที่ตรวจเป็นรายการคงที่/จำนวน placeholder และมี province injection regression ไม่พบ SQLi ที่ยืนยันได้ในเส้นทางที่ทบทวน
- XSS: จุดแสดงข้อความใช้ React escaping, CMS/รูป/ลิงก์มี protocol/MIME checks, private document preview sandbox; ไม่พบเส้นทางใหม่ที่ใช้ raw innerHTML/eval รับข้อมูลผู้ใช้ CSP ปัจจุบันป้องกัน frame/object/base ไม่ใช่ CSP สำหรับ script ทั้งระบบ
- CSRF: state-changing authenticated endpoints ตรวจ CSRF และ origin; webhook ใช้ server-side provider retrieval แทน session; อ่านสถานะ Omise อาจ reconcile ข้อมูลจริงจาก provider จึงต้องตรวจ topology/cache ของ production เพิ่ม
- Race/data integrity: อ่านสถานะใหม่ใน transaction, global advisory write lock, duplicate reference/file hash/transaction/event, OTP atomic consumption และ rollback มี tests จริงบน PostgreSQL ข้อจำกัด global lock/parallel pg client warning ยังอยู่
- Payment/subscription: paid แยก pending approval, approval หมุน QR, receipt/reversal history และ legacy invoices ไม่ถูกลบ; failed/UNKNOWN/early webhook recovery และ suspension ระหว่าง charge ต้องตรวจรับก่อนเปิด payment ดู GL-09/GL-10
- Logging: backend error ไม่ส่ง stack/SQL/provider raw response ออก HTTP; SMTP sanitized และแก้ OTP diagnostic เพิ่ม ไม่ได้ตรวจ log collector/retention บน host จริง
- Secrets/data: pattern scan source ที่อยู่ใน scope พบหนึ่ง candidate ใน `server/backup.test.mjs` เป็น URL สมมติ `remote.example` สำหรับทดสอบปฏิเสธ remote restore ไม่มี credential ผู้ให้บริการจริงที่ยืนยันจาก candidate นี้ พบ support contact/domain ที่ hardcode และ demo passwords ใน fixtures/seed ซึ่งต้องแยกจากข้อมูลลูกค้าและตรวจ production accounts จริง ไม่อ้างว่า pattern scan พิสูจน์ว่าไม่มี secret ทุกชนิด/ทุก Git history

## ผลทดสอบรอบสุดท้าย

- PostgreSQL: **247 ผ่าน / 0 ล้มเหลว / 0 ข้าม** รวม NestJS/Prisma, Next production, migration และ backup/restore บนฐานข้อมูลแยก
- SQLite: **239 ผ่าน / 0 ล้มเหลว / 8 ข้าม** รายการที่ข้ามต้องใช้ PostgreSQL
- Chrome headless: **32 checks ผ่าน** รวม 12 หน้าต่อ viewport 1440/390px, Leads direct/refresh/loading/error, QR privacy/error และ Merchant empty state
- `npm run build`, `npm run typecheck`, `npm run lint`: **exit code 0**; `git diff --check` ผ่าน
- pg ยังมี deprecation warning เรื่อง query พร้อมกันบน client เดิม ไม่ใช่ผล fail แต่ต้องวางแผน adapter concurrency ต่อไป

หลักฐาน: [checks.json](validation/phase2/checks.json), [browser.json](validation/phase2/browser.json), [source/config audit](validation/phase2/source-config-audit.json) และภาพหน้าจอใน `docs/validation/phase2/` ใช้ชุด tests เดียวกันบนสองฐานข้อมูล ไม่บวกยอดเป็นจำนวน test cases คนละชุด

## Journey coverage และความหมายของผล

| Flow | สิ่งที่ตรวจจริง | ส่วนที่ยังไม่ผ่านการตรวจรับภายนอก |
|---|---|---|
| User | HTTP signup ทั้งสอง role, captured Email OTP, ก่อนยืนยันไม่มี account/session, login/logout, listing จังหวัด/detail/QR, precheck ตรง/ผิด/ว่าง/ซ้ำ, role/CSRF denial | SMTP Inbox, provider OTP/OAuth จริง, physical-device login |
| Merchant | HTTP สร้าง Villa/Basic990–100%=0/grant ไม่มี invoice, วันสิ้นสุดไม่สร้างเอง, ขอแก้/ส่งใหม่, edit/pending/newQR/oldQR404, invoice/payment history | promo duration/paid renewal และ settlement ยังไม่กำหนด |
| Admin | HTTP ขอแก้/อนุมัติ/ปฏิเสธ/กันซ้ำ, before-after review data, approved snapshots/audit/outbox ใน DB, private outbox endpoint, bank designated reviewer; Chrome Leads direct/refresh | ไม่มี UI สำรวจ approved archive ทุก version แบบครบถ้วน; ไม่ได้ทดสอบ RBAC ที่ไม่มี implementation; Owner ส่งภายนอกยังไม่พร้อม |
| Payment | HTTP invoice ownership/server amount, positive/zero amount, mock pending/success/failure/reversal, replay/duplicate transaction/file/reference, refresh, approval แยก, exact proration/guards และ rollback | Omise จริง, source UI, early event/retry/reconciliation/operator acceptance, live readiness |

HTTP journey ใหม่ `phase2-journey.test.mjs` เริ่มจากสมัครบัญชีจริงผ่าน app จนออก QR หลัง edit และ logout จับอีเมลด้วย transport ทดสอบเพื่ออ่าน OTP ไม่ mock database/payment state ให้ผ่าน assertions ที่สำคัญ ทดสอบ Omise inject mock **เฉพาะ provider boundary** แล้วตรวจ invoice/Villa/payment counts/audit ในฐานข้อมูลจริง tests บางชุดใช้ unit mocks สำหรับ calculation/transport ซึ่งไม่เท่ากับ E2E ภายนอก

Chrome ใช้ Next production → Nest → Prisma → PostgreSQL local และ login fixtures ผ่าน HTTP; invoice ใน browser เป็น synthetic fixture เพื่อดู panel ไม่ใช่การชำระจากผู้ให้บริการ Browser ไม่ได้คลิกทุก field ของ signup/payment ตั้งแต่ต้น จึงรายงานแยกจาก HTTP journey

## UX / Responsive

ตรวจ Desktop 1440px และ Mobile 390px: Homepage, User/Merchant Registration, Login, Villa Listing/Detail, Merchant Dashboard, Pricing, Invoice/Payment, Approval Status, Admin Dashboard/Payments ไม่พบ horizontal page overflow ในชุดนี้ ตรวจภาพ Home/Desktop, Detail/Mobile, Invoice/Mobile และ Admin/Mobile ด้วยตา ไม่มี redesign

ตรวจ loading ของ Leads โดยพัก HTTP request แล้วปล่อยจริง, error เมื่อ block network, empty Merchant ที่ไม่มี Villa, QR ไม่พบข้อมูล และ Leads direct link/refresh ข้อความไทยเรื่อง payment/approval แก้ตาม QA-06 การจำลอง Chrome ไม่ใช่ iOS Safari/Android จริง และภาพหน้าจอไม่ได้พิสูจน์ทุกส่วนที่อยู่นอก viewport

## Readiness และข้อจำกัดการเปิดระบบ

[Production checklist](production-readiness-checklist.md) แสดง env ชื่อ/ความจำเป็น/สถานะ local เท่านั้น ไม่แสดงค่า secrets Production configuration ทั้งหมดถือว่ายังไม่ยืนยัน มี local SMTP/OTP configuration บางส่วน แต่ไม่ได้ทดสอบส่งจริง ไม่พบ Omise test secret ใน `.env` ที่ตรวจ

Build ไม่ migrate/seed; deployment หลักเป็น Next/Nest/Prisma ส่วน legacy PostgreSQL adapter ยังมี schema/backfill ตอน open ต้องตรวจแยก Backup/restore tests ผ่านบน DB แยก แต่ hosted scheduler, storage replication, RPO/RTO, TLS และ rollback rehearsal ต้องมี operator evidence

[Go-live blockers](go-live-blockers.md) ระบุ severity/เงื่อนไขปิดงานและขอบเขตจำกัด ปัจจุบันอนุญาตได้เฉพาะ local/staging QA ห้ามตีความผลนี้เป็น READY WITH RESTRICTIONS สำหรับ production โดยอัตโนมัติ หากจะเปิดเฉพาะข้อมูลสาธารณะ/Basic ต้องตรวจ host/auth/ข้อมูล/UAT และปิด paid endpoints ฝั่ง server ก่อน เนื่องจากปิด Omise อย่างเดียวไม่ได้ปิด manual invoice

ส่งมอบ [Business UAT](business-uat-checklist.md) 18 กรณีให้คุณเกมส์ พร้อมกลุ่ม Payment acceptance และ Pending Decisions แยก ช่อง Pass/Fail ยังเว้นให้ผู้ตรวจจริงลงนาม ไม่มีการสมมติ business policy หรือรับรอง Go-Live แทนเจ้าของธุรกิจ

อ้างอิงการแยก trust header: [Vercel request headers](https://vercel.com/docs/headers/request-headers) ระบุว่า platform overwrite `x-vercel-forwarded-for`; การทำงานหลัง proxy อื่นต้องตรวจ ingress จริงแยก
