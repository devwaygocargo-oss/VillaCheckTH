# VillaCheck Backend

Current runtime: Next.js 16 / React 19 frontend, NestJS 12 integration, Prisma 7 and PostgreSQL. Domain services live in `server/*.mjs` and are reused by Nest. Vite is not the runtime. SQLite remains an isolated legacy test fixture only. See [deployment and operations](../DEPLOYMENT.md).

## Development and checks

Use Node.js 24, `npm ci`, `npm run db:deploy` against a designated development database, and `npm run dev`. Next serves `/api` through `pages/api/[...route].ts` and the compiled Nest runtime. `npm run backend` starts standalone Nest when needed.

`npm run typecheck` and `npm run lint` are read-only checks. `npm run build` also deploys database migrations and may seed demo fixtures: never run it against an unintended database. Integration tests use `TEST_DATABASE_URL` and isolated schemas. Audit harnesses in `audit-results/` start disposable PostgreSQL and clear real environment values. They never send actual OTP, email or money.

## Authentication and privacy

User and Merchant registration are separate; role is assigned by the server. Admin login is `/admin/login`. Passwords are hashed. Sessions use HttpOnly cookies; authenticated writes require origin validation and CSRF. Going to the public homepage preserves login until logout or session expiry.

Google, LINE and Facebook OAuth support User and Merchant flows. Merchant identity linking is explicit and session-bound; matching an email never silently links accounts or elevates privileges. OAuth state is single-use and cookie-bound. Google/LINE use PKCE; LINE verifies nonce. Provider tokens are not returned to the browser. OTP supports SMS/email with delivery/verification diagnostics and quotas controlled by the provider.

Callbacks are `${APP_URL}/api/auth/oauth/{google|line|facebook}/callback`. Configure provider credentials only in server environment variables. Facebook additionally requires the CMS enable flag and completion of Meta verification/review/publishing. Prepared callback code does not mean Facebook is approved for Public Users.

Public QR responses omit sensitive contact/bank fields for guests. Logged-in Users may see eligible details. Admin uses the protected Admin verification view and can review full fields without a User account. Private documents require ownership or Admin privileges.

## Packages, coupons and payment

A Merchant subscription controls capacity for all owned Villas. Each Villa needs separate document approval and has its own persistent verification QR. Package selection itself does not activate paid rights. Initial paid approval creates one account invoice; additional approvals reuse an outstanding invoice. Manual slip confirmation activates the subscription and approved Villa QRs. Duplicate confirmations cannot extend twice.

Monthly initial/renewal validity is configurable in CMS (defaults: 3 / 1 months); quarterly/yearly rules are 3 / 12 months. New invoices snapshot amount, duration and receiving bank. Changes to pricing, promotions or banking never rewrite old invoices. Basic is a one-time free trial. Active paid plans allow eligible upgrades/current renewal; expired accounts can choose another paid plan only when it fits Villa usage.

Admin manages coupons under Packages: fixed satang or percentage (maximum 90%), package restrictions, UTC start/end, total use limit and once per Merchant. Merchant enters a code when choosing a package/renewal/upgrade; the server revalidates when generating the invoice. An expired pre-invoice code must be changed or cleared. Discount remains below invoice total; no free paid invoices bypass manual review. Usage is reserved atomically at invoice creation and is not released automatically. Invoice discount snapshots survive later promotion edits.

## Receiving bank and dual approval

Receiving-bank fields include bank, holder, account number, account type and phone/tax-ID PromptPay bound to that account. The static QR is amount-free. Payment-email PromptPay PNGs encode the immutable invoice amount and receiver. Automatic invoice emails also keep the QR linking to the payment page; that QR is not a bank transfer QR.

Production runtime requires a different Admin to approve a bank change or CMS publish proposal. The proposer cannot approve/reject their own request. Direct bank save/CMS publish endpoints reject bypass attempts. Proposal revision checks prevent approving stale drafts. Create the second real Admin through the operator provisioning script; do not create shared dummy Admins in production. CMS restore creates a draft and still needs approval before publishing.

## SMTP and worker

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`; port 465 uses `SMTP_SECURE=true`, port 587 STARTTLS. Use an approved provider credential or Gmail App Password, never a normal Gmail password in code or chat. OTP delivery is separate from payment-email acceptance.

Outboxes have leases, retries/backoff, stable Message-ID and Admin retry. Delivery is at-least-once; SMTP acceptance does not guarantee inbox delivery. Manual bank-email recipients must have a positive pending package invoice; paid, submitted and trial invoices are excluded. Retry retains original bank/amount, and stops if its invoice is no longer pending. Automatic email includes amount-specific bank PNG when a validated receiving-bank snapshot exists. Legacy invoices without such a snapshot retain the original payment-page QR and instructions; reconcile before using real money.

Demo Mode and `.example` recipients never send actual mail. Public-facing payment UI suppresses real-transfer QR in Demo Mode. Never disable Demo only to manufacture a passing acceptance result.

Vercel calls worker after requests and daily at `/api/ops/cron` (02:00 UTC / 09:00 Thailand) when `CRON_SECRET` is configured. It rejects unauthenticated calls; last run is visible in readiness. An operator can run an authenticated external schedule more frequently if required. Backup and monitoring require operator configuration as described in DEPLOYMENT.md.

## UAT evidence

Admin Settings has an append-only acceptance register: area, pass/fail/blocked, evidence and recorded reviewer. It records manual Admin attestations, not automatic proof. Use real-device/account results only when actually observed. No password, OTP or provider key belongs in evidence.

Protected operational APIs: `/admin/change-approvals`, `/admin/promotions`, `/admin/acceptance`, `/admin/readiness`, `/admin/receiving-bank`. Merchant coupon selection: `POST /subscription/coupon`. All existing Villa, invoice/proof/confirm/reject and package endpoints remain under `/api`.
