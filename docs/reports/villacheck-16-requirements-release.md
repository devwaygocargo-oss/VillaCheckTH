# VillaCheck — 16 Requirements Release Report

**DRAFT — local implementation and test evidence; release freeze and live verification pending.**  
Report date: 29 October 2026, Asia/Bangkok.

This draft distinguishes implemented and locally tested code from deployed behavior. No row below claims that the new release has passed Staging or Production acceptance. The root release runner must replace the pending commit/deployment fields and add actual Browser receipts before final delivery.

The source audit was completed before implementation. The application is React 19 / Next.js 16 / NestJS / PostgreSQL. The historical Vite scaffold description does not describe the deployed runtime. Extensive unrelated workspace changes were preserved. Implementation was composed in the isolated candidate `/tmp/vc16-common-wW305e` from verified deployed source instead of deploying the entire working tree.

The two supplied screenshots are layout references only. Cargo branding, third-party logos, customer identifiers, booking references and proprietary image assets were not copied.

## A. Requirement completion and impact matrix

Status meanings: **PASS** requires implementation and the stated verification; **PARTIAL** means implemented behavior still has an unverified acceptance condition; **BLOCKED** names a specific unresolved dependency or decision. A local PASS is not a live deployment PASS.

### 01 — Restore email / phone OTP login

**Overall: PARTIAL; actual delivery and activation BLOCKED. Local service/HTTP security tests: PASS.**

- Frontend: explicit Email OTP / Phone OTP / Email-and-password selection; paste-supported numeric code entry; request, verification, expiry and resend countdowns; loading/errors; conditional delivery wording and clear unavailable-channel messages. Existing password login and Google controls remain.
- Backend: reused `createLoginOtp` and the existing session implementation. Added opt-in existing-account login capability with verified email or linked `phone_otp` identity, strict User/Merchant role binding, Thai mobile validation, cryptographic code/token handling, expiry, attempts, resend limits and atomic replay rejection. Unverified, unknown or wrong-role identities cannot establish sessions or create users. Login challenges cannot be substituted for registration/linking challenges or vice versa.
- Database: no schema migration. Short-lived challenge identity metadata uses existing `system_settings`; existing OTP records, roles and password hashes retain their formats. No test accounts are created by the login-only flow.
- Candidate files: `src/OtpLogin.tsx`, login section of `src/prototype.tsx`, `server/login-otp.mjs`, `server/staging-interactive-policy.mjs`, `server/production-runtime.mjs`, `server/index.mjs`, `server/app.mjs`.
- Evidence: `server/existing-otp-login.test.mjs`, `server/app-existing-otp.test.mjs`, existing `server/login-otp.test.mjs` / `server/otp-concurrency.test.mjs`; 23 service/security/error regressions and 4 actual localhost HTTP integration cases passed. HTTP checks cover session issuance, role denials, origin validation, CSRF-protected logout, reused/expired codes, attempt/resend limits, unknown/unverified identities and stable localized error codes. Test mail/provider adapters remain isolated and do not constitute actual delivery evidence.
- Activation boundary: `OTP_LOGIN_ENABLED` defaults off. Provider staging flags and credentials were not activated or replaced. Current audited Staging and Production configurations advertise both OTP channels unavailable. Historical SMS-send consent is not reused; current authorized destinations and delivery readiness remain unresolved.
- Security caveat: uniform public response shape does **not** establish timing resistance. Eligible requests currently await provider I/O while unknown identities can return faster. Before activation, this distinction needs a delivery/timing security review and an appropriate mitigation; the disabled production capability is not described as timing-indistinguishable.
- Deployment verification: new Staging **PENDING**; new Production **BLOCKED / NOT DEPLOYED**.

### 02 — Complete Thai / English support

**Overall: PARTIAL pending deployed Browser coverage. Local foundation/catalog/type checks: PASS.**

- Frontend: shared TH/EN switching; Thai default; persisted locale; hydration-safe locale subscription; English fallback; locale-aware dates, times, numbers and currency. Static system text in public, User, Merchant, Admin and CMS interfaces is routed through catalogs. The current composed catalog contains more than 2,100 system entries; the inspected merged snapshot contained 2,306 entries.
- Backend: API requests propagate `Accept-Language`. Public error localization retains stable error codes and the existing exception/privacy filtering; technical SQL, credential and arbitrary exception details are not returned as translated user messages.
- Database/content: no schema migration. Existing bilingual property/business fields are reused. User names, review content, authored CMS values, entity IDs, route IDs, API field names, enums and raw option values are preserved. Default CMS system copy can be localized; custom authored content is not automatically translated.
- Candidate files: `src/locale.ts`, `src/LanguageSwitcher.tsx`, `src/locale.css`, `src/systemTranslations.ts`, `src/cmsCopyEnglish.ts`, `src/generatedAdminEnglish.json`, `src/generatedPortalEnglish.json`, `src/generatedPropertyEnglish.json`, `src/generatedTemplateEnglish.json`, `src/generatedCmsMetadataEnglish.json`, `src/generatedDynamicLabelsEnglish.json`, `src/cms.tsx`, `src/thaiUi.ts`, `src/api.ts`, shared layouts and the static UI consumers recorded in the codemod evidence; `server/public-error.mjs`, `server/locale-messages.mjs`, `server/app.mjs`.
- Evidence: locale unit tests passed; translated catalogs were checked for exact inventory coverage and residual Thai in English values; static AST conversion and option-value preservation are recorded in `16-requirements-evidence/locale-codemod.json` and `localized-option-value-preservation.json`. Additional map/helper consumption sites were localized explicitly without translating authored values. Locale persistence, hydration console behavior and major TH/EN journeys still require the final deployed Browser receipt.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 03 — Left sidebar design

**Overall: PARTIAL pending deployed visual/responsive verification.**

- Frontend: white sidebar, neutral default text and an active state using existing VillaCheck theme tokens; visible hover/focus states, existing icons/hierarchy and mobile behavior retained across User, Merchant and Admin portals.
- Backend/database: no role, permission, route or schema change for presentation.
- Candidate files: `src/prototype.tsx` PortalShell/navigation; `src/dashboard-documents.css`; shared localized labels.
- Evidence: source and TypeScript checks; final desktop/mobile, active-state contrast and keyboard Browser checks are pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 04 — Review system

**Overall: PARTIAL pending deployed review journeys. Local review/privacy tests: PASS.**

- Frontend: prominent score/count, rating distribution, filters, sorting, pagination, privacy-safe reviewer cards, dates and loading/error/empty states; responsive presentation using VillaCheck styling.
- Backend: published-review pagination and validated filter/sort bounds; aggregates remain consistent when filtering; private identities and internal fields are not exposed publicly. Existing eligibility, duplicate-review restrictions and moderation are retained. No verified-stay/transaction badge is fabricated.
- Database: existing review metadata and authorization model reused; no schema migration or Production ratings/reviews seeded.
- Candidate files: `src/Reviews.tsx`, `src/reviewTransferTranslations.ts`, `server/reviews.mjs`, `server/review-presentation.mjs`.
- Evidence: `server/review-bank-features.test.mjs`; local PostgreSQL integration. Three synthetic reviews were added only to newly created owned Staging fixtures by distinct existing test users. Live rendering/sorting/filtering acceptance is pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 05 — Image status ribbons

**Overall: PARTIAL pending deployed image/control inspection.**

- Frontend: stronger localized ribbons with contrast/shadow and consistent responsive positioning; status meaning preserved and controls kept clear.
- Backend/database: underlying status values and approval workflow unchanged.
- Candidate files: `src/StatusCornerRibbon.tsx`, `src/villaStatus.ts`, scoped dashboard/gallery styling.
- Evidence: source/TypeScript checks; final card/gallery overlap and mobile visual checks pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 06 — Document status wording

**Overall: PARTIAL pending deployed workflow-label verification.**

- Frontend: actual correction-request states display **รอการแก้ไข / Revision Required**. A missing initial submission remains a distinct state and is not relabeled as a correction request.
- Backend/database: no enum, historical status, notification contract or approval transition was renamed.
- Candidate files: `src/villaStatus.ts`, `src/Backoffice.tsx`, `src/OwnershipDocuments.tsx`, document translations.
- Evidence: source mappings and typed status handling; live comparison of pending/correction/missing-document states pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 07 — Remove latest checklist

**Overall: PARTIAL pending deployed dashboard verification.**

- Frontend: removed the latest-checklist/recent-check section from the relevant User dashboard and repaired its layout. The history route and functions used elsewhere are retained.
- Backend/database: no inspection/check history or workflow records were deleted.
- Candidate files: `src/OperationsPortal.tsx`.
- Evidence: source dependency review and local checks; deployed absence/responsive spacing pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 08 — Search buyer by name

**Overall: BLOCKED — buyer entity/authorization decision unresolved. Safe property-selector improvement: locally implemented.**

- Audit finding: the actual existing selector selects a **property**, while the buyer/customer associated with a check is the authenticated `user.id`. There is no confirmed contract allowing a User to search/select other buyers.
- Safe work: an accessible, debounced property-name selector supports Thai/English text, keyboard navigation, explicit selection, clearing, loading and empty states, with safe disambiguating property context. It does not auto-select a partial match or expose cross-customer records.
- Candidate files: `src/PropertySearchSelect.tsx`, `src/OperationsPortal.tsx`, related existing check APIs in `server/operations.mjs`.
- Database: no invented Buyer table, cross-customer search API or authorization expansion.
- Required decision: confirm whether “buyer” means the signed-in customer, an authorized Admin-only customer lookup, or the existing accommodation selector. The asynchronous clarification is unanswered at this draft. A working property search is **not** reported as completed buyer search.
- Deployment verification: safe selector Staging **PENDING**; buyer feature **BLOCKED**; Production **NOT DEPLOYED**.

### 09 — Pre-transfer verification UX

**Overall: PARTIAL pending deployed end-to-end checks.**

- Frontend: clearer title/explanation, selected property context, customer/session context, transfer information, comparison result and next actions; accessible responsive search and localized feedback.
- Backend: existing `MATCHED` / `REVIEW_REQUIRED` comparison, session/RBAC and idempotent request-key behavior preserved. No new banking approval, transfer initiation or payout rules were invented.
- Database: existing check history and ownership reused; no destructive changes or new approval enums.
- Candidate files: `src/OperationsPortal.tsx`, `src/PropertySearchSelect.tsx`, `src/reviewTransferTranslations.ts`, existing `server/operations.mjs` integration.
- Evidence: local API/privacy/lifecycle integration and source checks. New owned Staging property fixtures support live checks without editing existing properties; deployed workflow acceptance pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 10 — Additional photo/video attachments

**Overall: PARTIAL pending deployed upload/preview/playback checks. Local PostgreSQL quota/security/replay tests: PASS.**

- Frontend: multi-file queue, previews, remaining slots, reading/uploading feedback, per-file failures/retry and accessible responsive controls. Existing reordering and cover handling are retained.
- Backend: cover remains separate from the maximum 10 additional photos; at most 2 videos; real MIME/signature/size validation, ownership, transactional association and existing persistent PostgreSQL document storage. Vercel local disk is not used as permanent media storage.
- Added optional `uploadRequestId`: request fingerprint and stored result permit a safe replay of the same upload without another document; reuse with different content/metadata is rejected. Upload retry does not duplicate/quota-bypass successful work.
- Database: existing `documents` and additive `system_settings` media/request metadata; no schema migration, orphan quota-overflow files or reference rewrites.
- Candidate files: `src/PropertyMedia.tsx`, `src/MediaUploadQueue.tsx`, retained `src/VillaMediaGallery.tsx`, `server/property-media.mjs`, `server/villa-media-limits.mjs`, `server/media-range.mjs`.
- Evidence: `server/sixteen-postgres-integration.test.mjs` passed against disposable PostgreSQL: 10 additional photos + cover accepted, 11th additional rejected; 2 videos accepted, 3rd rejected; persisted publication/authorization; byte ranges; upload replay and conflicting replay behavior. Real Browser queue/retry/playback checks pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 11 — Remove package free-use end date

**Overall: PARTIAL pending deployed presentation check.**

- Frontend: the package route no longer presents the free-use end-date field/date. Operational expiry warnings elsewhere remain distinct.
- Backend/database: trial, subscription, billing, expiry and entitlement calculations are unchanged; no expiry fields removed.
- Candidate files: `src/Backoffice.tsx`, `src/PackageComingSoon.tsx`; package route integration.
- Evidence: source/TypeScript checks; deployed route inspection pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 12 — Package page Coming Soon

**Overall: PARTIAL pending deployed route/layout verification.**

- Frontend: centered **Coming Soon** presentation with localized supporting text, preserving the authenticated package route and balanced desktop/mobile layout.
- Backend/database: page presentation does not trigger purchases, delete package/subscription data or globally disable billing/entitlements.
- Candidate files: `src/PackageComingSoon.tsx`, `src/Backoffice.tsx`, `src/dashboard-documents.css`.
- Evidence: source and TypeScript checks; real route/access/no-purchase Browser verification pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 13 — Remove Add accommodation buttons

**Overall: PARTIAL pending deployed desktop/mobile inspection.**

- Frontend: removed the specified Add accommodation controls from the package page and Document Management page.
- Backend/database: other authorized creation paths, Villa creation API and existing Merchant entitlements remain. No Villa record was removed.
- Candidate files: `src/Backoffice.tsx`, `src/PackageComingSoon.tsx`, `src/DocumentManagement.tsx`.
- Evidence: route/source review; deployed absence checks pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 14 — Document Management terminology

**Overall: PARTIAL pending deployed navigation verification.**

- Frontend: relevant navigation, page title and breadcrumb consistently use **จัดการเอกสาร / Document Management**. Review-state labels remain distinct.
- Backend/database: route identifiers, tables and API contracts were not renamed for this copy change.
- Candidate files: `src/prototype.tsx`, `src/Backoffice.tsx`, `src/DocumentManagement.tsx`, document translation catalog.
- Evidence: source/TypeScript checks; deployed TH/EN menu/title/breadcrumb checks pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 15 — PDFs and real document statuses

**Overall: PARTIAL pending deployed authorized PDF journeys. Local authorization/header tests: PASS.**

- Frontend: actual authorized PDF records, names, available type/upload metadata, real review status, view/download controls and loading/error/empty states. Unknown legacy upload dates remain explicitly unavailable rather than invented.
- Backend: owner/Admin authorization, controlled inline viewing and attachment behavior, private caching and response hardening preserved. Unauthorized users cannot read another account's private PDF.
- Database: existing ownership/document records and review workflow reused; no Production demo document or schema migration.
- Candidate files: `src/DocumentManagement.tsx`, `src/OwnershipDocuments.tsx`, `src/Backoffice.tsx`, `server/app.mjs`, retained `next.config.mjs` protection.
- Evidence: `server/document-preview-security.test.mjs` covers owner/Admin access, cross-role/foreign-owner denial, attachment default/private caching and frame protections. New Staging-only PDF fixtures support existing/new authorized document checks; Browser viewing pending.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

### 16 — Receiving bank account details

**Overall: PARTIAL; Production writes intentionally remain blocked by existing release policy. Local API/security tests: PASS.**

- Frontend: Merchant profile receiving-account section with bank/account-holder/account-number fields, validation, masked display, edit/save and localized feedback.
- Backend: current session selects the owner; foreign owner/user identifiers are rejected; only Merchant own-account access is allowed; revision checks prevent overwrites and sensitive updates append audit events. Raw account numbers are not returned in the public DTO or logs. Platform receiving-bank and Villa bank details remain independent and unchanged.
- Database: additive owner-scoped metadata in existing `system_settings`; no schema migration, payout, transfer or external banking integration.
- Candidate files: `src/MerchantReceivingBank.tsx`, `src/MerchantProfile.tsx`, `server/merchant-receiving-bank.mjs`, `server/app.mjs`, route policies.
- Evidence: `server/review-bank-features.test.mjs` and disposable PostgreSQL API integration passed self-only ownership, masking, revision conflict and audit behavior with synthetic non-real account values. Staging policy allows only the exact authorized Merchant route and identity; the Merchant was not added to global business-write allocations.
- Production boundary: `MEMBER_PREVIEW` still denies business POSTs. This task does not silently enable Production bank writes or other business operations. Live editing acceptance cannot be marked PASS while that policy remains held.
- Deployment verification: Staging **PENDING**; Production **BLOCKED / NOT DEPLOYED**.

## B. Deployment summary

| Item | Actual audited value / current draft status |
| --- | --- |
| Local Git HEAD | `c1b73bd7e1310d94ffa746b2f5f4d66219566ae7` |
| Local branch | `fix/autonomous-business-security-20261024` |
| Repository | `https://github.com/devwaygocargo-oss/VillaCheckTH.git` |
| Audited remote main HEAD | `6ce3dce4eeaaec96f108bbd5fb4ee3ddb082100f` |
| New 16-requirement release commit SHA | **PENDING ROOT FREEZE / COMMIT** |
| New release push | **PENDING** — no push success claimed |
| New Staging source commit | **PENDING ROOT FREEZE** |
| New Staging deployment ID/status | **PENDING DEPLOYMENT AND BROWSER VERIFICATION** |
| Staging URL | https://design-villacheck.vercel.app/ |
| Staging baseline deployment | `dpl_DxiVvDHRkTBwK11zzWrriqbU1FQ5` |
| Staging baseline source | Checksum-verified scope-only source manifest; not previously committed as a complete release |
| Staging baseline source digest | `b90bc944bb2db3eb890e969963efb2a5ca5f4640ebfff8487f16bd7cc8800022` |
| New Production source commit/deployment | **BLOCKED / NOT DEPLOYED**; no new release is claimed live |
| Production URL | https://www.villacheckth.com/ |
| Existing Production deployment retained | `dpl_DCuj1oySbaWhBdt5XkbAwojnby23` |
| Existing Production source commit | `39325cc8f028f58ef9787c1b9f5f0122570f1850` |
| Existing Production source digest | `8ebddc691f7930551ec0702cfe37461ec7a01fbe835462e607ed805d7491be12` |

The old IDs above identify the audited baseline, not a successful deployment of the 16-requirement candidate. The final report must cite a new Ready deployment receipt and live checks before replacing any pending field. Production must use the exact verified release commit only after its gates pass.

## C. Database safety, backup and rollback

- **Isolation verified:** Staging is `neondb` in Neon project `twilight-leaf-26518545`, endpoint `ep-lively-wildflower-azuxgq19`; Production is `villacheck_production` in project `green-sun-56847773`, endpoint `ep-square-resonance-aohwf0z5`. TLS/target identity and deployed-source mapping are checked without exposing connection credentials.
- The read-only audit found compatible public schemas with 188 columns. No Prisma schema, package/dependency or migration change was required for this candidate. No reset, truncate, destructive migration or Production overwrite was performed.
- Audited baseline: Staging had 60 users, 68 Villas and 249 documents. Production had 4 users, 0 Villas and 0 documents. These counts are baseline observations, not a final post-deployment preservation claim.
- This task's Staging QA preparation added **2 newly owned fixture Villas, 5 fixture documents and 3 synthetic reviews from distinct existing test users**, with **0 new users** and **0 Production writes**. Existing records were preserved. These fixtures are clearly test-only; no Staging business data was copied or seeded into Production.
- No Production demo Villa, Listing, document or review was created. Previously requested Gmail Production test identities remain **unapproved and uncreated**; this task does not imply that separate approval.
- **Actual Production backup and local restore passed:** `16-requirements-evidence/continuation-backup-restore.json` records a read-only Production backup using the existing backup role, encrypted archive/metadata, restrictive permissions, no plaintext dump files, verified key readback and a disposable local restore. All 20 tables/history, columns/constraints/indexes and ownership/ACL/default privileges matched. Global role passwords were not exported and restored local roles were NOLOGIN. **No Production restore was performed.**
- Backup retention is preserved; no deletion, rotation or automated retention action is inferred.
- Rollback readiness: retain the baseline Staging/Production deployment references and verified source manifests. With no schema migration, code rollback does not require a destructive schema downgrade. Added metadata is backward-compatible and must not be removed blindly; inspect any new user activity before cleanup. Final promotion/rollback operations remain root-controlled and must recheck canonical aliases before changing them.
- Google Cloud ownership, OAuth client IDs, provider credentials, LINE integration and Facebook integration were not changed. No provider activation is implied by a successful local build.

## D. Final QA matrix

The following live statuses are intentionally pending/blocked until the root runner attaches actual receipts. They must not be changed based only on source inspection or local build output.

| Req | Local implementation / evidence | New Staging | New Production |
| --- | --- | --- | --- |
| 01 | PASS secure service/HTTP behavior; delivery/timing activation gate unresolved | PENDING; real delivery BLOCKED | BLOCKED / NOT DEPLOYED |
| 02 | PASS locale foundation, catalog and typed source checks; Browser acceptance pending | PENDING | BLOCKED / NOT DEPLOYED |
| 03 | Sidebar source implemented; visual/keyboard checks pending | PENDING | BLOCKED / NOT DEPLOYED |
| 04 | PASS review aggregate/pagination/privacy tests | PENDING | BLOCKED / NOT DEPLOYED |
| 05 | Localized ribbon source implemented | PENDING | BLOCKED / NOT DEPLOYED |
| 06 | Status mappings implemented; initial-missing state preserved | PENDING | BLOCKED / NOT DEPLOYED |
| 07 | Section removed; history retained | PENDING | BLOCKED / NOT DEPLOYED |
| 08 | Safe property selector implemented; buyer semantics BLOCKED | PENDING property search / BLOCKED buyer search | BLOCKED / NOT DEPLOYED |
| 09 | Comparison UI and existing workflow retained; local API/privacy/lifecycle evidence | PENDING | BLOCKED / NOT DEPLOYED |
| 10 | PASS PostgreSQL quota, ownership, transaction, publication, range and retry-replay tests | PENDING | BLOCKED / NOT DEPLOYED |
| 11 | Package presentation removes end-date field; expiry logic retained | PENDING | BLOCKED / NOT DEPLOYED |
| 12 | Coming Soon route implemented without purchases | PENDING | BLOCKED / NOT DEPLOYED |
| 13 | Specified Add buttons removed; other creation routes retained | PENDING | BLOCKED / NOT DEPLOYED |
| 14 | TH/EN Document Management terminology implemented | PENDING | BLOCKED / NOT DEPLOYED |
| 15 | PASS local PDF access/header security tests | PENDING | BLOCKED / NOT DEPLOYED |
| 16 | PASS local own-bank API/masking/revision/audit tests; existing release write gate retained | PENDING | BLOCKED / NOT DEPLOYED |

Local evidence available at this draft:

- Production-style candidate type checks passed after integration. Final formatting/lint/build receipts must be added by the root release runner; this draft does not invent their final exit codes.
- OTP/service/error suites: 23 passing tests; new real localhost HTTP existing-account OTP integration: 4 passing cases; locale foundation: 2 passing tests.
- Document private-preview tests and review/bank feature tests were run locally; retain their final receipts with the release rather than treating source assertions as deployed evidence.
- Disposable PostgreSQL integration completed with exit code 0, no Production connections and no live provider requests: `16-requirements-evidence/postgres-tests.json`. It covers media persistence/quota/replay/privacy and account/bank/lifecycle integration against PostgreSQL rather than relying solely on SQLite fixtures.
- Static localization inventory and transformation evidence: `locale-inventory-summary.json`, `locale-codemod.json`, the three source-group inventories, template inventory and `localized-option-value-preservation.json`.
- Browser requirements still to record against the new deployment: Desktop/Mobile routes; all three authorized roles; session reload/logout; Google configuration/flow regression without changing provider ownership; OTP unavailable/real-delivery distinctions; TH/EN persistence; CMS controls; document viewing; property search; pre-transfer comparison; gallery upload/preview/playback; review sort/filter/pagination and Merchant bank masking/save where the environment policy permits it.
- Mobile Browser emulation is not a claim of physical iPhone/Safari testing. Actual external OTP delivery or OAuth callback completion must have its own evidence and must not be inferred from mocked adapters, configuration flags or authorize-URL inspection.

## E. Remaining issues and release gates

1. **R01 current authorized delivery channels and provider activation:** both audited environments advertise Email OTP and SMS OTP unavailable. Do not reuse prior per-send permission. Current authorized test destinations/consent and actual provider readiness must be confirmed, with no credential/provider ownership change. The existing-account request timing distinction must also be reviewed/mitigated before enabling this public capability.
2. **R08 buyer entity:** the current contract binds the buyer to the authenticated User and selects a property. The user clarification is unanswered. Do not invent cross-customer access, mislabel property search as buyer search, or fabricate a Buyer model/API.
3. **Existing Production MEMBER_PREVIEW policy:** business mutations remain held. This candidate does not silently enable purchases, Merchant business edits, media writes or receiving-bank POSTs across Production to claim E2E completion. Record an explicit policy/business decision before altering that boundary.
4. **Release freeze/push and new Staging acceptance:** commit/push/deployment IDs and actual Browser receipts are pending at this draft. A local build is not a deployment success.
5. **Production promotion:** remains blocked until verified Staging, the required business/security decisions, exact commit, data preservation and all other release gates are satisfied. Do not force the unsafe step. Retain the verified Staging candidate once its acceptance finishes and provide this actionable blocker report if Production cannot proceed.
6. **No production QA data workaround:** Production has no public Villa/document fixture. Do not add fake listings, documents or ratings to manufacture acceptance evidence; use only authorized existing identities and non-destructive checks.

Evidence is stored under `docs/reports/16-requirements-evidence/`. No password, password hash, OTP, token, connection URI, full bank account number or provider secret is intentionally included in this report.
