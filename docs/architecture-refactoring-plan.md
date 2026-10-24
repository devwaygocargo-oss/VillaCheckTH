# Architecture audit and later refactoring

Reviewed against the actual repository on 24 October 2026. The scaffold AGENTS.md description of Vite is stale; runtime evidence is package.json, app/, pages/api/[...route].ts, backend/, and server/README.md.

| Area | Current state | Follow-up and acceptance criterion |
|---|---|---|
| Next / Nest / domain routing | Next Pages API forwards into Nest; Nest reuses server/app.mjs. Legacy Vercel handler remains a separate tested entry point. | Keep Nest this session. Extract individual domain routers gradually and run the same HTTP contract tests on both adapters. |
| Database adapters | Prisma raw SQL in backend/prisma.service.ts and pg in server/postgres.mjs; SQLite for isolated fast tests. | Keep PostgreSQL and SQLite support. Consolidate SQL translation/row coercion only after comparative tests pass. |
| Schema | Prisma migrations, PostgreSQL bootstrap SQL, business-schema.sql and SQLite DDL overlap. | Make Prisma migrations the canonical deployment source incrementally; compare empty/legacy-schema upgrades before removing bootstrap DDL. No database reset. |
| Transaction locking | PostgreSQL adapters serialize write transactions with a global advisory lock. | Move to bounded row/entity locks with concurrency tests. OTP provider verification was moved outside the write transaction in this session. |
| Business metadata | Existing system_settings JSON store now holds promotion grants, approval versions, notifications, gateway intents and receipts. | Introduce indexed dedicated tables via additive migrations after operational review. Migrate existing keys idempotently, retaining records and rollback compatibility. |
| Build | Previously migration and public-demo seed ran during build. | Fixed: build compiles only. Operator runs explicit db:deploy against the chosen database. Public demo seed is explicit opt-in. |
| Frontend routing | Hash routes, client-only app, large App/Backoffice/CMS components. | Add server-rendered public Villa routes with sanitized DTOs and per-Villa metadata. Static Open Graph is present now; hash routes still limit SEO. |
| Dead/demo surfaces | Prototype fallback pages, deployment fixtures and old subscription helpers remain. | Inventory import usage before removing any route or dependency. Do not delete customer/demo data or remove Nest. |
| Operational artifacts | Many preexisting untracked audits/reports and modified .DS_Store were present. | Preserve them. Keep session commits limited to selected source/tests/docs. Revisit artifact retention separately. |

No architecture replacement or production migration was performed. Package-wide legacy invoices remain compatible with manual review, with all affected Villas queued for approval; conversion to Omise requires reconciliation first.
