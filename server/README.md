# VillaCheck Backend

Current runtime: Next.js 16 / React 19 frontend, NestJS 12 integration, Prisma 7 and PostgreSQL. Domain services live in `server/*.mjs` and are reused by Nest. Vite is not the runtime. SQLite remains an isolated legacy test fixture only. See [deployment and operations](../DEPLOYMENT.md).

## Development and checks

Use Node.js 24, `npm ci`, `npm run db:deploy` against a designated development database, and `npm run dev`. Next serves `/api` through `pages/api/[...route].ts` and the compiled Nest runtime. `npm run backend` starts standalone Nest when needed.

`npm run typecheck` and `npm run lint` are read-only checks. `npm run build` compiles only; migration is an explicit `npm run db:deploy` operator step. Public demo seeding requires both `npm run demo:seed-public` and `SEED_PUBLIC_DEMO_DATA=true`. Integration tests use `TEST_DATABASE_URL` and isolated schemas. Audit harnesses in `audit-results/` start disposable PostgreSQL and clear real environment values. They never send actual OTP, email or money.

## Authentication and privacy

User and Merchant registration are separate; role is assigned by the server. Password signup returns an Email OTP challenge and creates no account/session before verification. A short-lived HttpOnly signup cookie binds the chosen password to that browser. Existing mailbox OTP recovery revokes the original unverified password/sessions once. Admin login is `/admin/login`. Passwords are hashed. Sessions use HttpOnly cookies; authenticated writes require origin validation and CSRF. Going to the public homepage preserves login until logout or session expiry.

Google, LINE and Facebook OAuth support User and Merchant flows. Merchant identity linking is explicit and session-bound; matching an email never silently links accounts or elevates privileges. OAuth state is single-use and cookie-bound. Google/LINE use PKCE; LINE verifies nonce. Provider tokens are not returned to the browser. OTP supports SMS/email with delivery/verification diagnostics and quotas controlled by the provider.

Callbacks are `${APP_URL}/api/auth/oauth/{google|line|facebook}/callback`. Configure provider credentials only in server environment variables. Facebook additionally requires the CMS enable flag and completion of Meta verification/review/publishing. Prepared callback code does not mean Facebook is approved for Public Users.

Public QR responses omit full phone/account numbers and internal reviewer IDs for every public viewer, including logged-in Users. Users supply data to the rate-limited pre-transfer comparison form. Admin uses the protected Admin verification view and can review full fields without a User account. Private documents require ownership or Admin privileges.

## Packages, coupons and payment

New purchases are per Villa. A Merchant can create one Villa; legacy additional Villas and historical invoices are retained. Basic is one regular 990 THB plan with a 100% launch discount, net 0 THB, recorded as an immutable promotion grant without an Omise charge. Promotion end/duration/renewal terms remain unconfirmed; no indefinite-free promise is made. Admin can disable new grants through the revision-checked `/api/admin/basic-promotion` API; existing grants remain.

Every payment, including same-package renewal, records paid state separately and queues the affected Villa(s) for Admin approval. Public verification remains pending until approval. Every approved Villa information/media/detail/owner-verification revision rotates QR and archives its snapshot; old QR lookup fails closed while the old-QR policy is pending. Subscription dates/payment history are retained on information edits.

Active cross-package changes are blocked until settlement rules are confirmed. `server/proration.mjs` calculates exact unused value from actual paid amount and actual timestamps without imposing rounding, refunds, credit or cycle reset. Expired package changes and same-package renewals preserve the established invoice-duration rules. Missing paid membership dates fail closed for reconciliation.

Monthly per-Villa invoices snapshot one month, price, receiver and amount-bound PromptPay QR. Existing invoices are never repriced. Checkout refuses a positive invoice when there is no configured receiving bank/gateway outside Demo mode. Receipt SHA-256 and normalized transaction references prevent reuse across manual invoices. Queued reminders are cancelled when their invoice is no longer pending; history remains.

Omise integration is TEST ONLY: `OMISE_TEST_ENABLED=true`, private `OMISE_TEST_SECRET_KEY=skey_test_…`. Live keys are rejected. POST/GET `/api/payments/:invoiceId/omise` create/retrieve owned invoice payments; `/api/webhooks/omise` retrieves the event and charge through authenticated provider API calls before trusting a result. New enabled invoices use Omise exclusively; older manual invoices remain reviewable. Ambiguous creation is reserved and blocked from automatic duplicate retries. Provider credentials/real acceptance and checkout source UI remain required before enabling this flow for customers. See `docs/omise-test-integration.md`.

Admin manages coupons under Packages: fixed satang or percentage (maximum 90%), package restrictions, UTC start/end, total use limit and once per Merchant. Merchant enters a code when choosing a package/renewal/upgrade; the server revalidates when generating the invoice. An expired pre-invoice code must be changed or cleared. Discount remains below invoice total; no free paid invoices bypass manual review. Usage is reserved atomically at invoice creation and is not released automatically. Invoice discount snapshots survive later promotion edits.

## Receiving bank and single Admin approval

Receiving-bank fields include bank, holder, account number, account type and phone/tax-ID PromptPay bound to that account. The static QR is amount-free. Payment-email PromptPay PNGs encode the immutable invoice amount and receiver. Automatic invoice emails also keep the QR linking to the payment page; that QR is not a bank transfer QR.

One authorized Admin may propose and approve a bank request, including their own. A configured `approval:reviewer_email` still restricts who may approve. Duplicate and stale approvals fail. Actor, approver, time and outcome are retained. Owner notifications use a durable private outbox (`/api/admin/owner-notifications`), visible on the Admin dashboard; external delivery is pending the Owner destination. CMS publication remains an explicitly authorized Admin action.

## SMTP and worker

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`; port 465 uses `SMTP_SECURE=true`, port 587 STARTTLS. Use an approved provider credential or Gmail App Password, never a normal Gmail password in code or chat. OTP delivery is separate from payment-email acceptance.

Outboxes have leases, retries/backoff, stable Message-ID and Admin retry. Delivery is at-least-once; SMTP acceptance does not guarantee inbox delivery. Manual bank-email recipients must have a positive pending package invoice; paid, submitted and trial invoices are excluded. Retry retains original bank/amount, and stops if its invoice is no longer pending. Automatic email includes amount-specific bank PNG when a validated receiving-bank snapshot exists. Legacy invoices without such a snapshot retain the original payment-page QR and instructions; reconcile before using real money.

Demo Mode and `.example` recipients never send actual mail. Public-facing payment UI suppresses real-transfer QR in Demo Mode. Never disable Demo only to manufacture a passing acceptance result.

Vercel calls worker after requests and daily at `/api/ops/cron` (02:00 UTC / 09:00 Thailand) when `CRON_SECRET` is configured. It rejects unauthenticated calls; last run is visible in readiness. An operator can run an authenticated external schedule more frequently if required. Backup and monitoring require operator configuration as described in DEPLOYMENT.md.

## UAT evidence

Admin Settings has an append-only acceptance register: area, pass/fail/blocked, evidence and recorded reviewer. It records manual Admin attestations, not automatic proof. Use real-device/account results only when actually observed. No password, OTP or provider key belongs in evidence.

Protected operational APIs: `/admin/change-approvals`, `/admin/promotions`, `/admin/acceptance`, `/admin/readiness`, `/admin/receiving-bank`. Merchant coupon selection: `POST /subscription/coupon`. All existing Villa, invoice/proof/confirm/reject and package endpoints remain under `/api`.
