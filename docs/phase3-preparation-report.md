# VillaCheck — Phase 3: Staging & External Integration Preparation

24 ตุลาคม 2026 · เป้าหมายเปิด 31 ตุลาคม 2026 · Branch `fix/autonomous-business-security-20261024`

**สถานะ Go-Live: NOT READY** งานเตรียมใน repository ที่ไม่ต้องใช้ credentials จริงเสร็จแล้ว ยังไม่ได้ deploy staging/production, push, merge, เปลี่ยน production DB, ใช้ live keys, เรียกเก็บเงินจริง หรือส่งเมลลูกค้า ไม่มีการเปลี่ยน business policy ที่ค้าง

## Revision และงานเดิม

เริ่มที่ `5fc7615` และรักษา commit นั้นกับ `816195d` ไว้ ตรวจ Git status ก่อนแก้: มี `.DS_Store` ที่แก้ไว้ก่อน และ untracked audit-results/reports เก็บทั้งหมดนอก commit ของงานนี้ ไม่มี reset/rebase/clean หรือเขียนทับไฟล์งานเดิม หลักฐาน Phase 2 คงไว้; ผลรอบใหม่อยู่ใน `docs/validation/phase3/`

## สิ่งที่เตรียมสำเร็จ

1. ตรวจ Next/Nest/Prisma/Vercel/Render ตาม source จริง: Vercel รัน full-stack ใน function เดียว Render เป็น backend แยกและยังไม่ได้ต่อ browser transport จาก Next ไม่มีการอ้างว่าทั้งสองเชื่อมกันอัตโนมัติ
2. Omise Test checkout UI: โหลด Omise.js เมื่อเริ่มรายการ ใช้เฉพาะ Test public key, source methods ที่ operator เปิด, server invoice amount; มี QR/authorize link, status/refresh/return, busy guard กันกดซ้ำ, failed/unknown/error/zero-net states ไม่เก็บข้อมูลบัตรหรือ secret key ใน client
3. Backend ดึง source ตรวจ id/Test/method/amount/currency ก่อนสร้าง charge, ผูก return URI จาก APP_URL + invoice และตรวจ provider URL allowlist; status/receipt/approval/dedup ใช้ flow เดิม ไม่เชื่อ URL success หรือยอดจาก client
4. เตรียม `promptpay` และ `mobile_banking_scb` เฉพาะ Test แบบ opt-in ไม่มี method เปิดเมื่อรายการว่าง ไม่ใช่การตัดสินใจเลือกวิธีรับเงินจริงแทนเจ้าของธุรกิจ
5. เพิ่ม payment access modes: DISABLED ปิดการสร้าง positive invoice/Omise charge/manual proof/confirm/QR/คำแนะนำโอน และ hold mail workers; OMISE_TEST ปิด manual ใหม่แต่เก็บ history; production-mode default DISABLED และไม่อนุญาต LEGACY_MANUAL ไม่ลบ invoice/payment/สิทธิ์เดิม
6. Staging SMTP wrapper และ Email OTP guard จำกัด exact mailbox allowlist ทั้ง SMTP และ direct Email OTP provider; allowlist ว่างส่งไม่ได้ CLI diagnostics ค่าเริ่มต้นแสดงเฉพาะชื่อ/configured boolean ไม่มี DB/network/mail และมี verify-only สำหรับ operator ใช้ภายหลัง
7. ปรับ Admin navigation ให้ใช้ staging origin และ backend Vercel host guard อ้าง APP_URL; เพิ่ม env placeholders ในตัวอย่างและ Render ปิด payment ค่าเริ่มต้น `.dockerignore` และ `.vercelignore` กัน local artifacts/credentials ออกจาก build/upload context
8. จัดคู่มือ deploy, backup/migration/restore/rollback rehearsal, external acceptance และ inventory/แผนปิด legacy manual โดยไม่รันคำสั่งกับ production

## ผล Tests รอบสุดท้าย

- PostgreSQL: **255 ผ่าน / 0 ล้มเหลว / 0 ข้าม** รวม Next/Nest/Prisma, migration/backup/restore และ HTTP integration
- SQLite: **247 ผ่าน / 0 ล้มเหลว / 8 ข้าม** ชุดที่ข้ามต้องใช้ PostgreSQL เป็น tests ชุดเดียวกัน จึงไม่บวกยอดซ้ำ
- Chrome: **44 checks ผ่าน** — desktop/mobile เดิม 32 และ Payment Test UI 12
- `npm run build`, `npm run typecheck`, `npm run lint`: **exit code 0**; `git diff --check` ผ่าน
- pg concurrency deprecation warning ของ adapter เดิมยังอยู่ เป็นงาน GL-11 ไม่ได้ refactor architecture ในรอบนี้

[หลักฐาน tests/revision](validation/phase3/checks.json) · [Payment browser](validation/phase3/payment-browser.json) · [Desktop/mobile](validation/phase3/general/browser.json)

ขอบเขตหลักฐาน: PostgreSQL/SQLite ใช้ข้อมูลสมมติในฐานแยก, HTTP tests ใช้ app จริงและตรวจ DB/ownership/amount/return URI/duplicate/rights; Omise boundary เป็น mock ทั้งหมด Chrome payment UI ใช้ Next/Nest/PostgreSQL local แต่ mock checkout/status endpoints และ SDK/redirect ผ่าน CDP เพื่อไม่เรียก provider จริง ไม่ใช้ผล UI mock แทนหลักฐาน backend transaction หรือ provider acceptance

Chrome ทดสอบ no-attempt, rapid double click, mobile layout, redirect กลับ invoice เดิมแม้ URL อ้าง success, refresh, pending/failure/success/UNKNOWN, unsafe URL, provider error, missing config และยอดศูนย์ ทดสอบ source/live-key/amount/URL mismatch, manual gates/aliases/worker hold, recipient isolation และ staging Admin host ผ่าน HTTP/ฐานข้อมูลแยกด้วย ไม่มีการ scan QR ด้วยแอปธนาคารจริง

## คู่มือและ Environment

- [คู่มือ Deploy Staging พร้อมคำสั่ง](staging-deployment-guide.md)
- [Environment names และ External Acceptance](staging-external-acceptance.md)
- [Legacy Manual Shutdown Plan](legacy-manual-shutdown-plan.md)
- ค่า environment จริงไม่อยู่ในรายงาน ใช้ private host settings/secret manager; `scripts/staging-diagnostics.mjs` ไม่พิมพ์ค่า

## สิ่งที่เจ้าของธุรกิจ/ผู้ดูแลต้องทำต่อ

| ผู้รับผิดชอบ | สิ่งที่ต้องดำเนินการ |
|---|---|
| Operator | เลือก staging project/topology + PostgreSQL แยก, ตั้ง env/TLS/ingress, deploy staging ตามคู่มือและตรวจทุก instance ใช้ revision/config เดียวกัน |
| ผู้ดูแล Omise + QA | ให้ Test keys/methods, ทดสอบ SDK/source/QR/redirect/webhook จริงทุก scenario ที่ account รองรับ; ตรวจ URL รูปแบบจริง, provider replay/recovery และรายการคลุมเครือ |
| ผู้ดูแล Email + QA | ตั้ง sender/SMTP/Test mailboxes, verify-only แล้วตรวจ Inbox/Spam/OTP จริงใน allowlist; SMS/OAuth acceptance แยกหากจะเปิด |
| Operator | Backup นอก host, migration/restore/rollback drill, RPO/RTO, pool/load/monitoring/cron evidence; production demo/บัญชีเดิมและ legacy reconciliation ต้องมีแผนแยก |
| คุณเกมส์ | ยืนยัน BL-01 promo/renewal, BL-02 settlement, BL-05 QR เก่า/visibility, BL-06 guarantee, BL-07 Owner recipient/channel และลงนาม Business UAT/อุปกรณ์จริง |

## Blockers ที่ยังเหลือ

GL-01/02/03 ยังเป็น BLOCKER: provider Test acceptance, email delivery และ hosted readiness ยังไม่ยืนยัน แม้ checkout UI/guard/คู่มือเตรียมแล้ว GL-04/05/06/07/08/09/10/12/13 ยังต้อง business/operations acceptance ตาม [Go-live blockers](go-live-blockers.md) Operator reconciliation/retry UI, early-webhook recovery และนโยบาย subscription suspension ระหว่างมี charge ค้างยังไม่ถือว่าปิดงานด้วย mock

เปิดได้ขณะนี้เฉพาะ local/staging QA ในขอบเขตที่ระบุ ไม่มี Go-live approval สำหรับเงินจริง การตั้ง mode ไม่สามารถเรียกคืนเลขบัญชี/QR ที่เคยส่งนอกระบบแล้ว และ rollback ไป app เก่าจะไม่มี gate ใหม่ จึงต้องคง ingress restriction ระหว่าง rollout/rollback
