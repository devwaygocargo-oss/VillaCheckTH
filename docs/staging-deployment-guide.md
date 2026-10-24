# คู่มือเตรียมและ Deploy Staging — VillaCheck Phase 3

24 ตุลาคม 2026 · ต่อจาก commit `5fc7615` บน `fix/autonomous-business-security-20261024`

คู่มือนี้เป็นขั้นตอนสำหรับ operator ยังไม่ได้ deploy ไป host ใดใน Phase 3 ห้ามใช้ production project/database/credentials หรือ `vercel --prod` ห้าม push branch เพื่อทดลอง deploy อัตโนมัติ ต้องเลือก staging project และ DB ที่แยกก่อนดำเนินการ

## โครงสร้างที่ตรวจจาก source

- Vercel: Next.js เสิร์ฟ UI, `pages/api/[...route].ts` เรียก Nest ที่ compile ใน `.build`, ใช้ PrismaPg ต่อ PostgreSQL ใน process/function เดียวกัน ไม่มีการ proxy ไป Render ใน source ปัจจุบัน
- Render: Docker image รัน Nest API แยกบน `BACKEND_PORT`, bind `BACKEND_HOST=0.0.0.0`; ไม่ใช่ Next frontend และยังไม่มีการเชื่อม cross-origin กับ Vercel frontend อย่า deploy ทั้งสองแล้วถือว่า frontend ใช้ Render อัตโนมัติ
- ทางเลือกสำหรับ staging UI ครบ flow: ใช้ Vercel project แยกที่รัน Next/Nest/Prisma ทั้งชุด ส่วน Render ใช้ตรวจ backend แยกหากจำเป็น การเพิ่ม reverse proxy/CORS เป็นงานแยกตาม topology ที่ยืนยัน
- `npm run build` generate Prisma/build backend/Next ไม่ migrate หรือ seed; `db:deploy` ต้องเรียกแยก Legacy `server/postgres.mjs` ยังเตรียม schema/backfill ตอน open; ใช้ deployment หลัก Nest/Prisma
- `render.yaml` ปิด payment โดยค่าเริ่มต้นและใช้ APP_URL จาก operator; `.dockerignore` กัน `.env*`, local audit/report, Git และ credential folders ออกจาก build context
- Admin navigation ใช้ origin ปัจจุบัน; Vercel Admin login ตรวจ Host กับ `APP_URL` ของ environment ไม่ hardcode production domain

## 1. เตรียม environment แยก

1. ใช้ checkout/worktree แยกที่ไม่มี `.env`, `.env.local`, `.env.production` หรือ customer artifacts จาก production อย่าคัดลอกข้อมูล production มาทดสอบ
2. เตรียม PostgreSQL staging ใหม่, TLS และบัญชีสิทธิ์เหมาะสม runtime/direct migration แยกตาม provider ห้ามใช้ URL ที่ได้จาก production
3. operator ตั้ง `.env.staging` หรือ private project env ดูรายชื่อใน [external acceptance](staging-external-acceptance.md) ห้าม commit/แนบค่าลงรายงาน
4. เริ่มด้วย `PAYMENT_ACCESS_MODE=DISABLED`, ปิด demo seed และ Omise จนพร้อมทดสอบ; กำหนด `APP_ENV=staging` และ exact mailbox allowlist ก่อนทดสอบการส่ง
5. APP_URL ต้องเป็น HTTPS origin ของ staging ที่ใช้งานจริง และตรงกับ host สำหรับ Admin บน Vercel ใช้ staging OAuth apps/callbacks เท่านั้น หากยังไม่พร้อมให้ปิดช่องทางนั้น

ใช้ shell สำหรับ staging โดยเฉพาะ ล้าง exported DB variables เดิมก่อน เพราะ environment ที่ export อยู่มีลำดับความสำคัญเหนือ `--env-file`:

```sh
unset DATABASE_URL VillaCheck_DATABASE_URL DIRECT_URL DATABASE_URL_UNPOOLED VillaCheck_DATABASE_URL_UNPOOLED VillaCheck_POSTGRES_URL_NON_POOLING BACKUP_DATABASE_URL
```

ตรวจว่าไม่มี exported production SMTP/Omise credentials ค้าง และโหลดจาก staging secret manager/file ที่เลือกเท่านั้น ใช้ Node 24 และ dependency lockfile จาก repository:

```sh
npm ci
export DOTENV_CONFIG_PATH=.env.staging
npm run build
node --env-file=.env.staging scripts/staging-diagnostics.mjs
```

Diagnostic ค่าเริ่มต้นไม่ต่อ DB/เครือข่าย ไม่แสดงค่าหรือ URL ตรวจว่าชื่อจำเป็นมีค่าแล้ว แต่ไม่ได้พิสูจน์ว่าเป็นค่าที่ถูกต้อง ห้ามใช้ output แทน provider acceptance

## 2. Backup และ migration rehearsal

operator ตรวจ target จาก dashboard ของ staging และยืนยันว่า isolated ก่อนทุกคำสั่ง ห้ามพิมพ์ connection URL ลง log/รายงาน

```sh
node --env-file=.env.staging scripts/application-backup.mjs backup /path/to/protected/staging-before.vcb
node --env-file=.env.staging scripts/deploy-db.mjs
```

- Backup คำสั่งแรกใช้ได้เมื่อมี schema/tables เดิมครบ ถ้าเป็น DB ใหม่ว่าง ให้เก็บหลักฐานว่าไม่มีข้อมูล แล้ว migrate ก่อน snapshot เริ่มต้น
- `DIRECT_URL` ใช้ direct connection สำหรับ migration; ตรวจ baseline DB เก่าก่อน mark migration applied การมีชื่อตารางครบไม่พิสูจน์ทุก column/constraint
- หลัง migrate ตรวจ migration status, schema และจำนวนข้อมูลก่อน/หลังด้วยเครื่องมือ operator ห้าม reset/db push หรือแก้ migration ที่เคยใช้
- Seed เฉพาะ staging ใหม่ที่ตรวจ target แล้ว: `node --env-file=.env.staging scripts/seed-demo.mjs` หลัง build อย่าเปิด seed ใน build command; ตรวจคำสั่ง/DEMO_PASSWORD และปลายทางอีกครั้งก่อนใช้
- หากต้องใช้ dummy data ให้เก็บป้าย Demo ให้ชัดเจน ไม่แสดงว่าเป็นที่พัก/ธุรกรรมจริง และอย่า seed demo admin แบบ local เข้า production-mode database

## 3. Deploy ไป staging โดย operator

### Vercel

เลือก project staging ที่แยกจาก production ใน dashboard ตรวจ env scope ของ preview/staging ให้ตรง deployment ใช้ `npm ci`, `npm run build`, output `.next` ตาม `vercel.json` ไม่มีคำสั่ง deploy อัตโนมัติใน session นี้

หาก deploy จาก local โดยไม่ push ให้ operator ใช้ checkout ที่ตรวจ revision แล้ว และเลือก **staging project เท่านั้น**:

```sh
npx vercel link
npx vercel deploy
```

คำสั่ง deploy ปกติเป็น Preview ตาม [เอกสาร Vercel](https://vercel.com/docs/cli/deploy) ไม่เพิ่ม production flag หรือ promote ตรวจ project linkage ก่อนส่ง source และใช้ `.vercelignore` ที่เตรียมไว้กัน `.env*`/credentials/local reports/artifacts ออกจาก upload อย่าคิดว่า `.gitignore` แทน upload ignore ได้

เตรียม stable staging alias/domain และตั้ง APP_URL/PUBLIC_URL ตรง alias นั้น ให้ operator ผูก Preview deployment เข้ากับ **staging alias ที่ยืนยันแล้ว** ใน dashboard แล้วทดสอบผ่าน alias เนื่องจาก random deployment hostname ไม่ใช่ canonical Admin host อย่า alias ไป production domain

- API timeout 60 วินาที; provider calls timeout 10 วินาที; ตรวจ latency และ DB pool ภายใต้ traffic ที่จะใช้
- Cron `/api/ops/cron` ต้องตั้ง `CRON_SECRET` และตรวจ hosting plan/schedule จริง รอบรายวันไม่รับประกันส่ง mail ทันที
- อย่าตั้ง DATABASE_URL ของ production ใน preview; ตรวจ app artifact มาจาก revision ที่ผ่าน QA

### Render (เฉพาะทดสอบ backend แยก)

ใช้ service staging แยกและ Dockerfile ใน repo ตั้ง APP_URL เป็น frontend origin ที่เลือก ตั้ง BACKEND_PORT ตาม service และ health `/api/health` ตรวจ TLS/ingress และ quota จริง อย่าเชื่อ header IP ที่ผู้เรียกใส่เอง Render ยังใช้ socket IP ซึ่งอาจรวมผู้ใช้หลายคนหลัง proxy

หาก source revision มีอยู่ใน remote แล้ว operator เลือก Deploys → Manual Deploy → Deploy a specific commit ใน staging service และปิด auto-deploy ตาม [เอกสาร Render](https://render.com/docs/deploys) ถ้า commit ยังไม่อยู่ remote ให้บันทึกรอผู้ดูแล ไม่ push ใน session นี้

ไม่ตั้ง `VERCEL=1` บน Render เพื่อแก้ IP; flag นี้ใช้เฉพาะ ingress Vercel ที่เชื่อถือได้ ระบบยังไม่ได้เพิ่ม browser cross-origin transport ไป Render

## 4. เปิด Omise Test checkout เฉพาะ staging

1. ผู้ดูแล Omise เปิด method ที่ต้องทดสอบในบัญชี Test และใส่ `OMISE_TEST_PUBLIC_KEY`, `OMISE_TEST_SECRET_KEY` แบบ Test เท่านั้น
2. ตั้ง `OMISE_TEST_ENABLED=true`, `PAYMENT_ACCESS_MODE=OMISE_TEST` และ `OMISE_TEST_METHODS` เป็นรายการที่ผู้ดูแลอนุมัติสำหรับ Test ปัจจุบันเตรียม `promptpay` กับ `mobile_banking_scb` ไว้ แต่ไม่เปิด method ใดเองเมื่อรายการว่าง
3. สร้าง invoice ใหม่จาก Villa ที่อนุมัติและมีสิทธิ์เลือกแพ็กเกจ ไม่แปลง invoice manual เก่าอัตโนมัติ ไม่เปิด Basic paid หรือ settlement ที่ยังรอข้อกำหนด
4. Merchant กดเริ่มชำระทดสอบ: Omise.js สร้าง source, server ดึง source ตรวจ Test mode/method/amount/currency แล้วสร้าง charge จากยอด invoice
5. PromptPay แสดง QR จาก provider Test เท่านั้น **ห้ามใช้แอปธนาคารจริงสแกน/โอน** ให้จำลองผลใน Test Dashboard ตามเอกสาร provider; SCB Test ใช้หน้าจำลองที่ผู้ให้บริการกำหนด
6. URL authorize รับเฉพาะ HTTPS `api.omise.co` และ path Test ที่อนุญาต; return URI สร้างจาก APP_URL และ invoice ฝั่ง server ไม่รับจาก client กลับแล้วโหลด status ใหม่ ไม่เชื่อ `status=successful` ใน URL
7. ตั้ง webhook เป็น staging `/api/webhooks/omise` ตรวจว่าไม่มี login redirect/provider access protection มาขวาง; event และ charge ถูกดึงยืนยันจาก API ฝั่ง server
8. กรณี UNKNOWN/CREATING/SOURCE_REJECTED/failed ยังไม่อนุญาตสร้าง charge ทับอัตโนมัติ ให้ operator ตรวจรายการเดิม รายการ reconciliation/retry UI ยังไม่ครบ

## 5. SMTP / Email OTP

ตรวจการเชื่อมต่อโดยไม่ส่งเมล (ต้องเป็น staging):

```sh
node --env-file=.env.staging scripts/staging-diagnostics.mjs --verify-smtp
```

ยังไม่ได้รัน provider verification ในงานนี้ การ verify สำเร็จพิสูจน์เพียง connection/auth/TLS ไม่ได้พิสูจน์ Inbox จากนั้น operator ใช้บัญชีทดสอบใน allowlist สมัครและยืนยัน Email OTP ตรวจ Inbox/Spam, expiry, ผิดรหัส, replay, rate limit และ throttle ตาม [acceptance checklist](staging-external-acceptance.md)

`STAGING_EMAIL_ALLOWLIST` เป็นรายการอีเมลตรงตัวคั่น comma ไม่มี wildcard; ถ้าว่างส่งไม่ได้ ปฏิเสธ cc/bcc และผู้รับนอก list ก่อนเรียก SMTP Email OTP ตรวจ allowlist ก่อนเรียกทั้ง SMTP และ direct ThaiBulkSMS template API ส่วน SMS ต้องใช้บัญชี/ผู้รับทดสอบที่อนุญาตแยก ห้ามเปิด SMS credentials ถ้ายังไม่ได้กำหนดขอบเขตการตรวจรับ

## 6. ตรวจหลัง deploy staging

```sh
node --env-file=.env.staging scripts/health-check.mjs
node --env-file=.env.staging scripts/operations-check.mjs
```

ต้องตั้ง PUBLIC_URL เป็น staging ก่อนรัน เพราะ script เดิมมี default domain ห้ามละเลยขั้นนี้ Protected `/api/packages` ควรได้ 401 เมื่อไม่ login จากนั้นตรวจ login/OTP, Basic=0, positive invoice Test, webhook, redirect/refresh, duplicate, approval แยก, audit/outbox และ user isolation บนอุปกรณ์จริง เก็บเฉพาะ evidence ที่ไม่เปิด secrets/ข้อมูลลูกค้า

## 7. Backup retention / rollback

- ตั้ง scheduler สำหรับ `scripts/scheduled-backup.mjs` นอก ephemeral Vercel filesystem; storage แยกสิทธิ์และ encryption key แยกจาก archive; กำหนด retention/RPO/RTO กับ operator
- ก่อน release เก็บ previous artifact/revision, backup digest/time และ migration version
- App rollback: เลือก previous staging artifact ที่เข้ากับ schema ห้าม rollback ไป revision ก่อน payment gates โดยไม่ปิด payment ที่ ingress ด้วย
- DB rollback: ใช้ forward fix เมื่อทำได้ หากต้อง restore ให้ migrate DB ใหม่ว่างที่แยก แล้วใช้คำสั่งด้านล่างด้วย config ของ **restore target** ห้าม restore ทับฐานที่มีข้อมูล; remote restore ต้อง deliberate opt-in ของ operator

```sh
node --env-file=.env.staging-restore scripts/application-backup.mjs restore /path/to/protected/staging-before.vcb
```

ตรวจเอกสาร binary, invoice totals/status, subscription dates, QR identity, approved versions และ audits; sessions/OTP ไม่ถูก restore ต้อง login ใหม่ กระทบยอด webhook/ธุรกรรมที่เกิดหลัง backup ก่อนสลับฐาน หากยังไม่ rehearsal ห้ามลงเครื่องหมายผ่าน

## เกณฑ์ก่อนพิจารณา 31 ตุลาคม

Provider Test acceptance, SMTP inbox, host/TLS/backup/rollback evidence, payment restrictions และคุณเกมส์ลงนาม UAT ต้องครบตามขอบเขตที่เปิด ดู [Go-live blockers](go-live-blockers.md) Phase 3 ยังไม่ใช่ Go-live approval และไม่มี Live gateway implementation ที่ตรวจรับแล้ว
