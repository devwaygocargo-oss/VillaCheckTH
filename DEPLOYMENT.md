# VillaCheck deployment, UAT and operations

Updated 24 October 2026. Current runtime: Next.js 16 / React 19, NestJS 12, Prisma 7, PostgreSQL and Node.js 24. Historical Vite/dist/raw-server instructions are obsolete.

## Deployment

Vercel framework is Next.js; `npm ci`, `npm run build`, output `.next`. The build generates Prisma, compiles Nest and builds Next only. Run `npm run db:deploy` separately as an explicit operator step against the intended database. Do not point local builds or preview deployments at an unintended production database. `pages/api/[...route].ts` forwards API requests into the shared Nest runtime. Direct standalone Nest is optional.

Required private configuration: `DATABASE_URL` (pooled runtime), `DIRECT_URL` (direct migration connection where supported), HTTPS `APP_URL`, initial `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Existing Admin passwords are not overwritten by changing environment variables. Set support values through CMS. No secrets may use NEXT_PUBLIC prefixes or enter Git/audit files.

Migrations preserve existing data and QR identities; never edit deployed migrations, use migrate reset, or use db push against production. scripts/deploy-db.mjs handles legacy baselining and migration lock retry. Diagnose lock holders before terminating a confirmed abandoned deployment; do not disable locking.

`SEED_DEMO_ACCOUNTS=false` and `SEED_PUBLIC_DEMO_DATA=false` for operator-owned real production data. Public demo seed never runs during build and requires explicit opt-in. Demo fixtures and Demo Mode are separate concerns: inspect existing demo content and payment state before approving any cleanup. Do not delete fixtures or reset a production database as part of UAT.

## Single authorized Admin approval

A single authorized Admin can propose and approve a bank change, including their own proposal. A configured reviewer permission still applies; duplicate/stale approvals are rejected. Actor/approver/time/outcome and durable Owner notifications are retained. External Owner delivery requires a confirmed recipient/channel. Admin publishes CMS directly after reviewing Preview. Approved bank changes affect new invoices only; old receiver/amount snapshots remain.

Use `node --env-file-if-exists=.env scripts/provision-admin.mjs` only in the designated environment, with `NEW_ADMIN_EMAIL`, `NEW_ADMIN_NAME`, `NEW_ADMIN_PASSWORD` in the operator environment. The script refuses existing emails and never prints passwords. Provisioning is an operator action, not public signup. Do not share Admin credentials for approval separation.

## External providers

Google: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. LINE: LINE_CHANNEL_ID / LINE_CHANNEL_SECRET. Facebook: FACEBOOK_APP_ID / FACEBOOK_APP_SECRET / FACEBOOK_GRAPH_VERSION plus CMS enablement after Meta approval. Exact redirect base is `APP_URL/api/auth/oauth/provider/callback`. Production domain: https://design-villacheck.vercel.app. Privacy hash route: /#page=privacy; Data Deletion: /data-deletion.html.

Facebook stays BLOCKED — External Dependency (Meta) until Business Verification, relevant Advanced Access/App Review/publishing and Public User tests pass. Existing callback implementation is not evidence of approval. Google/LINE configuration presence is not a live UAT result.

Configure approved SMS/Email OTP credentials and sender/template IDs according to the selected provider. Verify quota/plan separately. SMTP payment mail requires SMTP_HOST/PORT/USER/PASSWORD/FROM; use approved credentials (for Gmail, an App Password after account security setup), not the ordinary account password. Secrets are entered through provider/hosting secret storage.

## Scheduled delivery, monitoring and backups

Vercel schedules `/api/ops/cron` daily at 02:00 UTC (09:00 Thailand). Configure a strong CRON_SECRET so Vercel sends its bearer authentication. The route fails closed without the secret. After deploying, verify lastScheduledRun in Admin readiness. A daily worker is not a real-time delivery SLA; use an authenticated external schedule for a shorter interval if required and supported by the hosting plan.

Run `node scripts/operations-check.mjs` from a trusted scheduled runner to check public API health. Optional private `ALERT_WEBHOOK_URL` sends a generic failure event without customer data or credentials. The script exits nonzero for scheduler alerting. Set PUBLIC_URL to the intended deployment. Assign an on-call owner and exercise a controlled failure in staging; do not claim alerts active until the operator verifies delivery.

Encrypted database backup: configure BACKUP_DATABASE_URL, BACKUP_SECRET (32+ characters), BACKUP_DIR and BACKUP_RETENTION_DAYS; run `node scripts/scheduled-backup.mjs`. The directory must be protected and replicated to separately controlled storage by the operator. Defaults retain archives 30 days; never delete a prior archive until a new export succeeds. Store the encryption key outside the archive location. Daily scheduling is operator-owned; the Vercel function does not persist a backup filesystem.

Restore drill: create an empty migrated isolated database, set BACKUP_DATABASE_URL to it, and `npm run db:restore -- /path/archive.vcb` with the correct BACKUP_SECRET. Remote restores require deliberate ALLOW_REMOTE_RESTORE=true. The restore refuses populated targets and does not restore transient sessions/OTP. Check documents, invoice totals, bank snapshots and Villa QR identity. Record duration and agree RPO/RTO before approving operational readiness.

## UAT checklist and evidence

Use disposable PostgreSQL fixtures for automated tests; never send production OTP/email from regression scripts. Backend/UAT harness in audit-results/priority-completion-build-audit.mjs clears real environment values and starts an isolated database. Browser harness separately checks desktop, phone/tablet simulation and role transitions. These results do not replace business, real-provider or physical-device acceptance.

Admin Settings → acceptance register records area, result, reviewer/time and evidence. Preserve failed/blocked results; a later result supplements history. Do not enter passwords, keys, OTP or complete private documents.

1. User: register/login, verify OTP, home refresh/new tab, dropdown logout, public/private QR fields, report and response.
2. Merchant: Google/LINE real consent, OTP real login, explicit account linking, profile, package selection, valid/invalid/expired coupon, add Villa with actual permitted PDF/image, edit/resubmit.
3. Admin: independent CMS/bank proposal/review, single-Admin approval with role checks, stale revision, rejection reason, pending/approved Villa pages, full data/document view and role denial.
4. Finance: use business-approved bank/PromptPay only. Create invoice; confirm price/discount/duration/receiver. Automatic and selected mail must include correct bank PNG; compare decoded payload and name shown by banking app. No transfer until amount/test transaction explicitly authorized by finance.
5. Slip: upload, reject/resubmit, confirm once, verify no activation before confirmation and no double extension. Check renewal/current upgrade/capacity constraints and immutable bank data on old invoices.
6. CMS: approved real banners/FAQ/contact/social/policies; draft Preview, authorized-Admin publish, public render, history restore/reapproval. Do not treat revision 0/default content as business acceptance.
7. Physical iPhone/iPad Safari: record model/OS if available, portrait/landscape, menu, login/logout, file picker, upload feedback, forms, QR full-size save/download. Browser simulation is separately labeled.
8. Operations: SMTP inbox/spam/retry, provider quota, scheduled worker last run, backup/restore drill, alert delivery, Admin training and agreed escalation/SLA.

Release decision: record named business/finance reviewers and their Pass/Fail evidence. Meta and missing real bank remain external/input blockers. Management decides whether other channels can launch with Facebook disabled. Disable Demo only after approved real content, bank and acceptance prerequisites. No automatically assigned Go-live date or Production Ready status.

## Useful commands

`npm run typecheck`; `npm run lint`; `npm run check:health`; `npm run test:backend` with TEST_DATABASE_URL for full PostgreSQL integration. `npm run build` has no migration/seed step. Run `node scripts/test-postgres.mjs --browser` for isolated PostgreSQL and optional local Chrome acceptance.

## Current agreed delivery scope (19 October 2026)

Dew owns Vercel/Backup/Monitoring operations. Dummy data remains the approved testing/demonstration content; real-content replacement is deferred for the current phase. Keep Demo enabled until separately approved financial and production prerequisites are satisfied. This does not convert dummy acceptance into Production Acceptance. SMTP smoke-test outcomes are persisted with sanitized authentication/DNS/connection/TLS/provider-limit diagnostics in Admin readiness. Monitoring counts a webhook as accepted only for a successful HTTP response.

## Operator Mac automation

`scripts/install-operator-jobs.mjs` is an explicit macOS operator installer (never run by build/startup). Supply a verified BACKUP_DATABASE_URL in the operator environment. It stores credentials in `~/.villacheck-operations/operator.env` and the encryption key in `keys/backup.key`, both mode 0600, outside Git. The encrypted archives and safe operation logs are in separate subdirectories. Existing keys are reused, never regenerated on reinstall.

LaunchAgents `com.villacheck.backup` (every 24 hours and login) and `com.villacheck.monitor` (every 10 minutes and login) run only while the operator Mac is on and connected. Health/backup failures request a local macOS notification; a successful notification command does not prove the user saw it. Set an approved HTTPS ALERT_WEBHOOK_URL for external alerts if required. Local archive and key on one Mac are not an offsite disaster-recovery copy. Approve and configure separate storage before claiming 24/7 hosted operational acceptance.

Inspect jobs with `launchctl print gui/$(id -u)/com.villacheck.backup` or `.monitor`, inspect sanitized JSONL logs, and keep the recovery key secure. Stop a job using `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.villacheck.backup.plist` (or monitor); stopping does not delete backups or keys.

SMTP connection-only verification is available in Admin Settings and does not send an email. SMTP host/credentials are not exposed; diagnostics expose category, port/TLS settings and presence flags only. Port 465 selects implicit TLS automatically when SMTP_SECURE is unset; explicit settings remain authoritative. A connection-only success is not an inbox acceptance result.

## Management confirmations — 19 October 2026

- Receiving account: waiting for the new VillaCheck company account. Existing bank/name/number/account-type/PromptPay fields remain available; preserve Dummy testing and do not claim a real account or transfer is approved.
- SMTP: provider or sending account awaiting confirmation. Preserve historical SMTP 535 evidence; configure provider-approved credentials only after confirmation.
- ThaiBulkSMS: user confirmed Token purchased and Sender Name submitted, pending provider approval. Existing OTP results do not certify the new Sender Name. No additional test messages sent for this confirmation.
- Designated approval Admin: support@villacheckth.com. The private `approval:reviewer_email` setting limits bank review to this account. It may also propose and approve its own bank request; dual approval is not required. Other Admins can propose but cannot approve/reject bank requests while this restriction is configured. Manage this setting through authorized operator configuration, not public signup. Initial login credential is stored privately in the operator keys directory, outside Git; do not paste it into reports or chat.
- UAT owners: คุณปริ้นท์ and คุณเกมส์. Naming owners is not a Pass or Production Acceptance; record their actual evidence in the acceptance register.
- Facebook stays disabled pending Meta approval; preserve OAuth implementation and callback configuration.

## Canonical Git and Vercel connection

- GitHub: https://github.com/devwaygocargo-oss/VillaCheckTH (`main`).
- Local `origin` points to the company repository; local `legacy` preserves https://github.com/dewpm/DesignVillaCheck-finish as a historical remote. Push releases with `git push origin main`.
- Vercel team/project: `villa-check/design-villacheck`. Git integration deploys company `main`.
- Production: https://design-villacheck.vercel.app/
- Vercel Dashboard Framework Preset: `nextjs`, matching `vercel.json`. Build command `npm run build` and output `.next` are declared in `vercel.json`; Dashboard overrides may remain unset.
