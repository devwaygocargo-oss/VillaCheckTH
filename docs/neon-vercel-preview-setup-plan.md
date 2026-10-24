# Neon & Vercel Preview — ผลตรวจและแผนที่รออนุมัติ

24 ตุลาคม 2026 · Branch `fix/autonomous-business-security-20261024` · Source เริ่มงาน `1630e40`

**สถานะ: เตรียม local/source พร้อม แต่ NO-GO สำหรับสร้าง branch/เปลี่ยน settings/Push จนผ่าน approval gates** ไม่มีการสร้าง/ลบ/reset Neon branch, ต่อฐานภายนอก, migration/seed/backup/restore ภายนอก, Push/Merge/Deploy หรือส่ง OTP/SMS/Email จริง

ข้อมูลจากผู้ใช้: GitHub `devwaygocargo-oss/VillaCheckTH`/origin, Vercel `design-villacheck` Production Branch main ใช้ Production environment เป็น staging, Neon project ชื่อ `neon-citrine-xylophone`, branch `main`, DB `neondb`, integration variables อยู่ Production/Preview และเพิ่ม staging flags แล้วแต่ยังไม่ตรวจ effective values ข้อมูลเหล่านี้เป็น user-confirmed ไม่ใช่ผลอ่าน Neon/host จาก agent

## 1. GitHub / Vercel / Neon Access

| ระบบ | ตรวจได้จริง | ข้อจำกัด |
|---|---|---|
| GitHub | git ls-remote origin สำเร็จ; main=`9e2b160`; ไม่พบ branch งาน | ไม่มี gh CLI/token ใน environment/ไฟล์ local ที่ตรวจ; ไม่ทดสอบ write permission หรือ Push |
| Vercel | มี local linkage และ auth file; GET project/alias/env ทั้งสามตอบ 403 อีกครั้ง | ไม่มี vercel CLI; ไม่เห็น effective values/scopes/deployment SHA จาก API ไม่เปลี่ยน auth/settings |
| Neon | ไม่พบ neon/neonctl CLI, NEON_API_KEY/NEON_PROJECT_ID ใน environment/.env และ auth ในตำแหน่งที่ตรวจ | ไม่มีเครื่องมือเชื่อมต่อที่ให้สิทธิ์ Neon; ไม่ถาม API แบบไม่มี auth และไม่ต่อ SQL; project/branch/database เป็นข้อมูลผู้ใช้ |

credential-presence check เก็บเฉพาะ boolean ไม่เก็บ token/value การไม่พบในตำแหน่งที่ตรวจไม่พิสูจน์ว่าเครื่องไม่มี credential ที่อื่น ไม่สแกน keychain/browser session หรือค้น secrets ทั้งเครื่อง

## 2. Database Isolation

| รายการ | ผลยืนยันรอบนี้ | เงื่อนไขก่อนอนุมัติ |
|---|---|---|
| Staging ใช้ main/neondb ของ project นี้จริง | **ยังไม่ยืนยัน** | เทียบ effective Vercel URL precedence กับ Neon resource/branch/database IDs ใน Dashboard ส่วนตัว |
| Production DB จริงแยกจาก Staging | **ยังไม่ยืนยัน** | ต้องมี inventory DB ของ hosting บริษัท/production จริง ห้ามสรุปว่าไม่มีเพราะเว็บอยู่ในอนาคต |
| Preview ใช้ฐานเดียวกับ main หรือไม่ | **ยังไม่ยืนยัน** | ชื่อ integration อยู่ทั้ง scopes ไม่พิสูจน์ว่าค่าเท่ากัน/ต่างกัน; ตรวจ deployment-injected overrides ด้วย |
| staging-preview มีอยู่แล้วหรือไม่ | **ยังไม่ยืนยัน** | ดู Neon Branches ก่อนสร้าง ห้ามสร้างซ้ำ/reset ของเดิมโดยเดา |
| ข้อมูลจริงใน main | **ยังไม่ยืนยัน** | เจ้าของข้อมูลยืนยันชนิดข้อมูล/ความลับ/สิทธิ์ก่อนเลือกวิธี branch |

### ความเสี่ยงของ branch แบบปกติ

Neon branch ปกติเป็นสำเนาที่แยกการเปลี่ยนแปลงได้ แต่เริ่มต้นมีข้อมูลจาก source ไม่ใช่ฐานว่าง อาจนำ users/password hashes/session/OTP, อีเมล/โทรศัพท์/บัญชี, เอกสารเจ้าของบ้าน/ภาพ, invoice/payment history, CMS settings/queues/audits ไป Preview ด้วย [Neon branching](https://neon.com/docs/concepts/branch-your-backend)

การไม่มีเงินจริงใน Preview ไม่ทำให้ข้อมูลส่วนบุคคลปลอดภัยโดยอัตโนมัติ การเปลี่ยน OTP_SECRET ไม่ลบ users/sessions/queues ที่คัดลอก และ Email allowlist ไม่คุม SMS จึงไม่เสนอสร้างสำเนาข้อมูลทั้งหมดแล้วล้างภายหลังโดยไม่ได้อนุมัติ

### แผนแนะนำที่ยังไม่ทำ

สร้าง **schema-only root branch ชื่อ staging-preview** โดยใช้ schema จาก main หลังผู้ดูแลตรวจ source/quota/สิทธิ์ Neon รองรับ Schema only ใน Console โดยไม่คัดลอก table data และ branch แบบนี้เป็น root แยก ไม่ใช่ child ที่ reset จาก parent ได้; restore จาก source ภายหลังอาจนำ data กลับมา จึงห้าม reset/restore โดยเดา [Neon schema-only](https://neon.com/docs/guides/branching-schema-only)

- ต้องยืนยัน project ID/branch ID จริง ไม่เอาชื่อ neon-citrine-xylophone ใส่ช่อง project ID ของ CLI โดยคาดเดา
- ถ้า option Schema only/โควตาไม่พร้อม ให้ BLOCKED ไม่ fallback เป็น full-data branch อัตโนมัติ ทางเลือกฐานใหม่ว่างต้องได้รับอนุมัติแยก
- schema-only ไม่มี app/CMS/ผู้ใช้/ประวัติ migration data ให้ตรวจ `_prisma_migrations` กับ schema จริงก่อนใช้ deploy-db script ห้าม mark applied ทั้งชุดโดยเดา และไม่เพิ่ม migration เข้า build
- จัดบัญชี Admin QA/role/OTP secret แยกและ QA data สมมติเท่านั้น ภายหลังอนุมัติ external bootstrap/seed โดยแผนแยก ไม่คัดลอก Admin หรือ credentials ของลูกค้า
- เช็ค extensions/triggers/schema defaults/DB functions/integration services ด้วย การไม่คัดลอก table rows ไม่ได้พิสูจน์ว่าไม่มี secret ฝังใน schema หรือ provider settings

## 3. Environment Configuration

แผนเลือก **fixed branch staging-preview** สำหรับ Preview QA ชุดนี้ ไม่เปิด automated per-deployment branching เพิ่มเอง ดู matrix ใน [Preview environment template](neon-preview-environment-template.md)

| ขอบเขต | Production scope ของ project staging | Preview scope ที่เสนอ |
|---|---|---|
| Runtime DB | คง main/neondb หลังตรวจว่าเป็น staging จริง | staging-preview/neondb เท่านั้น |
| DATABASE_URL / VillaCheck_DATABASE_URL | อ่าน DATABASE_URL ก่อน prefixed alias | ทุกค่าที่มีผลต้องเป็น Preview branch; ไม่ทิ้ง fallback ชี้ main |
| Direct/unpooled aliases | คง target staging หลัก | ชี้ Preview branch เดียวกับ runtime; ไม่ใช้ main direct URL |
| Backup URL | ตรวจแยกตาม operator job | ไม่รับ main/prod backup target; web Preview ไม่ต้องรัน backup |
| Payment | DISABLED และ Omise Test=false ต้องตรวจค่า effective | DISABLED/false เหมือนกัน |
| Demo | env false และตรวจ DB demo_mode แยก | env false; ใช้ข้อมูล QA ที่อนุมัติ ไม่ seed อัตโนมัติ |
| Email/OTP | APP_ENV staging + exact test allowlist | secret/allowlist/sender แยกตามที่อนุมัติ; ไม่มีลูกค้า |
| APP_URL | https://design-villacheck.vercel.app | approved Preview QA origin จริง ไม่เดา hostname |

Source: `backend/prisma.service.ts`, `server/index.mjs`, `server/payment-access.mjs`, `server/login-otp.mjs`, `server/staging-mail.mjs`, `server/demo-payment.mjs`, `scripts/deploy-db.mjs`, `scripts/application-backup.mjs` รายละเอียดครบใน [Environment Mapping](vercel-staging-environment-mapping.md)

**ตรวจชนิด integration ก่อนเปลี่ยน scope:** Vercel-managed Neon integration อาจมี automatic Preview Branching ที่สร้าง branch และ inject connection variables ตอน deployment ทับค่า Preview settings ดังนั้นดูเพียงหน้า env ไม่พอ ไม่เปิด automatic branching หรือเพิ่ม migration ใน build ตามตัวอย่าง provider โดยไม่ได้รับอนุมัติ [Native integration](https://neon.com/docs/guides/vercel-managed-integration)

ถ้า integration ปัจจุบันผูก main ทั้งสอง scopes ให้เสนอปรับเฉพาะ Preview connection/automatic injection policy ของ project นี้ แล้วใช้ fixed Preview URLs ที่อนุมัติ คง Production mapping ไว้ ห้าม disconnect integration ทั้ง project หรือลบ global variables ถ้า UI บังคับค่าหรือมี auto-branch policy อยู่ ต้องให้ Operator ตรวจวิธีที่รองรับจริงก่อน ไม่มีการรับรองว่า manual override จะชนะ webhook เสมอ

## 4. Git & Deploy Readiness

| รายการ | ผล |
|---|---|
| Branch/HEAD เริ่มงาน | fix/autonomous-business-security-20261024 / 1630e40 |
| Local commits ต่อจาก origin/main | 8 commits เริ่มงาน; รักษาทั้งหมด ดู evidence สำหรับ full SHAs |
| Runtime ที่ยังไม่ commit | ไม่มี ตรวจ src/server/backend/scripts/app/pages/prisma/package files |
| งานผู้ใช้ที่ไม่เกี่ยวกับ deploy | .DS_Store 1 tracked modification + 216 untracked audit-results/reports คงไว้ทั้งหมด |
| ไฟล์จำเป็นที่ commit แล้ว | ตรวจ 15 จุดหลัก: app/API/Nest/Prisma/build script/payment/package lock/Next/Vercel config; ไฟล์ generated อยู่ ignore และสร้างจาก build |
| Build / Typecheck / Lint | ผ่านรอบนี้ |
| SQLite / PostgreSQL | 254 ผ่าน+8 ข้าม / 262 ผ่าน+0 ข้าม (ชุดเดียวกัน) |
| Chrome Phase 1 | 53 ผ่าน desktop/tablet/mobile ใช้ local Next + DB; SMTP boundary mock ไม่ใช่ host acceptance |

หลักฐาน [checks.json](validation/neon-preview/checks.json), [browser.json](validation/neon-preview/general/browser.json), [Vercel read-only](validation/neon-preview/vercel-readonly.json) ไม่เขียนทับ evidence รอบก่อน ไม่ rerun payment UI Phase 2; payment-disabled backend tests อยู่ใน suite ที่ผ่านแล้ว

## 5. Blockers

| ID | ระดับ | Blocker | เงื่อนไขปิด |
|---|---|---|---|
| NP-01 | BLOCKER | Vercel API 403; ไม่ทราบ effective scopes/branch injection/SHA | ดิว/Operator ตรวจ Dashboard หรือให้สิทธิ์ read-only ที่ถูกต้อง |
| NP-02 | BLOCKER | ไม่มี Neon read access; main/neondb mapping และ branch เดิม/ข้อมูลจริงไม่ทราบ | Operator ตรวจ project/branch/database IDs, data classification และ quota |
| NP-03 | BLOCKER | production DB จริงยังไม่ทราบ จึงพิสูจน์ isolation ไม่ได้ | inventory DB ของ hosting จริง และเทียบ resource/role/branch โดยไม่แชร์ secrets |
| NP-04 | BLOCKER | ยังไม่อนุมัติสร้าง staging-preview หรือเปลี่ยน Preview variables | อนุมัติข้อเสนอ schema-only + scope plan หลังอ่านความเสี่ยง |
| NP-05 | HIGH | schema-only bootstrap/migration history/QA Admin ยังไม่มีผลตรวจ host | Operator อนุมัติและตรวจแผนเฉพาะ branch ใหม่ ไม่ตั้ง baseline/seed โดยเดา |
| NP-06 | HIGH | Preview origin/APP_URL, SMTP/SMS safety และ effective payment ยังไม่ตรวจรับ | ยืนยัน env/host; exact QA recipients; ปิดเส้นทางนอก scope และ post-deploy checks |

## 6. ขั้นตอนถัดไปที่ดิวต้องอนุมัติ

| ลำดับ | ชุดการอนุมัติที่เป็นรูปธรรม | ผลที่จะเปลี่ยนภายนอก |
|---|---|---|
| A | ตรวจ/ให้ read-only access แล้วเซ็นผล mapping/data classification | ยังไม่สร้าง branch/ไม่แก้ env |
| B | สร้าง staging-preview แบบ schema-only จาก schema main ใน project ที่ตรวจแล้ว และ QA role/compute ตามที่กำหนด | Neon branch/root/storage/compute และค่าใช้จ่ายอาจเพิ่ม; ไม่คัดลอก table data |
| C | กำหนด connection variables/Preview injection policy และ flags ตาม template เฉพาะ Preview | เปลี่ยน Vercel Preview settings/Integration scope; Production/main คงเดิม |
| D | ตรวจ schema/migration history และ bootstrap QA Admin/data เฉพาะ branch ใหม่ | external DB writes ที่ต้องอนุมัติแยก ไม่ทำก่อนทราบ target |
| E | Push feature branch เพื่อ Preview, ตั้ง APP_URL ให้ตรง approved URL ถ้าต้องมี redeploy ให้ระบุด้วย แล้วทำ QA | GitHub/Vercel Preview deployment ไม่ใช่ URL หลัก |
| F | PR review/คุณเกมส์ UAT แล้วอนุมัติ Merge main และ staging deployment | main และ URL staging หลักเปลี่ยน ไม่เกี่ยวกับ production website ในอนาคต |

ไม่มีชุดใดได้รับอนุมัติหรือดำเนิน mutation แล้วใน session นี้ รายละเอียดคำสั่ง/rollback ใน [Runbook](neon-preview-approval-and-release.md)


## ข้อขาดที่พบในการทบทวน Preview readiness

Runbook เดิมยังไม่ได้เน้น default auto-delete ของ Console เพียงพอ เพิ่มการตรวจ Automatically delete branch after/expiry และ integration association แล้ว ทั้ง schema-only root และชื่อ staging-preview ไม่ใช่หลักฐานว่าไม่มีวันหมดอายุหรือไม่มี cleanup ต้องยืนยันบน Dashboard จริงก่อนอนุมัติ deployment ไม่ได้เปลี่ยน Neon/Vercel settings ในรอบทบทวน

ดู [Neon schema-only](https://neon.com/docs/guides/branching-schema-only), [Branch expiration](https://neon.com/docs/guides/branch-expiration) และ [Cleanup](https://neon.com/docs/guides/vercel-branch-cleanup) ผล local QA เดิมยังเป็นหลักฐาน code เท่านั้น ไม่ยืนยัน branch lifetime บน host
