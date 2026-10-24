# ภาคผนวกชื่อตัวแปร Environment ที่ Source อ่าน

อ้างอิง revision `7b147a8` ชื่อ case-sensitive; ไม่เปิดเผยค่าหรืออ่าน host/.env แยก runtime/operator จาก test/archive ดูการตั้งค่าที่แนะนำใน [Environment Mapping](vercel-staging-environment-mapping.md)

| ชื่อที่อ่านจริง | Source references |
|---|---|
| `ADMIN_EMAIL` | [scripts/seed-demo.mjs:12](../scripts/seed-demo.mjs), [server/index.mjs:42](../server/index.mjs), [server/index.mjs:46](../server/index.mjs) |
| `ADMIN_PASSWORD` | [scripts/seed-demo.mjs:11](../scripts/seed-demo.mjs), [server/index.mjs:42](../server/index.mjs), [server/index.mjs:43](../server/index.mjs), [server/index.mjs:47](../server/index.mjs) |
| `ALERT_WEBHOOK_URL` | [scripts/install-operator-jobs.mjs:12](../scripts/install-operator-jobs.mjs), [scripts/install-operator-jobs.mjs:14](../scripts/install-operator-jobs.mjs), [scripts/operations-check.mjs:17](../scripts/operations-check.mjs) |
| `ALLOW_REMOTE_RESTORE` | [scripts/application-backup.mjs:70](../scripts/application-backup.mjs) |
| `APP_ENV` | [scripts/staging-diagnostics.mjs:6](../scripts/staging-diagnostics.mjs), [server/index.mjs:84](../server/index.mjs), [server/staging-mail.mjs:3](../server/staging-mail.mjs) |
| `APP_URL` | [server/index.mjs:19](../server/index.mjs), [server/index.mjs:20](../server/index.mjs) |
| `BACKEND_HOST` | [backend/main.ts:4](../backend/main.ts), [server/index.mjs:138](../server/index.mjs), [server/index.mjs:143](../server/index.mjs) |
| `BACKEND_PORT` | [backend/main.ts:4](../backend/main.ts), [backend/main.ts:5](../backend/main.ts), [server/index.mjs:137](../server/index.mjs) |
| `BACKUP_DATABASE_URL` | [scripts/application-backup.mjs:68](../scripts/application-backup.mjs), [scripts/install-operator-jobs.mjs:8](../scripts/install-operator-jobs.mjs), [scripts/install-operator-jobs.mjs:12](../scripts/install-operator-jobs.mjs), [scripts/scheduled-backup.mjs:4](../scripts/scheduled-backup.mjs) |
| `BACKUP_DIR` | [scripts/scheduled-backup.mjs:4](../scripts/scheduled-backup.mjs) |
| `BACKUP_RETENTION_DAYS` | [scripts/install-operator-jobs.mjs:12](../scripts/install-operator-jobs.mjs), [scripts/scheduled-backup.mjs:4](../scripts/scheduled-backup.mjs) |
| `BACKUP_SCHEMA` | [scripts/application-backup.mjs:70](../scripts/application-backup.mjs), [scripts/scheduled-backup.mjs:8](../scripts/scheduled-backup.mjs) |
| `BACKUP_SECRET` | [scripts/application-backup.mjs:71](../scripts/application-backup.mjs), [scripts/application-backup.mjs:71](../scripts/application-backup.mjs), [scripts/scheduled-backup.mjs:8](../scripts/scheduled-backup.mjs) |
| `COOKIE_SECURE` | [server/index.mjs:108](../server/index.mjs) |
| `CRON_SECRET` | [server/index.mjs:123](../server/index.mjs) |
| `DATABASE_PATH` | [server/index.mjs:28](../server/index.mjs) |
| `DATABASE_URL` | [backend/prisma.service.ts:19](../backend/prisma.service.ts), [prisma.config.ts:6](../prisma.config.ts), [scripts/application-backup.mjs:68](../scripts/application-backup.mjs), [scripts/deploy-db.mjs:5](../scripts/deploy-db.mjs), [scripts/seed-demo.mjs:6](../scripts/seed-demo.mjs), [server/index.mjs:14](../server/index.mjs), [server/index.mjs:25](../server/index.mjs), [server/index.mjs:25](../server/index.mjs), [server/index.mjs:26](../server/index.mjs), [server/legacy-vercel.mjs:5](../server/legacy-vercel.mjs), [server/legacy-vercel.mjs:8](../server/legacy-vercel.mjs) |
| `DATABASE_URL_UNPOOLED` | [scripts/deploy-db.mjs:7](../scripts/deploy-db.mjs) |
| `DEMO_MODE` | [server/index.mjs:89](../server/index.mjs), [server/payment-access.mjs:9](../server/payment-access.mjs) |
| `DEMO_PASSWORD` | [scripts/seed-demo.mjs:10](../scripts/seed-demo.mjs), [scripts/seed-public-demo.mjs:19](../scripts/seed-public-demo.mjs) |
| `DIRECT_URL` | [scripts/application-backup.mjs:68](../scripts/application-backup.mjs), [scripts/deploy-db.mjs:7](../scripts/deploy-db.mjs) |
| `FACEBOOK_APP_ID` | [server/index.mjs:102](../server/index.mjs) |
| `FACEBOOK_APP_SECRET` | [server/index.mjs:103](../server/index.mjs) |
| `FACEBOOK_GRAPH_VERSION` | [server/index.mjs:104](../server/index.mjs) |
| `FACEBOOK_LOGIN_ENABLED` | [server/index.mjs:124](../server/index.mjs) |
| `GOOGLE_CLIENT_ID` | [server/index.mjs:100](../server/index.mjs) |
| `GOOGLE_CLIENT_SECRET` | [server/index.mjs:101](../server/index.mjs) |
| `LINE_CHANNEL_ID` | [server/index.mjs:98](../server/index.mjs) |
| `LINE_CHANNEL_SECRET` | [server/index.mjs:99](../server/index.mjs) |
| `MIGRATION_LOCK_MAX_ATTEMPTS` | [scripts/migration-runner.mjs:31](../scripts/migration-runner.mjs) |
| `NEXT_PUBLIC_FACEBOOK_URL` | [next.config.mjs:9](../next.config.mjs), [src/support.ts:8](../src/support.ts) |
| `NEXT_PUBLIC_INSTAGRAM_URL` | [next.config.mjs:9](../next.config.mjs), [src/support.ts:9](../src/support.ts) |
| `NEXT_PUBLIC_LINE_URL` | [next.config.mjs:9](../next.config.mjs), [src/support.ts:10](../src/support.ts) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | [next.config.mjs:9](../next.config.mjs), [src/support.ts:6](../src/support.ts) |
| `NEXT_PUBLIC_SUPPORT_PHONE` | [next.config.mjs:9](../next.config.mjs), [src/support.ts:7](../src/support.ts) |
| `NODE_ENV` | [server/index.mjs:17](../server/index.mjs), [server/payment-access.mjs:6](../server/payment-access.mjs), [server/payment-access.mjs:8](../server/payment-access.mjs) |
| `OMISE_TEST_ENABLED` | [server/index.mjs:121](../server/index.mjs), [server/payment-access.mjs:10](../server/payment-access.mjs) |
| `OMISE_TEST_METHODS` | [server/index.mjs:88](../server/index.mjs) |
| `OMISE_TEST_PUBLIC_KEY` | [server/index.mjs:87](../server/index.mjs) |
| `OMISE_TEST_SECRET_KEY` | [server/index.mjs:122](../server/index.mjs) |
| `OTP_SECRET` | [server/index.mjs:91](../server/index.mjs) |
| `PAYMENT_ACCESS_MODE` | [server/payment-access.mjs:6](../server/payment-access.mjs) |
| `PAYMENT_INSTRUCTIONS` | [server/index.mjs:125](../server/index.mjs) |
| `PAYMENT_VERIFICATION_MODE` | [server/index.mjs:90](../server/index.mjs) |
| `PORT` | [scripts/dev.mjs:7](../scripts/dev.mjs), [server/index.mjs:137](../server/index.mjs) |
| `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK` | [scripts/migration-runner.mjs:38](../scripts/migration-runner.mjs) |
| `PUBLIC_URL` | [scripts/health-check.mjs:1](../scripts/health-check.mjs), [scripts/install-operator-jobs.mjs:12](../scripts/install-operator-jobs.mjs), [scripts/operations-check.mjs:17](../scripts/operations-check.mjs) |
| `SEED_DEMO_ACCOUNTS` | [server/index.mjs:22](../server/index.mjs), [server/index.mjs:24](../server/index.mjs) |
| `SEED_PUBLIC_DEMO_DATA` | [scripts/seed-public-demo.mjs:16](../scripts/seed-public-demo.mjs) |
| `SERVE_FRONTEND` | [server/index.mjs:127](../server/index.mjs) |
| `SMTP_FROM` | [server/index.mjs:77](../server/index.mjs), [server/index.mjs:119](../server/index.mjs) |
| `SMTP_HOST` | [server/index.mjs:77](../server/index.mjs), [server/smtp-diagnostics.mjs:16](../server/smtp-diagnostics.mjs) |
| `SMTP_PASSWORD` | [server/smtp-diagnostics.mjs:16](../server/smtp-diagnostics.mjs) |
| `SMTP_PORT` | [server/smtp-diagnostics.mjs:14](../server/smtp-diagnostics.mjs) |
| `SMTP_SECURE` | [server/smtp-diagnostics.mjs:14](../server/smtp-diagnostics.mjs), [server/smtp-diagnostics.mjs:14](../server/smtp-diagnostics.mjs) |
| `SMTP_USER` | [server/smtp-diagnostics.mjs:16](../server/smtp-diagnostics.mjs), [server/smtp-diagnostics.mjs:16](../server/smtp-diagnostics.mjs) |
| `STAGING_EMAIL_ALLOWLIST` | [server/index.mjs:85](../server/index.mjs), [server/staging-mail.mjs:4](../server/staging-mail.mjs) |
| `THAIBULKSMS_API_KEY` | [server/index.mjs:92](../server/index.mjs) |
| `THAIBULKSMS_API_SECRET` | [server/index.mjs:93](../server/index.mjs) |
| `THAIBULKSMS_EMAIL_OTP_TEMPLATE_ID` | [server/index.mjs:97](../server/index.mjs) |
| `THAIBULKSMS_OTP_KEY` | [server/index.mjs:95](../server/index.mjs) |
| `THAIBULKSMS_OTP_SECRET` | [server/index.mjs:96](../server/index.mjs) |
| `THAIBULKSMS_SENDER` | [server/index.mjs:94](../server/index.mjs) |
| `VERCEL` | [server/index.mjs:107](../server/index.mjs) |
| `VITE_FACEBOOK_URL` | [next.config.mjs:9](../next.config.mjs) |
| `VITE_INSTAGRAM_URL` | [next.config.mjs:9](../next.config.mjs) |
| `VITE_SUPPORT_EMAIL` | [next.config.mjs:9](../next.config.mjs) |
| `VITE_SUPPORT_PHONE` | [next.config.mjs:9](../next.config.mjs) |
| `VillaCheck_DATABASE_URL` | [backend/prisma.service.ts:19](../backend/prisma.service.ts), [prisma.config.ts:6](../prisma.config.ts), [scripts/deploy-db.mjs:5](../scripts/deploy-db.mjs), [scripts/seed-demo.mjs:6](../scripts/seed-demo.mjs), [server/index.mjs:14](../server/index.mjs), [server/legacy-vercel.mjs:5](../server/legacy-vercel.mjs) |
| `VillaCheck_DATABASE_URL_UNPOOLED` | [scripts/deploy-db.mjs:7](../scripts/deploy-db.mjs) |
| `VillaCheck_POSTGRES_URL_NON_POOLING` | [scripts/deploy-db.mjs:7](../scripts/deploy-db.mjs) |

## เฉพาะ test/browser tooling

`TEST_DATABASE_URL`, `VILLACHECK_BROWSER_EVIDENCE_DIR`, `VILLACHECK_BUSINESS_QA`, `VILLACHECK_CHROME_PATH`, `VILLACHECK_PAYMENT_EVIDENCE_DIR`, `VILLACHECK_PHASE1_QA`

## เฉพาะ audit รุ่นก่อน

`AUDIT_ONLY_PAGES`, `RESPONSIVE_ENGINE`

ชื่อที่ซ้ำกับ runtime อาจถูกใช้ใน test ด้วย JSON inventory เก็บ reference แยกครบ ไม่จำเป็นต้องเพิ่ม test/audit flags ใน Vercel

การค้นนี้ไม่รวม standard environment ที่ dependencies/platform อ่านภายใน เช่น PG/Node/Next build internals จึงไม่ใช้ผลค้นเป็นเหตุลบ provider-managed variables
