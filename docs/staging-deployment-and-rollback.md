# ขั้นตอนอัปเดต Staging เดิมและ Rollback

**คู่มือเท่านั้น ยังไม่อนุญาตและไม่ได้ deploy/เปลี่ยน settings ในรอบนี้** Production `villacheckth.com` อยู่ hosting บริษัทที่ยังไม่ทราบรายละเอียด ห้ามใช้คำสั่งนี้กับ production hosting

## 1. ดิวตรวจสิทธิ์และตัวตน project ก่อน

1. เข้า Vercel ด้วยบัญชีที่มีสิทธิ์ทีมของ project เดิม Local `.vercel/project.json` ระบุ `design-villacheck` แต่ API ปัจจุบัน 403 จึงต้องตรวจ alias owner/team จาก Dashboard อีกครั้ง
2. บันทึก deployment ที่ alias `design-villacheck.vercel.app` ชี้อยู่, Git branch/SHA, target และ artifact เก่าสำหรับ rollback อย่าใช้เพียงสถานะ READY หรือ URL เป็นหลักฐาน SHA
3. ตรวจ source branch และ HEAD ใหม่ที่จะส่ง ไม่มี push/merge ในงานนี้:

```sh
git branch --show-current
git rev-parse HEAD
git status --short
npx vercel whoami
npx vercel inspect https://design-villacheck.vercel.app/
```

CLI ไม่ได้ติดตั้ง/รันใน session นี้ ขั้นตอน npx อาจติดตั้ง CLI และต้อง auth โดยผู้ดูแล เก็บ token ใน secret store ห้ามใส่ `--token` พร้อมค่าลงคำสั่งที่แชร์

## 2. ยืนยัน config/DB ก่อนส่ง source

- ใช้ [Configuration Checklist](staging-configuration-checklist.md) เลือก env scope ที่ตรง target ของ alias ตรวจ Next.js/`.next`/Node 24 และ build overrides
- APP_URL ต้อง origin staging ที่ใช้จริง; Preview URL ใหม่ต้องมี env/host ที่สอดคล้องก่อนทดสอบ Admin/OTP ไม่ใช้ production origins
- PostgreSQL ต้องแยกและ Operator ยืนยัน target ก่อนทุกคำสั่ง DB; ปิดเงินจริงและ demo seed เก็บข้อมูลเก่าไว้
- หาก schema พร้อมอยู่แล้ว ไม่มี migration ใหม่จากรอบนี้ หากต้อง migrate เพราะฐานเก่า ให้ Operator สำรอง/ตรวจ direct URL/schema/baseline ก่อน และขออนุญาตงาน DB ภายนอกแยก

ใช้ clean checkout ของ commit ส่งมอบ ไม่มี `.env`/production exports ปะปน ล้าง DB aliases ตามคู่มือ staging เดิมแล้วใช้ `.env.staging` ที่ตรวจ target แล้ว:

```sh
npm ci
npm run typecheck
npm run lint
npm run build
node --env-file=.env.staging scripts/staging-diagnostics.mjs
```

เฉพาะหลังได้รับอนุญาตและตรวจ DB target โดยผู้ดูแล:

```sh
node --env-file=.env.staging scripts/application-backup.mjs backup /path/to/protected/staging-before.vcb
node --env-file=.env.staging scripts/deploy-db.mjs
```

ถ้า DB ใหม่ว่างให้ migrate ก่อน backup เริ่มต้น ไม่มีการรันคำสั่งข้างต้นกับฐานภายนอกในงานนี้ ห้าม reset/db push/drop/truncate

## 3. Deploy หลังได้รับอนุญาตเท่านั้น

ใช้ project เดิมที่ยืนยันแล้ว ไม่สร้างใหม่เพราะ API 403 แก้สิทธิ์ก่อน `vercel link` หาก local linkage ไม่ตรง ห้ามรัน script Vite/Render configurator

```sh
npx vercel deploy
```

คำสั่งปกติสร้าง Preview ตาม [Vercel deploy](https://vercel.com/docs/cli/deploy) ไม่ถือว่าเปลี่ยน alias staging หลักแล้ว ต้องตรวจ URL/target/env และ revision บน artifact ใหม่ก่อน [Vercel inspect](https://vercel.com/docs/cli/inspect) ใช้ตรวจ deployment

การย้าย alias หลักเป็นอีก mutation ที่ต้องได้รับอนุญาต โดยผู้ดูแลยืนยัน deployment ใน project staging เดียวกันและ env target ตรง อย่าเติม `--prod` โดยเดาหรือ promote เข้า project อื่น ตัวอย่างหลังอนุมัติ alias แยก:

```sh
npx vercel alias set <VERIFIED_STAGING_DEPLOYMENT_URL> design-villacheck.vercel.app
```

อ่าน [Vercel alias](https://vercel.com/docs/cli/alias) ประกอบ Placeholder ต้องเป็น URL ที่ตรวจแล้ว ห้ามใช้ `villacheckth.com` ไม่มีคำสั่ง deploy/alias ถูกเรียกใน session นี้

## 4. Smoke ก่อน QA

```sh
PUBLIC_URL=https://design-villacheck.vercel.app npm run check:health
```

ต้องตรวจเพิ่ม: `/api/config` paymentConfigured=false/mode DISABLED, headers, SHA/env/DB, credentials/session/CSRF, Owner/Admin/public/QR และ legacy payment routes ด้วยบัญชี QA ที่ได้รับอนุญาต ห้ามลองเงินจริงเพื่อพิสูจน์ gate

จากนั้น SMTP verify-only ใน staging และ inbox acceptance ด้วย exact QA mailbox; ทำ UAT เดิม 16 ข้อ ผลอุปกรณ์จริงและคุณเกมส์ลงนามแยก

## 5. Rollback

- เก็บ previous deployment URL/ID/env snapshot แบบไม่แสดงค่าและ backup ก่อนเริ่ม อย่าสมมติ artifact เก่ารองรับ payment gate
- หากย้อน app ก่อน `21d226a` ต้องคง ingress restriction/หยุด payment mail workers เพราะ env DISABLED อย่างเดียวไม่ทำให้โค้ดเก่าเข้าใจ
- Operator คืน alias ไป deployment ที่ตรวจว่าอยู่ project staging เดียวกันและปลอดภัย หลังได้รับอนุญาตเท่านั้น อย่าย้อน DB อัตโนมัติจนเสียรายการใหม่
- ถ้าจำเป็นต้องคืนข้อมูล ให้ restore ลง DB ใหม่ว่าง ตรวจ schema/counts/เอกสาร/QR ก่อนพิจารณาสลับ connection ด้วยแผนที่อนุมัติแยก เก็บฐานเดิมไว้
- ตรวจ SHA/headers/payment-disabled/auth/QR หลัง rollback และบันทึกเหตุผล/ผู้ทำ/เวลา ผลจริง ดู [release rollback เดิม](phase1-release-and-rollback-plan.md)

เอกสาร [Vercel rollback](https://vercel.com/docs/cli/rollback) เป็นข้อมูลประกอบ ไม่ใช้ rollback/promote ของ project โดยไม่ตรวจ environment/target จริง
