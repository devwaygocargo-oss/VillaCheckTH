# VillaCheck implementation plan — 24 October 2026

Source of authority: owner's pasted request and BL-01–BL-07. Read all 11 PDF pages; PDF suggestions to remove NestJS, delete production demo data, and require dual approval are not authorized and will not be followed.

Branch: `fix/autonomous-business-security-20261024`. Existing untracked audits/reports and `.DS_Store` belong to the user and are preserved.

1. P0: restrict QR personal data to explicit admin inspection; hide internal reviewer IDs; rate limit public lookups and account-based pre-transfer checks; reject reserved upload names; secure verified email account recovery.
2. P0/P2: remove database mutation from build and make demo seeding explicit opt-in; add browser security headers.
3. P1: implement exact, policy-neutral remaining-value calculations; block lossy package changes pending settlement decisions; separate payment receipt from approval; retain immutable approved Villa snapshots and rotate QR after approval.
4. BL-01: expose Basic regular/discount/net pricing, preserve grant history, configurable promotion.
5. BL-06/07: capability-driven review moderation, suppress unconfirmed guarantee claims, single authorized approver with durable Owner notifications and audit.
6. BL-03: official Omise docs, test-only integration boundary with mocked tests; never use live keys or claim real provider validation without credentials.
7. Run relevant regressions, full existing suite, lint, typecheck and database-free production compilation. Document partial coverage and pending decisions.

Baseline: 221 tests, 213 passed, 8 skipped, 0 failed (SQLite). Local HTTP tests require sandbox escalation. No production services accessed.
