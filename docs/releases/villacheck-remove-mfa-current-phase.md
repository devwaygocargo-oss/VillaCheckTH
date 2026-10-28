# VillaCheck — Remove MFA, Current Phase

29 October 2026, Asia/Bangkok. **Staging deployed and verified: 12/12 canonical authentication cases PASS. Production deployment remains held.**

MFA code was removed from the dirty workspace, and one proven MFA-only hold on an existing internal Production Admin was repaired. Primary-login OTP, passwords, sessions, RBAC, rate limits and audit logging were preserved. No OWNER role or new role hierarchy was introduced.

Both audited live application variants were already free of runtime MFA before this task. Staging and Production therefore need to retain their respective existing feature baselines; this report does not describe their earlier MFA removal as a new deployment.

## Security incident and immediate release hold

**A Production diagnostic deployment-protection bypass credential was exposed in tool output during a private browser probe.** A pending `route.fetch` operation failed after its browser context closed, and its diagnostic error included the outgoing protection header. The credential value, any fingerprint of it and the raw diagnostic output are deliberately absent from this report and release evidence.

The incident was disclosed to the user, with an apology. No application account login completed in that probe; no account password or Google OAuth secret was exposed by it. This credential protects deployment access and is separate from application-user passwords and sessions. It must nevertheless be treated as exposed. [Vercel automation-access documentation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

**Further Production private website probes and new deployment are halted.** Explicit approval to rotate the affected credential is pending. The exposed credential has **not been rotated or revoked**; successful containment is not claimed. A gated rotation helper is prepared offline and has passed 28 mock tests with zero live rotation calls. It must not mutate configuration before approval. Review the [exact rotation proposal](evidence/remove-mfa-current-20261029/diagnostic-automation-rotation-plan.json) and [approval-gated helper](../../scripts/rotate-production-diagnostic-automation.mjs).

The browser helpers now sanitize errors, finish pending operations before closing contexts and suppress raw child-process output. Six child-process safety cases and one transport case passed, including a fake credential header. These mitigations do not revoke the exposed credential. After approved rotation, verify that the old credential is rejected, the replacement works and existing deployment protection is retained before resuming Production smoke tests or deployment.

## Implementation and account-state repair

- Removed workspace Admin setup/challenge UI, navigation integration and factor fields from the Admin login request.
- Removed backend factor consumption, privileged-session and step-up enforcement, enrollment/status/confirmation/challenge routes and obsolete MFA configuration requirements. Current-phase phone-registration, provider and financial guards remain.
- Removed the unused MFA service and its positive enforcement tests. Active lifecycle/manual QA helpers now use supported Admin password login. Historical evidence remains; the old MFA-era release builder explicitly refuses execution.
- Future internal-account provisioning no longer creates an MFA enrollment requirement or an MFA-only suspension. It retains its explicit scope, operator verification, role checks and account-control metadata.
- Kept legacy encrypted factor, recovery and enrollment records as inert private history. No destructive migration or security-data deletion was performed. Generic security suspensions remain enforced.

The existing owned internal Production Admin had an exact, historical suspension solely for pending MFA enrollment. The narrow repair changed **two settings and added one audit record**, retaining the previous reason in retirement metadata. It did not create an account or modify user rows, password hashes, roles, factor records, sessions or business data. An initial attempt used the wrong audit-column name and rolled back completely. The corrected helper uses the application's existing `audit()` service and its actual `target_id` contract; it passed 33 SQLite and 6 PostgreSQL tests before the successful repair. A repeat is idempotent.

Repair evidence: [repair receipt](evidence/remove-mfa-current-20261029/production-mfa-only-hold-repair.json), [PostgreSQL verification](evidence/remove-mfa-current-20261029/production-mfa-only-hold-postgres-tests.json). The repair preceded the incident-related halt. Subsequent read-only database-preservation checks and an anonymous SSO redirect check did not use the exposed bypass credential; no further private website probe or account login occurred.

## Files changed

The workspace cleanup covers **32 scoped paths**, recorded against pre-edit backups rather than against the already-dirty Git tree. Unrelated changes were preserved. The reviewable patch is [workspace-mfa-removal.patch](evidence/remove-mfa-current-20261029/workspace-mfa-removal.patch); original/after manifests are retained under `/tmp/vc-mfa-root-before/`.

| Area | Paths |
| --- | --- |
| Frontend | `src/AdminLogin.tsx`, `src/api.ts`, `src/prototype.tsx` |
| Removed | `src/PrivilegedMfa.tsx`, `server/privileged-mfa.mjs`, `server/privileged-mfa.test.mjs` |
| Backend | `server/app.mjs`, `server/index.mjs`, `server/current-phase-release.mjs`, `server/staging-interactive-policy.mjs`, `server/password-recovery.mjs`, `server/internal-test-provisioning.mjs` |
| Backend tests | `server/no-mfa.test.mjs`, `server/internal-test-provisioning.test.mjs`, `server/current-phase-release.test.mjs`, `server/current-phase-integration.test.mjs`, `server/owner-rollout-preparation.test.mjs`, `server/security-candidate-preservation.test.mjs` |
| Browser/manual helpers | `scripts/verify-full-lifecycle-browser.mjs`, `scripts/verify-isolated-phone-browser.mjs`, `scripts/verify-security-closure-browser.mjs`, `scripts/capture-local-cms-manual-v4.mjs`, `scripts/capture-local-upload-manual-v4.mjs`, `scripts/capture-local-manual-workflows-v4.mjs`, `scripts/capture-local-qr-reply-manual-v4.mjs`, `scripts/cms-manual-candidate.test.mjs` |
| Scoped QA runners/retired builder | `scripts/run-compose-security-20261029.mjs`, `scripts/run-protected-envelope-browser.mjs`, `scripts/run-protected-envelope-postgres.mjs`, `scripts/run-composed-lifecycle-browser-20261029.mjs`, `scripts/test-security-candidate-postgres.mjs`, `scripts/prepare-security-closure-candidate.mjs` |

Additional current-task operator/test files include `scripts/remove-current-mfa-only-hold.mjs`, `scripts/mfa-only-hold-repair.test.mjs`, `scripts/mfa-only-hold-repair-postgres.test.mjs`, `scripts/run-mfa-only-hold-postgres-tests.mjs`, `scripts/mfa-current-variants.test-runner.mjs`, `scripts/mfa-current-oauth.test-runner.mjs`, `scripts/mfa-current-context.mjs`, `scripts/mfa-current-provider.mjs`, `scripts/prepare-mfa-current-release.mjs`, `scripts/verify-mfa-current-browser.mjs` and the browser-safety/transport helpers and tests. The pushed release manifest identifies the reviewed versions; later verification-only receipts are reported separately. The actual `.env` and external login-provider credentials were not changed by the MFA cleanup.

## Authentication and verification

OTP used as the primary login method was retained. Customer OAuth reauthentication used to protect account linking, password changes or logout-all was not removed as though it were MFA.

| Role | Local/frozen-source verification | Current live verification |
| --- | --- | --- |
| USER | PASS: supported password login, role-bound sessions, CSRF/origin checks, RBAC and logout | Staging canonical post-deployment browser: 4/4 TH/EN desktop/mobile cases PASS without MFA, including RBAC, session reload and logout. Production private smoke halted; live Production authentication NOT VERIFIED. |
| MERCHANT | PASS: supported password login, role-bound sessions, CSRF/origin checks, RBAC and logout | Staging canonical post-deployment browser: 4/4 TH/EN desktop/mobile cases PASS without MFA, including RBAC, session reload and logout. Production private smoke halted; live Production authentication NOT VERIFIED. |
| ADMIN | PASS: password login without factors, retained-factor inertness, existing-session access, RBAC and current-password protection | Staging canonical post-deployment browser: 4/4 cases PASS without MFA. Production MFA-only hold repaired; actual Production login NOT VERIFIED in this task. |
| SUPER_ADMIN | N/A — this role does not exist in the current application role model | Not fabricated, provisioned or tested. No OWNER role added. |

| Login/session flow | Verified result and limit |
| --- | --- |
| Email/password | Local PostgreSQL and frozen-source checks passed for the three implemented roles; Staging predeploy and final canonical authentication each passed 12/12 cases. Production live role acceptance is NOT VERIFIED. |
| Email OTP | Generation, verification, expiry/rate/replay behavior and session code preserved and locally tested. Actual delivery is **NOT VERIFIED**; the audited live channel remains disabled. |
| Phone OTP | Primary phone/SMS code, normalization, verification and session creation preserved and locally tested with isolated adapters. Actual SMS delivery is **NOT VERIFIED**; the audited live channel remains disabled. |
| Google OAuth | Existing code/configuration and credentials preserved. Mocked existing-account linking/callback/session regressions passed for User and Merchant on both frozen variants. A full real Google callback is **NOT VERIFIED** by this task. |
| Sessions/logout | Local tests and 12/12 final canonical Staging cases passed cookie/session checks, role isolation, reload and logout. Production live acceptance is NOT VERIFIED. |

Quality evidence:

- Lint, TypeScript and production builds passed for both frozen application variants: [Staging quality](evidence/remove-mfa-current-20261029/staging-local-quality.json), [Production quality](evidence/remove-mfa-current-20261029/production-local-quality.json). Root workspace checks also passed.
- Workspace backend: **25/25 disposable PostgreSQL tests** and **8/8 local tests** passed; frontend SSR: **3/3** passed. These are local results, not live delivery claims.
- Independent tests against actual frozen source: **Staging 7/7 and Production 7/7** passed. Runtime imports were bound to each artifact; all 347 Staging and 222 Production files were verified before/after. No dirty-root runtime, live database or external provider was used: [paired result](evidence/remove-mfa-current-20261029/frozen-variants-independent-security.json).
- Mocked customer OAuth preservation: **Staging 4/4 and Production 4/4** passed for User/Merchant × Google/LINE. Existing test assertions were unchanged; temporary import bindings used each frozen runtime. Checks include state/PKCE, invalid/cancelled/expired flows, existing-only signup policy, current-password and CSRF protection for linking, duplicate/cross-account refusal, role-bound callback sessions, logout and audit. All provider responses were local adapters and outbound HTTP was blocked; this does **not** verify a real provider callback. [Paired mock result](evidence/remove-mfa-current-20261029/frozen-variants-oauth-existing.json).
- Account-hold repair: **33/33 SQLite and 6/6 PostgreSQL tests** passed, including real audit schema, exact two-setting change, idempotency, refusal of generic suspensions and rollback on compare-and-set/audit failure.
- Final live Staging predeploy authentication suite: **12/12 PASS** — all three implemented roles × desktop/mobile × TH/EN, without MFA. [Final predeploy receipt](evidence/remove-mfa-current-20261029/predeploy-auth-final/staging-browser.json). Earlier attempts failed on `networkidle` and locale-hydration waits; a later 11/12 diagnostic also exposed a risk that a language guard could be skipped. The harness now waits for and checks the required language control/locale. Diagnostic receipts were retained. No application or localization code changed for these QA corrections. The separate post-deployment canonical suite then passed **12/12** using the safe browser wrapper: [canonical receipt](evidence/remove-mfa-current-20261029/staging-canonical/staging-browser.json).
- Browser/logging safety: **6 child-process safety + 1 transport** cases passed. Credential rotation: **28 mock tests PASS**, zero actual rotation calls. No Production private attempt occurred after the incident halt.
- Production private probe failed and triggered the incident hold above. It is not a successful login or smoke-test result. The later anonymous Production request retained the expected **302 SSO redirect**; this verifies guest protection only and does not establish credential revocation or authenticated acceptance.

## Authentication API surface

| API | Current-phase behavior |
| --- | --- |
| `POST /api/auth/login`, `/api/auth/admin-login` | Supported primary password login; no MFA fields/challenge required. Existing role/portal restrictions remain. |
| `GET /api/auth/me`, `/api/auth/admin-me`; `POST /api/auth/logout`, `/api/auth/admin-logout`, `/api/auth/logout-all` | Existing role-bound sessions, refresh reads, logout and revocation retained. |
| `POST /api/auth/otp/request`, `/api/auth/otp/verify` | Primary-login OTP retained; actual delivery availability is unchanged. |
| Existing OAuth `start`/`callback` and authenticated `link`/`reauth` routes | Provider integration and account-security reauthentication retained; no provider credential change. |
| Existing password-change/recovery endpoints | Current-password/origin/CSRF protections and recovery restrictions retained. |
| Retired `/api/auth/mfa/status`, `/api/auth/mfa/enroll`, `/api/auth/mfa/confirm`, `/api/auth/mfa/step-up` | No factor service or enrollment/challenge operation remains. Negative tests verify no secret exposure or retained-factor mutation; environment route guards may reject an unavailable route before the generic 404. |

## Release and deployment status

The pushed Git release envelope preserves two previously different application variants. Staging has 247 application/source files plus 100 Staging-only assets; Production has 222 files. **Application bytes are not identical between environments.** This prevents silently deploying the 13 unrelated features still held from Production, or rolling them back on Staging. A shared envelope commit must not be described as application-byte parity.

| Item | Actual value / pending field |
| --- | --- |
| Original local Git HEAD, preserved | `c1b73bd7e1310d94ffa746b2f5f4d66219566ae7` |
| Pushed release-envelope commit | `db93c2774be6cca47347a95385e122845b1ffdcb` |
| Pushed release branch | `release/remove-mfa-current-20261029-db93c277` |
| Frozen source verification | **569 variant files verified**: 347 Staging and 222 Production; application-code parity is explicitly false |
| Staging URL | https://design-villacheck.vercel.app/ |
| Audited Staging source | `57885ae245c5652633035c85dd71846440119cb7` |
| Audited Staging deployment | `dpl_DgWB9tCJwuzRBLNyuTXq5PWWL6QE` |
| New task Staging deployment | `dpl_AgABBT6fuGSjj7KoZCxX6FHv8AQu` — **READY, PROMOTED to canonical URL** |
| New task Staging immutable URL | https://design-villacheck-5fpon32yf-villa-check.vercel.app |
| New task Staging release commit | `db93c2774be6cca47347a95385e122845b1ffdcb` |
| New task Staging canonical acceptance | **PASS — 12/12 canonical browser cases; configuration preserved; final data audit PASS** |
| Production URL | https://www.villacheckth.com/ |
| Retained Production source | `39325cc8f028f58ef9787c1b9f5f0122570f1850` |
| Retained Production deployment | `dpl_DCuj1oySbaWhBdt5XkbAwojnby23` |
| New task Production deployment | **HELD — credential-rotation approval and fresh verification required** |

The baseline bindings and [runtime layout](evidence/remove-mfa-current-20261029/runtime-layout.json) record zero application-file changes relative to each environment baseline. The workspace cleanup is preserved separately as a reviewed patch. The Staging deployment above is Ready and promoted; its canonical browser and final preservation receipts passed. [Deployment](evidence/remove-mfa-current-20261029/staging-deployment.json), [promotion](evidence/remove-mfa-current-20261029/staging-promoted.json), [canonical QA](evidence/remove-mfa-current-20261029/staging-canonical/staging-browser.json). No new Production deployment is claimed.

## Database safety and remaining considerations

- Separate PostgreSQL targets remain: Staging `neondb` in Neon `twilight-leaf-26518545`; Production `villacheck_production` in `green-sun-56847773`. No database connection or environment-isolation configuration was changed.
- Final read-only preservation audits **PASS in both environments**: all seven compared tables are unchanged after excluding only expected user `last_login` activity; all pre-existing session records are retained unchanged and legacy factor records are unchanged. Staging remains **60 users, 70 Villas, 278 documents**; Production remains **4 users, 0 Villas, 0 documents**. No MFA-only account hold remains in either environment after the owned internal Admin repair. [Staging audit](evidence/remove-mfa-current-20261029/staging-after.json), [Production audit](evidence/remove-mfa-current-20261029/production-after.json).
- No schema migration, reset, truncate, user/password/role rewrite, factor deletion or demo-data seed was performed. The intentional Production delta was only the two MFA-hold settings and one audit described above. No new Production demo business data was added by this task.
- Removing privileged MFA reduces protection if a supported primary credential is compromised. Existing password hashing, primary-login OTP, secure session cookies, rate limiting, RBAC, CSRF/origin checks, current-password/account-link reauthentication and audit logging remain necessary. Generic account suspensions must not be cleared as part of MFA removal.
- Retained factor data is private inert history, not an enrollment requirement. Do not restore an old MFA-enforcing build or reset the database to undo this change. Retain the audited MFA-free baselines for rollback, and never restore the exposed diagnostic credential during rollback.
- Required next gates: explicit Production credential-rotation approval and verified revocation; then authorized non-destructive Production smoke/deployment from the verified envelope. Staging promotion, canonical browser acceptance and final preservation audits are complete. No new provider configuration, OWNER role or real OTP delivery is inferred from a local PASS.

Staging acceptance is complete for the three implemented roles and supported password/session flows tested. Full external OAuth/OTP delivery, a nonexistent SUPER_ADMIN role and new Production deployment/authenticated acceptance are not claimed.
