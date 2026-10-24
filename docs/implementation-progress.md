# Implementation progress — final checkpoint, 24 October 2026

| Task | Priority | Status | Files changed | Tests | Remaining issues |
|---|---|---|---|---|---|
| PDF ครบ 11 หน้า, repo audit, isolated branch | P0 | COMPLETED | implementation-plan.md, architecture-refactoring-plan.md | Baseline 213 pass / 8 skip | No production inspection claimed |
| Public QR/list/media privacy and quotas | P0 | COMPLETED | app.mjs, property-media.mjs, Backoffice.tsx | public-privacy, users, media-approval, read-performance | Trusted proxy/account-wide auth quota expansion remains later operational work |
| Verified password signup and legacy mailbox recovery | P0 | COMPLETED | password-registration, email-identity, login-otp, PasswordRegistration | signup HTTP, OTP, async compatibility, slow-provider concurrency | Real delivery acceptance blocked |
| Build/seed safety and browser headers | P0/P2 | COMPLETED | package.json, seed-public-demo, next.config, layout | security-hardening, Next production, build/lint/typecheck | Explicit operator migration still required |
| Invoice gating, amount QR, receipt reuse, mail lifecycle | P1 | COMPLETED | app, database, manual-proof, mail | bank-receiving, manual-proof, mail-reminder, workflows | Existing production invoices require reconciliation |
| BL-01 confirmed pricing and immutable grants | P1 | COMPLETED | basic-promotion, catalog, VillaPackagePanel | confirmed-business, package/subscription workflows, Chrome | Basic paid onboarding/renewal BLOCKED until terms confirmed |
| BL-02 exact calculation and value-loss prevention | P1 | COMPLETED | proration, payment-service, app | partial cycle / 100% / expiry / repeated / missing dates | Upgrade/downgrade settlement flow BLOCKED pending decisions |
| BL-03 Omise test integration / HTTP boundary | P1 | COMPLETED | omise, omise-http, gateway DTO/panel | Mock create/status/webhook, amount/currency, replay, reversal, legacy history | Actual provider and source UI BLOCKED |
| BL-04 independent paid/approval/verification states | P1 | COMPLETED | payment-service, app, Merchant UI | Every payment/renewal awaits approval, legacy multi-Villa regression | No automatic verification on payment |
| BL-05 approved versions, media privacy and QR rotation | P1 | COMPLETED | approval-history, villa-review/pages, media, owner-verification | Draft history, stale/duplicate rejection, old QR, retained proof files | Old QR/public pending policy Pending Decision |
| BL-06 package capabilities and guarantee copy | P1 | COMPLETED | package-entitlements, reviews, catalog/content | Price-independent moderation and guarantee suppression | Legal guarantee scope BLOCKED |
| BL-07 single authorized Admin + audit/outbox | P1/P2 | COMPLETED | change-approvals, bank-receiving, approval-history, Admin notice | Single/self approval, configured reviewer, duplicate/stale, actor/outbox | External Owner delivery BLOCKED |
| Leads direct link/reload, pricing/mobile and public QR UX | P2/P3 | COMPLETED | AdminBusiness, OperationsPortal, Backoffice, pricing | Chrome headless 4 checks, mobile 390px | Physical devices and broader visual UAT not exercised |
| Full regression and compilation | P0 | COMPLETED | validation evidence, test-postgres/browser scripts | PostgreSQL 242/242; SQLite 234 pass + 8 skip; build/typecheck/lint exit 0 | No provider acceptance claimed |
| Schema/adapter/routing consolidation and per-Villa SSR | P3/P4 | NOT STARTED | architecture-refactoring-plan.md | Audit only | Follow-up; Nest/database architecture preserved |
| Real Omise, SMTP and Owner destination acceptance | P1/P2 | BLOCKED | omise-test-integration.md, pending-business-decisions.md | Mocks only | Credentials/provider acceptance, Owner channel and business decisions |

## Baseline and validation history

- Initial repository had modified `.DS_Store` and untracked audit-results/reports; preserved and excluded from session commit.
- Initial suite: 221 tests, 213 passed, 8 skipped, 0 failed (SQLite).
- Tests were updated only where owner-confirmed behavior superseded old expectations: OTP before signup, payment before separate approval, QR rotation after approval, and unique synthetic receipts for distinct payments.
- First PostgreSQL run identified an obsolete Nest immediate-verification assertion; it was corrected to exercise explicit Admin approval. Final PostgreSQL/Nest/Next run has no skips or failures.
- Automatic review initially rejected a broader async hashing edit. Read-only compatibility checks established identical legacy hashes; the accepted narrower change only moves login verification off the event loop and does not change stored hashes or hash-writing format.
- No live credentials, real customer messages, production migration, deploy, merge or push was used. Full Thai report: final-implementation-report.md.
