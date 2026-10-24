# Environment Mapping — Vercel Project Staging

24 ตุลาคม 2026 · Source เริ่มตรวจ `7b147a8` · Branch `fix/autonomous-business-security-20261024`

ข้อมูลที่ผู้ใช้ยืนยันจาก Dashboard: project `design-villacheck`, Git repo `devwaygocargo-oss/VillaCheckTH`, Production Branch `main`, URL `https://design-villacheck.vercel.app/`, Integration กลุ่ม `VillaCheck_*` มี scope Production และ Preview, SMTP/OTP/ThaibulkSMS/APP_URL มีใน Production และจากภาพยังไม่พบ PAYMENT_ACCESS_MODE/OMISE_TEST_ENABLED งานนี้ตรวจ source เท่านั้น ไม่อ่านค่า secrets/host env ไม่ต่อ DB/บริการภายนอก และไม่แก้ settings

**Production environment ใน project นี้ใช้สำหรับเว็บ Staging ไม่ใช่ production hosting ของบริษัท** ใช้ APP_ENV=staging เพื่อเปิดข้อจำกัดผู้รับอีเมล โดยยังใช้ production build/runtime ตามปกติ

## 1. DATABASE_URL ต้องเพิ่มหรือไม่

**ไม่จำเป็นต้องเพิ่มซ้ำเพื่อให้ Nest/Prisma ทำงาน หาก `VillaCheck_DATABASE_URL` มีค่าที่ถูกต้องใน target scope** ชื่อ case-sensitive และมีลำดับดังนี้:

| เส้นทาง | ลำดับการเลือกค่าใน source |
|---|---|
| Nest/Prisma runtime | `DATABASE_URL` → `VillaCheck_DATABASE_URL` ใน `backend/prisma.service.ts` |
| Domain/startServer และ legacy Vercel adapter | normalize `DATABASE_URL` → `VillaCheck_DATABASE_URL` ก่อนเริ่ม |
| Prisma config/CLI generate | `DATABASE_URL` → `VillaCheck_DATABASE_URL` → dummy localhost URL สำหรับ config; fallback dummy ไม่ใช่ฐานจริงหรือ SQLite fallback ใน Nest |
| Deploy migration script | `DIRECT_URL` → `DATABASE_URL_UNPOOLED` → `VillaCheck_DATABASE_URL_UNPOOLED` → `VillaCheck_POSTGRES_URL_NON_POOLING` → (`DATABASE_URL` หรือ `VillaCheck_DATABASE_URL`) |
| Manual backup/restore CLI | `BACKUP_DATABASE_URL` → `DIRECT_URL` → `DATABASE_URL` **ไม่อ่าน VillaCheck_DATABASE_URL โดยตรง** |
| Scheduled backup | ต้องมี `BACKUP_DATABASE_URL`, `BACKUP_SECRET`, `BACKUP_DIR`; ไม่ใช้ prefixed fallback |
| Demo seed scripts | runtime DB เลือก `DATABASE_URL` → `VillaCheck_DATABASE_URL`; ไม่สั่งในงานนี้ |

หากมี DATABASE_URL เดิมที่ชี้ผิด มันจะชนะ integration alias แม้ VillaCheck_DATABASE_URL ถูกต้อง อย่าเพิ่ม URL ชุดใหม่โดยเดาหรือเก็บสองชื่อให้ชี้ต่างฐาน ถ้าคงเฉพาะ prefixed URL ให้ backup tooling ใช้ BACKUP_DATABASE_URL/DIRECT_URL ที่ตรวจ target แล้ว ไม่บังคับเพิ่ม DATABASE_URL เพียงเพื่อ backup

Migration script เลือก direct URL และส่งเป็น DATABASE_URL ให้ Prisma child process; Neon pooler hostname มี logic แปลงเป็น direct ใน scriptเดิม แต่ไม่ถือว่าได้ยืนยัน provider/endpoint ของโครงการจริง Runtime schema ใช้ query `schema`, หรือ `options` search_path, หรือ default public ต้องเทียบ direct/backup schemaให้สอดคล้อง

Source: `backend/prisma.service.ts`, `prisma.config.ts`, `server/index.mjs`, `server/legacy-vercel.mjs`, `scripts/deploy-db.mjs`, `scripts/migration-runner.mjs`, `scripts/application-backup.mjs`, `scripts/scheduled-backup.mjs`

## 2. รายการเพิ่ม/ตรวจใน Production scope ของ project Staging

ค่าในตารางเป็น non-secret ที่แนะนำจาก logic จริง ไม่อ้างว่าบน Dashboard มี/ไม่มีแน่นอนนอกเหนือข้อมูลที่ผู้ใช้แจ้ง

| ชื่อ | ค่า/การดำเนินการ | เหตุผล |
|---|---|---|
| `PAYMENT_ACCESS_MODE` | เพิ่ม `DISABLED` | global gate สำหรับ positive invoice/Omise/manual proof/confirm/QR/instructions และ workers |
| `OMISE_TEST_ENABLED` | เพิ่ม `false` | โค้ดเปิด Test integration เฉพาะ string true; Phase 1 ไม่ใช้ payment |
| `APP_ENV` | เพิ่ม/ตรวจ `staging` | เปิด email recipient allowlist ทั้ง SMTP wrapper และ direct Email OTP |
| `APP_URL` | ตรวจ `https://design-villacheck.vercel.app` | canonical origin/allowedOrigins/redirect/Admin host บน Vercel; ไม่ใช้ localhost หรือ villacheckth.com |
| `DEMO_MODE` | ตรวจ `false` | ปิด env default เท่านั้น ต้องตรวจ CMS/DB demo_mode แยก |
| `SEED_DEMO_ACCOUNTS` | ตรวจ `false` | production-mode ห้าม true; Nest DomainService บังคับ false อีกชั้น |
| `SEED_PUBLIC_DEMO_DATA` | ตรวจ `false` | manual public demo seed opt-in; build ไม่เรียก seed อยู่แล้ว |
| `COOKIE_SECURE` | ตั้ง `true` ได้เพื่อระบุเจตนาชัด | NODE_ENV production บังคับ Secure อยู่แล้ว ไม่ใช่ตัวแบ่ง staging/production |
| `FACEBOOK_LOGIN_ENABLED` | หากยังไม่ตรวจรับให้ตรวจ `false` | CMS business setting สามารถ override flag นี้ ไม่ใช่ kill switch ของ OAuth ทั้งระบบ |
| `PUBLIC_URL` | ถ้าใช้ monitoring ให้เป็น `https://design-villacheck.vercel.app` | health/operations target; ไม่ใช่ตัวเลือก DB หรือ APP_URL fallback |
| `STAGING_EMAIL_ALLOWLIST` | เพิ่มรายชื่อ QA inbox ที่ได้รับอนุญาต คั่น comma ไม่มี wildcard | เป็นข้อมูลผู้รับที่ผู้ดูแลต้องกำหนด ไม่ใส่อีเมลลูกค้าหรือค่าตัวอย่างที่ส่งไม่ได้ |

`NODE_ENV` ใช้เช็ค production guards/default payment ใน source ให้คง production runtime ของ release ไม่ตั้ง development เพียงเพราะชื่อเว็บเป็น staging ใช้ APP_ENV แยกแทน `VERCEL=1` ใช้ trust ingress ให้ platform จัดการ ไม่ปลอมค่าในเครื่องหรือ Render

ไม่ต้องเพิ่ม Omise keys/methods ใน Phase 1 ไม่เปิดเผยหรือใช้ Live keys `PAYMENT_VERIFICATION_MODE=MANUAL` **ไม่ใช่ payment off switch** และ DEMO_MODE=false ก็ไม่ปิดการรับชำระแทน DISABLED

### ค่าลับ/ผู้ให้บริการที่ต้องตรวจโดยไม่แสดงค่า

| ชื่อจริง | Requirement/พฤติกรรม |
|---|---|
| `OTP_SECRET` | ต้องมี string ยาวอย่างน้อย 32 ตัวอักษรสำหรับ OTP ใช้ secret แยกจาก production; ไม่พิมพ์ค่า |
| `SMTP_HOST`, `SMTP_FROM` | ทั้งคู่ต้องมีเพื่อสร้าง SMTP transport |
| `SMTP_PORT`, `SMTP_SECURE` | ตาม provider: source default 587/STARTTLS; 587 ใช้ false และ requireTLS=true; 465 ใช้ true อย่าเลือก port ขัด provider |
| `SMTP_USER`, `SMTP_PASSWORD` | ใช้ auth เมื่อ SMTP_USER มีค่า ต้องเป็น credential ของ sender ที่อนุญาต ไม่ใช่เพียงชื่อที่ตั้งแล้วถือว่าส่งได้ |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | ใช้ bootstrap ถ้ายังไม่มีบัญชี; password อย่างน้อย 12 ตัวเมื่อกำหนด ไม่ overwrite บัญชีเดิม; production runtime ต้องมี Admin อยู่แล้วหรือสร้างผ่าน config ที่ถูกต้อง |
| `CRON_SECRET` | ตรวจเมื่อเปิด cron; ไม่วางใน NEXT_PUBLIC/VITE |
| `BACKUP_DATABASE_URL`, `BACKUP_SECRET`, `BACKUP_DIR`, `BACKUP_SCHEMA`, `BACKUP_RETENTION_DAYS` | สำหรับ operator/backup job นอก ephemeral storage ไม่จำเป็นต้องใส่ทั้งหมดใน Vercel web runtime ถ้า job รันที่อื่น ต้องตรวจ target แยก |
| `DIRECT_URL`/unpooled aliases | ตรวจเมื่อทำ migration/direct operations; อย่าเพิ่มโดยคัดลอก pooled URL แบบไม่ตรวจ |

## 3. OTP/ThaibulkSMS — ไม่เดาช่องทางจากการมี credentials

Source อ่าน `THAIBULKSMS_API_KEY`, `THAIBULKSMS_API_SECRET`, `THAIBULKSMS_EMAIL_OTP_TEMPLATE_ID`, `THAIBULKSMS_OTP_KEY`, `THAIBULKSMS_OTP_SECRET`, `THAIBULKSMS_SENDER` ตามชื่อเหล่านี้ตรงตัว

- Email: หากมี template ID ที่มีผล จะใช้ direct Email OTP provider พร้อม API key/secret; ถ้าไม่มีจึงใช้ SMTP + SMTP_FROM
- CMS `business.emailOtpTemplateId` มี precedence เหนือ env template ID เมื่อไม่ว่าง จึงตั้ง SMTP ครบแล้วยังอาจส่งผ่าน provider อื่น ต้องตรวจ CMS โดยผู้มีสิทธิ์ ไม่แก้ DB เอง
- SMS: ถ้ามี OTP key/secret ครบใช้ OTP service; มิฉะนั้นอาจใช้ SMS API key/secret + sender ตามเงื่อนไข source
- **STAGING_EMAIL_ALLOWLIST คุมเฉพาะ Email ไม่คุมเบอร์ SMS** ไม่มี SMS_ENABLED/SMS_ALLOWLIST ใน code ที่ตรวจ ห้ามสร้างชื่อ flag ขึ้นมาเอง หาก SMS อยู่นอก Phase 1 ต้องให้ Operator ทบทวน scope ของ SMS credentials/sender หรือมาตรการ ingress ที่อนุมัติไว้ โดยไม่กระทบ Email provider ที่ใช้ API keys ร่วม และไม่ลบค่าหรือส่ง SMS เองในงานนี้
- การมี credentials/otpChannels แสดง enabled ไม่ใช่หลักฐานส่งถึง; การตรวจ inbox/provider จริงต้องทำหลัง DB isolation และ allowlist พร้อม

Source: `server/login-otp.mjs`, `server/cms-business.mjs`, `server/staging-mail.mjs`, `server/smtp-diagnostics.mjs`, `server/index.mjs`

## 4. Demo Mode และ payment precedence

`server/demo-payment.mjs` เลือก DEMO payment mode ก่อน แล้วอ่าน `system_settings.demo_mode` ถ้ามี DB value จะชนะ config.DEMO_MODE จึง `DEMO_MODE=false` ไม่พิสูจน์ว่า demoMode=false บน API ห้ามลบ/แก้ setting เอง ให้ Admin/Operator inventory และจัดการภายหลังด้วยสิทธิ์ที่อนุมัติ

แม้ demoMode=true ถ้า **โค้ดล่าสุด** รับ PAYMENT_ACCESS_MODE=DISABLED จะให้ paymentConfigured=false และ gate ปิด อาการ host เก่าที่ paymentConfigured=true จึงไม่ใช้เป็นข้อพิสูจน์ default ของโค้ดใหม่ Node production และไม่พิสูจน์ว่ารับเงินจริงได้

`server/payment-access.mjs` default production เป็น DISABLED เมื่อ env ไม่กำหนด; non-production default LEGACY_MANUAL จึงควรตั้ง DISABLED ชัดทุก scope ไม่ใช่รอ default ไม่จำเป็นต้องเปิด OMISE_TEST mode เพื่อปิด manual เพราะ Phase 1 ต้องปิดทั้งคู่

## 5. ตัวแปร Vite/Integration เก่า — ทบทวน ไม่ลบเอง

| ชื่อ/กลุ่ม | ผลค้น source |
|---|---|
| `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE`, `VITE_FACEBOOK_URL`, `VITE_INSTAGRAM_URL` | ยังอ่านเป็น fallback ใน next.config.mjs เมื่อ NEXT_PUBLIC ตัวที่คู่กันไม่มีค่า ไม่ใช่ unused ทั้งหมด |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE`, `NEXT_PUBLIC_FACEBOOK_URL`, `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_LINE_URL` | public contact/links ใช้ใน Next config และ src/support.ts; ไม่ใส่ secret ค่า public ถูกใช้ใน build/client ไม่ใช่ backend credential |
| `VITE_GOOGLE_MAPS_EMBED_KEY` | พบเป็นตัวอย่างใน .env.example แต่ไม่พบ app source อ่านในขอบเขตที่ตรวจ ไม่จำเป็นสำหรับ Phase 1 ตาม source ปัจจุบัน |
| `VillaCheck_DATABASE_URL`, `VillaCheck_DATABASE_URL_UNPOOLED`, `VillaCheck_POSTGRES_URL_NON_POOLING` | อ่านจริงตามลำดับในข้อ 1 เก็บ integration-managed keys ไว้ |
| `VillaCheck_*` อื่น/POSTGRES_*/PG* | ผู้ใช้ยังไม่ได้ให้ชื่อเต็มของทุก key จึงไม่ตัดสินรายตัว การไม่พบ app อ่านตรงไม่ได้แปลว่า provider/dependency ไม่ใช้ ห้ามลบโดยเดา |
| `DATABASE_PATH` | SQLite standalone fallback ไม่ใช้เป็นฐานแทน PostgreSQL ของ Nest/Vercel |
| `SERVE_FRONTEND`, `BACKEND_HOST`, `BACKEND_PORT`, `PORT` | standalone/dev/Render; Next/Nest adapter ไม่ต้องใช้ตั้ง browser API base URL |
| test/browser/audit flags | ไม่ต้องเพิ่มใน Vercel web runtime ดู inventory แยก |

ไม่มี code fallback จาก APP_URL ไป VITE_APP_URL/VERCEL_URL และไม่อ่าน VITE_API_URL เป็น Next browser transport; `src/api.ts` ใช้ same-origin `/api` อย่าเพิ่มชื่อตัวแปรใหม่โดยคาดเดาเพื่อแก้ routing

[Inventory ชื่อและตำแหน่งทั้งหมด](vercel-staging-environment-inventory.md) แยก application/operator 71 ชื่อจาก test/archive ไม่อ่านค่าจริงจาก .env หรือ Dashboard

## 6. ยืนยัน DB isolation โดยไม่แสดง connection string

ให้ดิว/ผู้ดูแล DB ทำผ่าน Dashboard/secret manager และบันทึกเฉพาะผลว่า ตรง/ต่าง/ยังไม่ยืนยัน ไม่คัดลอก credentials, URL, host username หรือภาพช่อง secret ลงรายงาน:

1. ระบุ resource ที่ production hosting บริษัทใช้จริงก่อน ถ้ายังไม่มีข้อมูล production DB **ยังพิสูจน์ isolation ไม่ได้** ชื่อ VillaCheck/Staging หรือมี Vercel scope แยกอย่างเดียวไม่พอ
2. Vercel Storage/Integrations → resource ที่ผูก `VillaCheck_*` → Open provider console ตรวจ project/resource ID, DB/branch ID และ database/schema ที่เลือก เทียบกับ production ของบริษัทในหน้าส่วนตัว
3. ตรวจ effective URL ตาม precedence จริง โดยเฉพาะ DATABASE_URL ที่อาจบัง VillaCheck_DATABASE_URL ทุก scope/branch override รวม DIRECT/unpooled/backup ต้องอยู่ staging target เดียวกันตามหน้าที่
4. hostname pooled/direct ต่างกันอาจเป็น DB เดียวกัน และ username ต่างไม่พิสูจน์ว่าแยกข้อมูล ต้องเทียบ provider resource/branch/database identity กับสิทธิ์ role; schema แยกแต่ role เข้าถึง production ได้ไม่ถือว่าปลอดภัยพอ
5. ให้ผู้ดูแลบันทึกว่า production กับ staging แยก resource/DB/branch และสิทธิ์จริง พร้อมผลตรวจ TLS/roles/backup isolation โดยไม่เผยค่า ถ้าข้อมูลไม่ครบให้ No-Go ไม่ต่อ DB เพื่อเดาทดสอบในงานนี้

## 7. Preview ที่ Integration อยู่ทั้งสอง scope

การมี `VillaCheck_*` ใน Production และ Preview **ไม่พิสูจน์ว่ามีสองฐาน** อาจเป็น credentials ของ resourceเดียวกัน หรือ providerสร้าง branch แยก ต้องดู resource/branch mapping จริง

Push branch `fix/autonomous-business-security-20261024` เมื่อ Production Branch=main โดยปกติได้ Preview หากไม่มี custom rule/domain assignment; Preview อาจเขียน users/Villa/documents/settings/OTP queues ในฐาน staging เดียวกัน และ cold start/seed/migration tools ที่เรียกเองอาจมีผลข้อมูล จึงไม่คิดว่า Preview ปลอดภัยเพราะ URL ไม่ใช่ตัวหลัก

- ตรวจ effective Preview DB และ branch-specific overrides แยก; แนะนำ QA DB/branchแยก ก่อนอนุญาต write QA หากจำเป็นแชร์ staging DB ต้องให้ผู้ดูแลยอมรับ/จำกัดสิทธิ์และห้าม migrations/seeds จาก Preview ไม่มีการเปิดใช้การแชร์โดยอัตโนมัติในรายงานนี้
- เพิ่ม PAYMENT_ACCESS_MODE=DISABLED, OMISE_TEST_ENABLED=false, APP_ENV=staging และ demo seed guards ให้ Preview ด้วย เมื่อได้รับอนุญาตตั้งค่า ไม่ใช่ตั้งเฉพาะ Production
- จากข้อมูลผู้ใช้ SMTP/OTP/APP_URL มีใน Production ไม่ได้พิสูจน์ว่ามีใน Preview หากขาด OTP config สมัครอาจไม่พร้อม ให้ถือ Blocked ไม่ bypass OTP
- APP_URL ต้องตรง approved Preview QA origin ที่ทดสอบจริง เพราะ sourceใช้ allowedOrigins และ Vercel Admin host checks การ copy main staging APP_URL ไป Preview URL อื่นอาจทำให้ write/login ถูกปฏิเสธหรือ redirect กลับ URL หลัก Sourceไม่ได้คำนวณ APP_URL จาก VERCEL_URL เอง

## 8. ลำดับ Dashboard และ Go/No-Go

1. Project design-villacheck → Settings → Git/Environments ยืนยัน repo origin และ main ตามผู้ใช้แจ้ง แล้วดู target/domain mapping จริง ไม่มีการเปลี่ยน branch config
2. Environment Variables → เลือก Production scope ของ **project staging** ตรวจ effective DB/aliases พร้อม providerconsoleและ production DB inventory ก่อน ถ้ายังไม่รู้ production DB ให้หยุดก่อน deployment
3. เพิ่ม non-secret flags ตามข้อ 2 และตั้ง exact QA email allowlist; ตรวจ secret requirements กับผู้ดูแลโดยไม่ส่งค่าใน chat
4. ตรวจ CMS demo_mode/emailOtpTemplateId และ SMS scope โดยผู้มีสิทธิ์ แยกจาก env; ไม่ลบค่าหรือบันทึก DB เอง
5. ตรวจ Preview scopes/overrides, isolation, APP_URL และ payment guards แยกก่อนให้ feature push trigger Preview
6. ตรวจ build settings Next/Node24/`.next`, ไม่มี migration/seed ใน build และ backup/rollback plan พร้อม
7. หลังได้รับอนุญาต Push/Deploy ในงานภายหลัง ให้ตรวจ SHA/env/health/headers, `/api/config` ต้อง paymentAccessMode=DISABLED/paymentConfigured=false จาก artifact ใหม่ แล้วทดสอบ backend guards/workerด้วย QA data ไม่เรียกเก็บเงินจริง
8. Email inbox acceptance/อุปกรณ์จริงและ UAT เดิม 16 ข้อก่อน production acceptance

### Go/No-Go ก่อนอนุญาต deployment

- [ ] **GO:** ยืนยัน repo/main/domain/environment ถูกต้อง (ผู้ใช้ยืนยัน Git integration แล้ว; ตรวจซ้ำตามเวลาทำจริง)
- [ ] **GO:** มีหลักฐาน staging DB แยก production และทุก precedence/alias/direct/backup target ถูกต้อง
- [ ] **GO:** flags DISABLED/false/APP_ENV staging และ email allowlist ครบใน target scopes; SMS ไม่เปิดนอกขอบเขตโดยไม่ควบคุม
- [ ] **GO:** Preview ไม่เข้าถึง production DB; shared staging DB มีการควบคุมและยอมรับชัดก่อน write QA
- [ ] **GO:** APP_URL/HTTPS/cookie และ bootstrap Admin/schema/backup ถูกต้อง ไม่ใส่ secretsในpublic variables
- [ ] **GO:** runtime artifact ล่าสุดได้รับการตรวจและมี rollback/ingress protection สำหรับรุ่นเก่า

**NO-GO** หากไม่ทราบ production DB ที่ใช้เปรียบเทียบ, alias precedence ชี้ฐานผิด, ไม่ทราบ Preview target, payment flagsยังไม่ยืนยัน หรือ allowlist/OTP pathไม่พร้อมสำหรับงานที่ต้องส่งจริง ขณะนี้ยังไม่มีการตรวจค่าบน host จึงยังไม่รับรอง Go จากการมีชื่อ Integration ในภาพ

## การตรวจรอบนี้

ไล่ source และ static env references ไม่ได้อ่าน .env/host secrets ไม่เรียก network/DB/provider มี offline assertions 6 ข้อผ่านสำหรับ payment defaults/guards และ SMTP port/TLS ไม่มีการเปลี่ยน application code ไม่ rerun full QA suite ในรอบเอกสารนี้ ผล local suite ล่าสุดยังเป็นหลักฐาน revision f95e03f (PG262/SQLite254+8skip/Chrome66) ไม่ใช่ผล staging acceptance ใหม่

หมายเหตุ rollout: env flags ใหม่ไม่ทำให้ artifact เก่าที่ไม่อ่านตัวแปรเหล่านี้ปิด payment ได้เอง หาก host ยังเป็น revision เก่า ให้ Operator เตรียม ingress/payment restriction และ hold workers ระหว่าง rollout ที่ได้รับอนุญาต แล้วตรวจ API/artifact ใหม่หลัง deploy การไม่มี field paymentAccessMode บน API เก่าไม่ใช่หลักฐานว่า env ใหม่ตั้งผิด รอบนี้ไม่ทำ rollout หรือเปลี่ยน ingress


## แผนแยก Neon Preview ล่าสุด

ผู้ใช้ยืนยันชื่อNeonproject neon-citrine-xylophone/main/neondbแล้ว แต่ยังไม่ได้ตรวจeffectivehostmapping ดู [Neon/Vercel Preview plan](neon-vercel-preview-setup-plan.md) และ [Approval Runbook](neon-preview-approval-and-release.md) สำหรับschema-onlystaging-previewและการอนุมัติแยก ไม่มีการสร้างbranchหรือเปลี่ยนenvแล้วจากรายงานนี้
