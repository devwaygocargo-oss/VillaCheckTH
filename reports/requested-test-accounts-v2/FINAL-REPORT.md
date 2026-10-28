Staging provisioning and verification completed on 29 October 2026 (Asia/Bangkok). Production is prepared but has not been provisioned because separate explicit approval is still pending.

| Environment | Email | Role | Account Status | Login Status | RBAC Status |
| --- | --- | --- | --- | --- | --- |
| Staging | testuser@gmail.com | USER | Provisioned / active | PASS (Desktop + Mobile) | PASS |
| Staging | testmerchant@gmail.com | MERCHANT | Provisioned / active | PASS (Desktop + Mobile) | PASS |
| Staging | testadmin@gmail.com | ADMIN | Provisioned / active | PASS (Desktop + Mobile) | PASS |
| Production | testuser@gmail.com | USER | Not provisioned; approval pending | NOT RUN | NOT RUN |
| Production | testmerchant@gmail.com | MERCHANT | Not provisioned; approval pending | NOT RUN | NOT RUN |
| Production | testadmin@gmail.com | ADMIN | Not provisioned; approval pending | NOT RUN | NOT RUN |

Provisioning method

- Used scripts/provision-requested-test-accounts-v2.mjs through the operator-only execute/context scripts. The helper imports the hashPassword and audit services from checksum-verified deployed source and uses the existing salted scrypt format. No plaintext credentials are written to source, output logs or this report. The task credential is held in macOS Keychain and read only into process memory.
- Before creating anything, read-only queries confirmed that all three exact emails were absent in both databases. The script checks the complete batch for email/ID collisions, leads, linked identities and stale metadata before inserting, with a PostgreSQL transaction and advisory lock. It never resets or overwrites unmanaged accounts.
- Staging creation inserted exactly 3 users, 6 control/unverified-email metadata records and 3 audit records. No leads, subscriptions, villas, documents, listings, emails or provider identities were created. The live idempotent rerun inserted 0 users and preserved all three managed accounts.
- Labels INTERNAL TEST USER / MERCHANT / ADMIN plus requested_test_account:<UUID> markers identify these accounts. Emails are not claimed as verified; no real verification emails were sent. The Admin has the existing application role only; no infrastructure, billing, Vercel, Neon or Google Cloud ownership grants were made.

Authentication and authorization

- Existing password flows were already enabled: User/Merchant use /api/auth/login and Admin uses /admin/login with /api/auth/admin-login. Google existing-account policy and all authentication implementation files remain unchanged.
- The Staging build-owned actor scope required adding only the three exact identities. Existing actor IDs, roles and business allocations remain unchanged. The new Merchant has no villaIds and is not added to businessWriteMerchantIds. This does not globally enable password login or loosen role checks.
- Six real canonical Browser cases passed: 3 accounts at 1440px and 390px Chrome touch emulation. Verified exact identity/role, actual role dashboard, own-profile handling, cross-role endpoint denials, secure HttpOnly SameSite=Lax cookies, actual page reload, UI logout, cookie removal and server session revocation.
- A new Merchant with no business profile first sees the existing owner-information onboarding. Verification used the existing account menu to open its Merchant dashboard without creating sample business details.
- The first verifier attempt expected a populated Merchant profile; this test assumption was corrected. An additional attempt observed a privacy-request GET denied after logout began; final checks wait for profile reads and classify that exact post-logout 401 as expected. All functional checks and data-preservation checks pass in the final receipt. Failed test receipts are retained separately; no application login behavior was changed to make the tests pass.

Database isolation and preservation

- Staging: neondb, Neon twilight-leaf-26518545, endpoint ep-lively-wildflower-azuxgq19.
- Production: villacheck_production, Neon green-sun-56847773, endpoint ep-square-resonance-aohwf0z5.
- Target connections use verified TLS and exact database/schema/role checks; provider deployment source inventories are checked before operation. Production mapping also uses the existing signed attestation. These are separate PostgreSQL targets.
- Checksums of all pre-existing users and the villas, documents, leads, subscriptions, invoices and mails tables are unchanged during Staging provisioning and Browser verification. Only the 3 specifically requested user rows are excluded from the existing-user checksum. Their own last_login, sessions, audit entries and controlled account metadata change as expected. No existing real User, Merchant or Admin row was modified.
- Staging business counts stayed: 68 villas, 249 documents, 27 leads, 39 subscriptions, 6 invoices, 6 mails. These records predate this task; none were created by account provisioning.
- Production received read-only queries only. It still has 0 villas and 0 documents; no Demo Villa, Listing or sample business data was added.

Changed files

- server/staging-merchant-scope.json — append the 3 authorized Staging identities; no other account allocation change.
- scripts/provision-requested-test-accounts-v2.mjs and scripts/provision-requested-test-accounts-v2.test.mjs — exact-scope idempotent provisioner and 6 local tests covering collision, rollback, approval, source/target binding and account drift.
- scripts/prepare-requested-test-v2.mjs — exact scopes and isolated source candidate.
- scripts/requested-test-v2-context.mjs — verified provider/TLS source context, private credential read and preservation hashes.
- scripts/store-requested-test-v2-password.mjs — private non-echo stdin to Keychain; no password arguments/files/output.
- scripts/execute-requested-test-v2.mjs — read-only preflight and approval-gated operator invocation.
- scripts/deploy-requested-test-v2-staging.mjs — scope-only candidate deployment and promotion.
- scripts/verify-requested-test-v2-browser.mjs — real UI login/dashboard/RBAC/session/logout checks with business/external writes blocked.
- scripts/report-requested-test-v2.mjs — this report.
- No .env, Google auth implementation, role model, database schema or migration changes.

Deployment requirement and status

- Staging required a deploy because its existing test-actor allowlist is build-owned. Built and typechecked the isolated candidate, verified the scope-only delta and existing actor policies, deployed and promoted dpl_DxiVvDHRkTBwK11zzWrriqbU1FQ5, then verified all accounts on https://design-villacheck.vercel.app/.
- Production needs no code deployment for these identities; supported password login already exists. No Production deployment was performed for this task. Existing deployment remains dpl_DCuj1oySbaWhBdt5XkbAwojnby23 at https://www.villacheckth.com/.
- Local provisioning tests: 6/6 passed. Candidate Build/Typecheck and source-scope policy tests passed. Canonical Staging Browser: 6/6 passed. Idempotent live rerun: 0 inserts. No screenshots, traces, request bodies, cookies or tokens are persisted by the authentication verifier.

Verifier teardown note: all six assertions, server-session revocations and preservation checks completed and were saved before the final verifier process stalled during resource shutdown. Only that completed verifier process was terminated. Bounded parallel Browser/database teardown was added for future runs; the authentication results are unchanged. See verifier-teardown-note.json.

Blocker and exact Production proposal

Production provisioning is blocked only on the separate explicit approval required by the user's Production Safety instruction. Plan: create only the 3 listed identities with their assigned USER, MERCHANT and application ADMIN roles, 6 internal/unverified-email metadata entries and 3 audit entries. Do not create business records, send email, link Google accounts, change existing users or deploy code. Read-only preflight confirmed each email missing, correct DB isolation and required insert privileges. The runner and helper require approval bound to this exact request reference and actor IDs before any Production insertion. No approval has been assumed from the initial task.

Removal/control note: these identities have no business dependencies. They can be suspended using existing account-status controls. For Staging removal, remove the actor-scope entries and deploy before deleting their user rows, because runtime verification expects allocated actors to exist. Any later deletion must recheck dependencies and target only these exact IDs; no deletion was performed.

Evidence: staging-provisioned.json, staging-idempotent-rerun.json, staging-browser.json, staging-deployment.json, staging-promoted.json, source-policy-tests.json, production-preflight.json, production-ready-readonly.json and plan.json in this directory. No passwords or password hashes are included.
