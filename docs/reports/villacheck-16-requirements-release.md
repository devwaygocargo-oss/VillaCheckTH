# VillaCheck — 16 Requirements Release Report

Report date: 29 October 2026, Asia/Bangkok.

**Verified Staging release: 13 requirements PASS, 2 PARTIAL (01 and 09), 1 BLOCKED (08). New Production deployment is held.** The existing Production release and its records were preserved. This report does not claim that the new candidate is running in Production or that actual email/SMS delivery and OAuth callback completion were verified.

The application source is frozen and pushed at `57885ae245c5652633035c85dd71846440119cb7` on `release/villacheck-16-20261029-57885ae2`. The canonical Staging deployment is `dpl_DgWB9tCJwuzRBLNyuTXq5PWWL6QE`, Ready, with 12/12 canonical authenticated Browser cases, 2/2 immutable Browser cases, 6/6 gallery cases and 4/4 anonymous ribbon-layout cases passing.

The initial source/environment audit preceded implementation. The actual architecture is React 19 / Next.js 16 / NestJS / PostgreSQL; the Vite scaffold description is historical. Extensive unrelated workspace changes were preserved. The release was composed in the isolated candidate `/tmp/vc16-common-wW305e` from checksum-verified deployed source, rather than deploying the whole dirty workspace.

The supplied screenshots were layout references only. Cargo branding, third-party logos, customer identifiers, booking references and proprietary image assets were not copied.

## A. Requirement completion and impact matrix

Status meanings: **PASS** below means implemented and verified locally and on the new Staging release within the stated test scope. It does not claim Production deployment. **PARTIAL** identifies a delivered portion and its remaining acceptance gap; **BLOCKED** identifies an unresolved dependency or business decision.

### 01 — Restore email / phone OTP login

**PARTIAL — secure existing-account code and unavailable-channel UI verified; actual delivery, activation and timing review remain blocked.**

- Frontend: explicit Email OTP / Phone OTP / Email-and-password selection; paste-supported numeric code entry; request, verification, expiry and resend countdowns; loading/errors; conditional delivery wording and clear unavailable-channel messages. Existing password login and Google controls remain.
- Backend: reused `createLoginOtp` and the existing session implementation. Added opt-in existing-account login capability with verified email or linked `phone_otp` identity, strict User/Merchant role binding, Thai mobile validation, cryptographic code/token handling, expiry, attempts, resend limits and atomic replay rejection. Unverified, unknown or wrong-role identities cannot establish sessions or create users. Login challenges cannot be substituted for registration/linking challenges or vice versa.
- Database: no schema migration. Short-lived challenge identity metadata uses existing `system_settings`; existing OTP records, roles and password hashes retain their formats. No test accounts are created by the login-only flow.
- Candidate files: `src/OtpLogin.tsx`, login section of `src/prototype.tsx`, `server/login-otp.mjs`, `server/staging-interactive-policy.mjs`, `server/production-runtime.mjs`, `server/index.mjs`, `server/app.mjs`.
- Evidence: `server/existing-otp-login.test.mjs`, `server/app-existing-otp.test.mjs`, existing `server/login-otp.test.mjs` / `server/otp-concurrency.test.mjs`; 23 service/security/error regressions and 4 actual localhost HTTP integration cases passed. HTTP checks cover session issuance, role denials, origin validation, CSRF-protected logout, reused/expired codes, attempt/resend limits, unknown/unverified identities and stable localized error codes. Test mail/provider adapters remain isolated and do not constitute actual delivery evidence.
- Activation boundary: `OTP_LOGIN_ENABLED` defaults off. Provider staging flags and credentials were not activated or replaced. Current audited Staging and Production configurations advertise both OTP channels unavailable. Historical SMS-send consent is not reused; current authorized destinations and delivery readiness remain unresolved.
- Security caveat: uniform public response shape does **not** establish timing resistance. Eligible requests currently await provider I/O while unknown identities can return faster. Before activation, this distinction needs a delivery/timing security review and an appropriate mitigation; the disabled production capability is not described as timing-indistinguishable.
- Staging verification: OTP method selection and disabled-channel feedback passed in the 8 applicable User/Merchant viewport/locale cases within the overall 12-case canonical suite; the 4 Admin cases used password login. No real OTP was sent, and no delivery success is claimed.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 02 — Complete Thai / English support

**PASS — local localization checks, immutable Browser checks and canonical Staging TH/EN journeys verified.**

- Frontend: shared TH/EN switching; Thai default; persisted locale; hydration-safe locale subscription; English fallback; locale-aware dates, times, numbers and currency. Static system text in public, User, Merchant, Admin and CMS interfaces is routed through catalogs. The current composed catalog contains more than 2,100 system entries; the inspected merged snapshot contained 2,306 entries.
- Backend: API requests propagate `Accept-Language`. Public error localization retains stable error codes and the existing exception/privacy filtering; technical SQL, credential and arbitrary exception details are not returned as translated user messages.
- Database/content: no schema migration. Existing bilingual property/business fields are reused. User names, review content, authored CMS values, entity IDs, route IDs, API field names, enums and raw option values are preserved. Default CMS system copy can be localized; custom authored content is not automatically translated.
- Candidate files: `src/locale.ts`, `src/LanguageSwitcher.tsx`, `src/locale.css`, `src/systemTranslations.ts`, `src/cmsCopyEnglish.ts`, `src/generatedAdminEnglish.json`, `src/generatedPortalEnglish.json`, `src/generatedPropertyEnglish.json`, `src/generatedTemplateEnglish.json`, `src/generatedCmsMetadataEnglish.json`, `src/generatedDynamicLabelsEnglish.json`, `src/cms.tsx`, `src/thaiUi.ts`, `src/api.ts`, shared layouts and the static UI consumers recorded in the codemod evidence; `server/public-error.mjs`, `server/locale-messages.mjs`, `server/check-localization.mjs`, `server/app.mjs`.
- Evidence: 2 locale foundation tests and 4 focused check-result projection tests passed. The projection translates only exact known generated comparison results or the recognized QR-state format, preserves unknown/prototype-like/custom authored values, supports flat/list/summary/Admin-style response shapes and leaves Thai/default objects unchanged. Real PostgreSQL HTTP integration also verified an English check POST and history response while the stored result remained in its original Thai form. Translated catalogs were checked for exact inventory coverage and residual Thai in English values; static AST conversion and option-value preservation are recorded in `16-requirements-evidence/locale-codemod.json` and `localized-option-value-preservation.json`. Additional map/helper consumption sites were localized explicitly without translating authored values. Canonical and immutable Staging receipts now verify language persistence, reload and localized journeys; no uncaught JavaScript error was recorded in those cases.
- Staging verification: Canonical Staging: 12/12 role × desktop/mobile × TH/EN cases passed; immutable Staging: 2/2 cases passed, including English persistence on reload and localized API errors.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 03 — Left sidebar design

**PASS — all three Staging role layouts verified on desktop/mobile in TH/EN.**

- Frontend: white sidebar, neutral default text and an active state using existing VillaCheck theme tokens; visible hover/focus states, existing icons/hierarchy and mobile behavior retained across User, Merchant and Admin portals.
- Backend/database: no role, permission, route or schema change for presentation.
- Candidate files: `src/prototype.tsx` PortalShell/navigation; `src/dashboard-documents.css`; shared localized labels.
- Evidence: source and TypeScript checks; desktop/mobile active-state, contrast and menu checks passed in the canonical receipt.
- Staging verification: Canonical 12-case receipt verifies white backgrounds, existing theme-blue active items, contrast ≥4.5:1, mobile menu behavior, role layout and no horizontal overflow.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 04 — Review system

**PASS — local review/privacy tests and actual Staging review presentation verified.**

- Frontend: prominent score/count, rating distribution, filters, sorting, pagination, privacy-safe reviewer cards, dates and loading/error/empty states; responsive presentation using VillaCheck styling.
- Backend: published-review pagination and validated filter/sort bounds; aggregates remain consistent when filtering; private identities and internal fields are not exposed publicly. Existing eligibility, duplicate-review restrictions and moderation are retained. No verified-stay/transaction badge is fabricated.
- Database: existing review metadata and authorization model reused; no schema migration or Production ratings/reviews seeded.
- Candidate files: `src/Reviews.tsx`, `src/reviewTransferTranslations.ts`, `server/reviews.mjs`, `server/review-presentation.mjs`.
- Evidence: `server/review-bank-features.test.mjs`; local PostgreSQL integration. Three synthetic reviews were added only to newly created owned Staging fixtures by distinct existing test users. Live Staging rendering, sorting and filtering checks passed.
- Staging verification: Actual Staging property/review data rendered in immutable and User Browser journeys; sorting/filtering and privacy checks passed. Synthetic reviews are confined to owned Staging fixtures.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 05 — Image status ribbons

**PASS — localized cover ribbons measured on canonical Staging in four viewport/locale combinations.**

- Frontend: stronger localized ribbons with contrast/shadow and consistent responsive positioning; status meaning preserved and controls kept clear.
- Backend/database: underlying status values and approval workflow unchanged.
- Candidate files: `src/StatusCornerRibbon.tsx`, `src/villaStatus.ts`, scoped dashboard/gallery styling.
- Evidence: source/TypeScript checks; the additional canonical ribbon geometry and contrast checks passed in all four tested cover cases.
- Staging verification: Anonymous public GET-only check: 4/4 cases passed at 1440px and 390px, each in TH and EN. Approved cover text was 14px, contrast 5.02:1, shadow present, contained within the cover and overlapping none of Previous/Next, All Photos or the image counter. Public-gallery crops and sanitized measurements are saved in staging-ribbon.json and its four PNGs.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 06 — Document status wording

**PASS — real correction/missing-submission status distinctions and localized Staging document labels verified.**

- Frontend: actual correction-request states display **รอการแก้ไข / Revision Required**. A missing initial submission remains a distinct state and is not relabeled as a correction request.
- Backend/database: no enum, historical status, notification contract or approval transition was renamed.
- Candidate files: `src/villaStatus.ts`, `src/Backoffice.tsx`, `src/OwnershipDocuments.tsx`, document translations.
- Evidence: source mappings and typed status handling; Staging correction labels were verified against actual records; missing-initial state remains distinct.
- Staging verification: Merchant Browser cases verified actual Revision Required / รอการแก้ไข status from fixture document records. Initial missing submission remains separate in the status mapping; no enum was changed.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 07 — Remove latest checklist

**PASS — latest-checklist section removed; retained User history and responsive Staging dashboard verified.**

- Frontend: removed the latest-checklist/recent-check section from the relevant User dashboard and repaired its layout. The history route and functions used elsewhere are retained.
- Backend/database: no inspection/check history or workflow records were deleted.
- Candidate files: `src/OperationsPortal.tsx`.
- Evidence: source dependency review and local checks; Staging dashboard/history journeys and responsive checks passed.
- Staging verification: User dashboard/history journeys passed without restoring the removed latest-checklist section. Historical data and counts remain available through existing history flows.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 08 — Search buyer by name

**BLOCKED — buyer entity/authorization decision is unanswered. The safe property selector is implemented and verified, not misrepresented as buyer search.**

- Audit finding: the actual existing selector selects a **property**, while the buyer/customer associated with a check is the authenticated `user.id`. There is no confirmed contract allowing a User to search/select other buyers.
- Safe work: an accessible, debounced property-name selector supports Thai/English text, keyboard navigation, explicit selection, clearing, loading and empty states, with safe disambiguating property context. It does not auto-select a partial match or expose cross-customer records.
- Candidate files: `src/PropertySearchSelect.tsx`, `src/OperationsPortal.tsx`, related existing check APIs in `server/operations.mjs`.
- Database: no invented Buyer table, cross-customer search API or authorization expansion.
- Required decision: confirm whether “buyer” means the signed-in customer, an authorized Admin-only customer lookup, or the existing accommodation selector. The asynchronous clarification remains unanswered as of final verification. A working property search is **not** reported as completed buyer search.
- Staging verification: The property combobox and authorized property context passed Staging User checks. Cross-customer buyer search remains blocked and was not implemented by inventing permissions.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 09 — Pre-transfer verification UX

**PARTIAL — actual property comparison, replay and history verified; the buyer-selection portion depends on blocked R08.**

- Frontend: clearer title/explanation, selected property context, customer/session context, transfer information, comparison result and next actions; accessible responsive search and localized feedback.
- Backend: existing `MATCHED` / `REVIEW_REQUIRED` comparison, session/RBAC and idempotent request-key behavior preserved. No new banking approval, transfer initiation or payout rules were invented.
- Database: existing check history and ownership reused; no destructive changes or new approval enums.
- Candidate files: `src/OperationsPortal.tsx`, `src/PropertySearchSelect.tsx`, `src/reviewTransferTranslations.ts`, existing `server/operations.mjs` integration.
- Evidence: local API/privacy/lifecycle integration and source checks. PostgreSQL HTTP checks verify localized English POST/history results without changing stored Thai system history or authored/submitted fields. The buyer-search portion remains dependent on the unanswered R08 entity/authorization decision. New owned Staging property fixtures support live checks without editing existing properties; Staging property-comparison acceptance passed; buyer semantics remain the explicit partial gap.
- Staging verification: Staging User UI submitted the exact authorized check, safely replayed its request key and displayed the resulting history. Local PostgreSQL also verified English responses without altering stored Thai history. No transfer or payout was initiated.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 10 — Additional photo/video attachments

**PASS — PostgreSQL quota/replay/security tests, authorized Staging uploads and six gallery Browser cases verified.**

- Frontend: multi-file queue, previews, remaining slots, reading/uploading feedback, per-file failures/retry and accessible responsive controls. Existing reordering and cover handling are retained.
- Backend: cover remains separate from the maximum 10 additional photos; at most 2 videos; real MIME/signature/size validation, ownership, transactional association and existing persistent PostgreSQL document storage. Vercel local disk is not used as permanent media storage.
- Added optional `uploadRequestId`: request fingerprint and stored result permit a safe replay of the same upload without another document; reuse with different content/metadata is rejected. Upload retry does not duplicate/quota-bypass successful work.
- Database: existing `documents` and additive `system_settings` media/request metadata; no schema migration, orphan quota-overflow files or reference rewrites.
- Candidate files: `src/PropertyMedia.tsx`, `src/MediaUploadQueue.tsx`, retained `src/VillaMediaGallery.tsx`, `server/property-media.mjs`, `server/villa-media-limits.mjs`, `server/media-range.mjs`.
- Evidence: `server/sixteen-postgres-integration.test.mjs` passed against disposable PostgreSQL: 10 additional photos + cover accepted, 11th additional rejected; 2 videos accepted, 3rd rejected; persisted publication/authorization; byte ranges; upload replay and conflicting replay behavior. Real Staging queue/retry and gallery playback checks passed.
- Staging verification: Canonical Merchant UI verified multi-file input, quota counts, persistence and controlled retry; the six empty/single/full desktop/mobile gallery cases passed navigation, thumbnails, keyboard/swipe, Lightbox and actual MP4 decode/play/pause. No unexpected gallery console errors or overflow were observed.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 11 — Remove package free-use end date

**PASS — Staging package page hides the free-use end date while entitlement logic is preserved.**

- Frontend: the package route no longer presents the free-use end-date field/date. Operational expiry warnings elsewhere remain distinct.
- Backend/database: trial, subscription, billing, expiry and entitlement calculations are unchanged; no expiry fields removed.
- Candidate files: `src/Backoffice.tsx`, `src/PackageComingSoon.tsx`; package route integration.
- Evidence: source/TypeScript checks; Staging route inspection passed.
- Staging verification: Four Merchant viewport/locale cases verified no free-use end-date presentation on the package page; expiry records and operational warnings elsewhere were retained.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 12 — Package page Coming Soon

**PASS — authenticated Coming Soon package presentation verified on Staging without purchases.**

- Frontend: centered **Coming Soon** presentation with localized supporting text, preserving the authenticated package route and balanced desktop/mobile layout.
- Backend/database: page presentation does not trigger purchases, delete package/subscription data or globally disable billing/entitlements.
- Candidate files: `src/PackageComingSoon.tsx`, `src/Backoffice.tsx`, `src/dashboard-documents.css`.
- Evidence: source and TypeScript checks; Staging route/access/no-purchase Browser verification passed.
- Staging verification: Four Merchant viewport/locale cases verified Coming Soon and supporting text, route/session access and absence of purchase actions.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 13 — Remove Add accommodation buttons

**PASS — specified package/document Add controls absent on Staging; other creation contracts retained.**

- Frontend: removed the specified Add accommodation controls from the package page and Document Management page.
- Backend/database: other authorized creation paths, Villa creation API and existing Merchant entitlements remain. No Villa record was removed.
- Candidate files: `src/Backoffice.tsx`, `src/PackageComingSoon.tsx`, `src/DocumentManagement.tsx`.
- Evidence: route/source review; Staging absence checks passed.
- Staging verification: Four Merchant viewport/locale cases checked that both the package and Document Management views have no Add accommodation button. The creation API and other authorized paths were not removed.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 14 — Document Management terminology

**PASS — localized Document Management navigation and page presentation verified on Staging.**

- Frontend: relevant navigation, page title and breadcrumb consistently use **จัดการเอกสาร / Document Management**. Review-state labels remain distinct.
- Backend/database: route identifiers, tables and API contracts were not renamed for this copy change.
- Candidate files: `src/prototype.tsx`, `src/Backoffice.tsx`, `src/DocumentManagement.tsx`, document translation catalog.
- Evidence: source/TypeScript checks; Staging TH/EN navigation and page presentation checks passed.
- Staging verification: Merchant Browser cases verified Document Management / จัดการเอกสาร titles and associated portal navigation in both languages.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 15 — PDFs and real document statuses

**PASS — actual authorized Staging PDF access/status behavior and unauthorized access denials verified.**

- Frontend: actual authorized PDF records, names, available type/upload metadata, real review status, view/download controls and loading/error/empty states. Unknown legacy upload dates remain explicitly unavailable rather than invented.
- Backend: owner/Admin authorization, controlled inline viewing and attachment behavior, private caching and response hardening preserved. Unauthorized users cannot read another account's private PDF.
- Database: existing ownership/document records and review workflow reused; no Production demo document or schema migration.
- Candidate files: `src/DocumentManagement.tsx`, `src/OwnershipDocuments.tsx`, `src/Backoffice.tsx`, `server/app.mjs`, retained `next.config.mjs` protection.
- Evidence: `server/document-preview-security.test.mjs` covers owner/Admin access, cross-role/foreign-owner denial, attachment default/private caching and frame protections. New Staging-only PDF fixtures support existing/new authorized document checks; Staging authorized PDF content/view-link and status checks passed.
- Staging verification: Merchant Browser checked actual private PDF URLs returning PDF content with inline disposition, date/status presentation and correction labels. User and anonymous access to the private PDF was denied. These are real access/content checks, not a claim of a physical-device PDF reader test.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### 16 — Receiving bank account details

**PASS — own-account Staging bank save/masking/reload/revision behavior verified; Production write policy remains held.**

- Frontend: Merchant profile receiving-account section with bank/account-holder/account-number fields, validation, masked display, edit/save and localized feedback.
- Backend: current session selects the owner; foreign owner/user identifiers are rejected; only Merchant own-account access is allowed; revision checks prevent overwrites and sensitive updates append audit events. Raw account numbers are not returned in the public DTO or logs. Platform receiving-bank and Villa bank details remain independent and unchanged.
- Database: additive owner-scoped metadata in existing `system_settings`; no schema migration, payout, transfer or external banking integration.
- Candidate files: `src/MerchantReceivingBank.tsx`, `src/MerchantProfile.tsx`, `server/merchant-receiving-bank.mjs`, `server/app.mjs`, route policies.
- Evidence: `server/review-bank-features.test.mjs` and disposable PostgreSQL API integration passed self-only ownership, masking, revision conflict and audit behavior with synthetic non-real account values. No global write policy was enabled; only the exact Staging test Merchant was allocated two fixtures and scoped business writes.
- Production boundary: `MEMBER_PREVIEW` still denies business POSTs. This task does not silently enable Production bank writes or other business operations. Live editing acceptance cannot be marked PASS while that policy remains held.
- Staging verification: Four Merchant viewport/locale cases verified own synthetic bank save, masked DTO, reload and revision behavior. Unsaved draft input survived both language switches. User/Admin role denials were verified. No real bank numbers, external banking actions or Production writes were used.
- Production verification: **new candidate NOT DEPLOYED; release gates held**.

### API contracts used

| API | Purpose / authorization |
| --- | --- |
| `GET /api/config` | Actual channel and environment availability; OTP activation remains off. |
| Existing `/api/auth/login`, `/api/auth/admin-login`, session and logout endpoints | Supported password flow and existing sessions/RBAC; no global password-policy change. |
| `POST /api/auth/otp/request`, `/api/auth/otp/verify` | Existing-account OTP capability; actual channel activation/delivery remains blocked. |
| `GET /api/public/property-media?qr=…` | Cover and additional published/reviewed media for an approved active property. |
| `GET/POST /api/merchant/property-media`, existing Admin counterpart | Authorized media listing/upload/reorder/removal; optional stable upload request ID. |
| `GET /api/public/reviews` | Validated QR/rating/sort/page/page-size inputs, aggregate and privacy-safe review list. |
| `GET /api/merchant/ownership-documents?villaId=…`, existing Admin counterpart | Real document metadata, statuses and review history. |
| `GET /api/documents/:id?preview=1`, existing Admin counterpart | Private authorized PDF viewing; default download disposition remains unchanged. |
| `GET /api/public/villas`; `GET/POST /api/user/checks`; existing Admin check reads | Authorized property selection, own comparison/history and idempotent submission. Buyer search is not claimed. |
| `GET/POST /api/merchant/receiving-bank` | Merchant's own masked receiving-account DTO and revision-controlled save. |

Existing storage constraints remain **JPEG/PNG images and MP4 video, at most 2 MB per file**, with a separate cover, up to 10 additional photos and 2 videos. This release does not expand storage formats or file-size policy. Loading percentages describe file reading; network upload is indeterminate and completion progress counts successful files.

## B. Deployment summary

| Item | Actual value / status |
| --- | --- |
| Local Git HEAD at audit | `c1b73bd7e1310d94ffa746b2f5f4d66219566ae7` |
| Original local branch preserved | `fix/autonomous-business-security-20261024` |
| Repository | `https://github.com/devwaygocargo-oss/VillaCheckTH.git` |
| Audited remote main HEAD | `6ce3dce4eeaaec96f108bbd5fb4ee3ddb082100f` |
| Frozen release source commit | `57885ae245c5652633035c85dd71846440119cb7` |
| Release branch | `release/villacheck-16-20261029-57885ae2` |
| Release push | **PUSHED** |
| Staging source commit | `57885ae245c5652633035c85dd71846440119cb7` — uploaded source verified |
| Staging deployment ID | `dpl_DgWB9tCJwuzRBLNyuTXq5PWWL6QE` |
| Staging immutable URL | https://design-villacheck-cvh58ajwk-villa-check.vercel.app |
| Staging canonical URL | https://design-villacheck.vercel.app/ |
| Staging deployment status | **READY; canonical implemented-scope QA PASS** |
| Staging source digest | `7661b595997724e01ef1213a8a8eb406b1883c648a3945f883179f13225ea3cb` |
| New Production release | **HELD / NOT DEPLOYED**; release gates unresolved |
| Production canonical URL | https://www.villacheckth.com/ |
| Existing Production deployment retained | `dpl_DCuj1oySbaWhBdt5XkbAwojnby23` |
| Existing Production source commit retained | `39325cc8f028f58ef9787c1b9f5f0122570f1850` |
| Existing Production source digest | `8ebddc691f7930551ec0702cfe37461ec7a01fbe835462e607ed805d7491be12` |
| Existing Production status | Read-only preservation and four unauthenticated desktop/mobile route checks PASS; no new-release acceptance claimed |

Audited Staging baseline: `dpl_DxiVvDHRkTBwK11zzWrriqbU1FQ5`, digest `b90bc944bb2db3eb890e969963efb2a5ca5f4640ebfff8487f16bd7cc8800022`. That scope-only baseline was verified through its source manifest and was not previously committed as a complete release. It has now been superseded on Staging by the frozen source above. The previous Production ID is retained intentionally; it is not a deployment of the 16-requirement candidate.

The release branch may include a documentation-only follow-up; deployed application bytes remain pinned to the source commit above.

Deployment evidence: `16-requirements-evidence/staging-deployment.json`, `staging-immutable-browser.json`, `staging-browser.json`, `production-final-readonly.json` and the frozen source/push receipts maintained with the release. Configuration-preservation checks did not change existing credentials or provider ownership.

## C. Database safety, backup and rollback

- **Separate PostgreSQL targets verified:** Staging is `neondb` in Neon project `twilight-leaf-26518545`, endpoint `ep-lively-wildflower-azuxgq19`; Production is `villacheck_production` in `green-sun-56847773`, endpoint `ep-square-resonance-aohwf0z5`. Target identity/TLS and existing signed mapping checks were retained. Connection credentials are not included in this report.
- The audit found compatible 188-column public schemas. No Prisma schema, dependency/package or migration change was required. No reset, truncate, destructive migration or Production overwrite occurred.
- **Staging original-data preservation PASS:** all original 68 Villas and all original 249 documents remain byte-for-byte unchanged. All original 60 users remain; hashes of the 57 non-test-user rows are unchanged. Only the 3 previously authorized requested test actors are excluded from that user-row comparison because their own login timestamps/session activity are expected to change. Their IDs/emails/roles remain preserved.
- Final Staging counts are **60 users, 70 Villas and 278 documents**. This task added exactly 2 owned fixture Villas and 29 associated test documents. The document evidence accounts for the original 5 fixture documents plus subsequent media tests; 12 removed media records are retained as historical references. **Zero orphaned new documents** were found. The original 27 leads, 39 subscriptions, 6 invoices and 6 mails are unchanged, with no new users/leads/subscriptions/invoices/mails.
- Three synthetic reviews were created only on newly owned Staging fixtures by distinct existing authorized test users. Own synthetic receiving-bank metadata and the explicitly scoped comparison check/replay were tested only on the authorized Staging actors/fixtures. No existing real customer Villa/document/bank data was edited for QA.
- **Production preservation PASS:** read-only final verification retained its existing 4 users, 0 Villas and 0 documents, with the compared users/Villas/documents/leads/subscriptions/invoices/mails snapshots unchanged. No Production login, business write, deployment or provider mutation was performed by that final audit. No demo Villa, Listing, document, review or sample bank data was introduced.
- The three previously requested Gmail Production test identities remain **absent, unapproved and uncreated**. This task is not their separate approval; see Appendix F.
- **Actual encrypted Production backup and local restore PASS:** `16-requirements-evidence/continuation-backup-restore.json` records read-only export using the existing backup role, encrypted archive/metadata, restrictive permissions, no plaintext dump files and verified key readback. Disposable local restoration matched all 20 tables/history, columns/constraints/indexes and ownership/ACL/default privileges. Global role passwords were not exported and local restored roles were NOLOGIN. **No Production restore occurred.**
- Backup files are retained. No backup deletion, rotation or automatic retention action is inferred.
- Rollback readiness: baseline deployment references and verified source manifests are retained. No schema downgrade is needed for code rollback. Added metadata is backward-compatible; do not delete it blindly or remove historical media associations. Recheck canonical aliases and any intervening user activity before a rollback/cleanup. Production was held rather than promoted through failed gates.
- Google Cloud ownership, OAuth client IDs, existing credentials, LINE and Facebook integrations were not changed. No Staging business data was copied into Production.

Evidence: `staging-original-data-preservation.json`, `staging-fixtures.json`, `production-final-readonly.json` and `continuation-backup-restore.json` under `16-requirements-evidence/`.

## D. Final QA matrix

| Req | Local and canonical Staging result | New Production candidate |
| --- | --- | --- |
| 01 | **PARTIAL** — method selection and secure existing-account code verified; actual delivery/activation/timing gate unresolved | HELD / NOT DEPLOYED |
| 02 | **PASS** — catalog/fallback/API checks, persisted TH/EN and role journeys | HELD / NOT DEPLOYED |
| 03 | **PASS** — white/theme-blue sidebar, contrast, focus/menu and responsive role layouts | HELD / NOT DEPLOYED |
| 04 | **PASS** — review score/count/distribution, filter/sort/pagination/privacy and real fixture presentation | HELD / NOT DEPLOYED |
| 05 | **PASS** — 4 measured localized cover-ribbon cases, 14px/5.02:1/shadow/containment/no control overlap | HELD / NOT DEPLOYED |
| 06 | **PASS** — Revision Required labels; missing-initial submission remains distinct | HELD / NOT DEPLOYED |
| 07 | **PASS** — latest-checklist removal, retained history and responsive dashboard | HELD / NOT DEPLOYED |
| 08 | **BLOCKED** — buyer definition unanswered; property combobox separately verified | HELD / NOT DEPLOYED |
| 09 | **PARTIAL** — actual comparison UI, scoped submit/replay/history PASS; buyer portion depends on R08 | HELD / NOT DEPLOYED |
| 10 | **PASS** — actual Staging upload/retry/persistence and 6 gallery cases; PostgreSQL count/MIME/access/replay checks | HELD / NOT DEPLOYED |
| 11 | **PASS** — package free-use end-date presentation removed without entitlement edits | HELD / NOT DEPLOYED |
| 12 | **PASS** — authenticated Coming Soon presentation and no purchases | HELD / NOT DEPLOYED |
| 13 | **PASS** — specified package/document Add controls removed, other contracts retained | HELD / NOT DEPLOYED |
| 14 | **PASS** — Document Management terminology in TH/EN portal/page presentation | HELD / NOT DEPLOYED |
| 15 | **PASS** — actual PDF content/status links, owner access and foreign-role/guest denial | HELD / NOT DEPLOYED |
| 16 | **PASS** — own synthetic bank save, masking, reload, revision and unsaved-locale preservation | HELD / NOT DEPLOYED |

Verified evidence and limits:

- Final production build, TypeScript and lint passed. Local logs: `/tmp/vc16-final-build.log`, `/tmp/vc16-final-typecheck.log`, `/tmp/vc16-final-lint.log`; post-projection revision logs: `/tmp/vc16-final-revision-build.log`, `/tmp/vc16-final-revision-typecheck.log`.
- OTP/service/error regressions: **23 passed**; real localhost existing-account OTP HTTP cases: **4 passed**; locale foundation: **2 passed**; exact generated check-result projection: **4 passed**. Projection tests retain unknown/prototype-like/custom results and all non-result fields in flat/list/summary/Admin-style shapes. PostgreSQL also checked English POST/history responses while the stored result remained Thai.
- Disposable local PostgreSQL integration passed with no Production connection and no live provider request: `postgres-tests.json`. Tests cover media quota, publication/privacy, real storage/range response, transactional replay/conflict handling, self-bank masking/revision/audit and existing lifecycle boundaries.
- Immutable Staging Browser: **2/2 passed**, Desktop 1440px and Mobile 390px. Actual property/reviews and decoded cover rendered; English persisted on reload; localized API errors, no uncaught JavaScript errors and no overflow were verified.
- Canonical Staging Browser: **12/12 passed**, 3 authorized roles × 2 viewports × TH/EN. Actual email/password login, role layout/RBAC, shared language persistence, CMS read-only controls, relevant document/package/media/bank/User flows, reload and server-session logout passed. Protected existing data preservation passed.
- Gallery regression: **6/6 passed**, empty/single/full image and video data on Desktop/Mobile. Previous/Next, thumbnail selection, keyboard/swipe, Lightbox/focus restoration and actual MP4 decode/play/pause passed. Reported unexpected console errors and overflow were zero. Expected anonymous `/api/auth/me` 401 responses were classified explicitly; no claim is made that the application never logs an expected denial.
- Ribbon supplement: **4/4 passed anonymously**, all public GET/HEAD only and no credential/session header read. The local current-deployment receipt was unchanged; canonical deployment correlation is supplied by the primary QA. Only cropped public Staging-fixture gallery screenshots were saved. A previously proposed credential-bearing probe was rejected before execution; the successful genuinely anonymous alternative made it unnecessary.
- Existing Production read-only smoke: **4/4 passed**, homepage and `/admin/login` at 1440px and 390px, HTTP 200, no visible broken images and no layout overflow. These checks inspected the retained `39325cc8` release, not the new candidate. No Production identity login, RBAC/session/logout or new feature acceptance is claimed by that audit.
- **Runtime/server log review PASS with a known warning:** the complete reviewed query contained 22 provider error-level stderr records, all exact matches for the installed `pg-connection-string` 2.14.1 `NODE_PG_SSLMODE_COMPATIBILITY_WARNING` template; fatal records and unclassified/exception records were zero. The receipt is `staging-runtime-error-logs.json`, status `KNOWN_PG_TLS_COMPATIBILITY_WARNINGS_ONLY`. These warnings concern future pg 9 SSL-mode semantics; the current pg 8 behavior verifies the full TLS connection. They do not establish a current TLS failure. No environment setting was changed. This classification is separate from the passing Browser console assertions.
- Google configuration and route boundaries were preserved. Actual Google OAuth callback completion is **not claimed**; authorise-URL/config inspection and local identity security tests are not equivalent to a real callback. Email/SMS test adapters likewise do not prove external delivery.
- Mobile checks use Chromium touch emulation, not a physical iPhone/Safari device. Authenticated QA does not save passwords, request bodies, cookie/token values, traces or storage state. The four optional ribbon images contain only the public fixture gallery crop.

Primary receipts: `staging-browser.json`, `staging-immutable-browser.json`, `staging-ribbon.json`, `staging-original-data-preservation.json`, `production-final-readonly.json`; gallery receipt: `../../reports/property-gallery/staging-sixteen-browser.json` from this report's directory. Source translation inventories/codemod and raw option-value preservation are retained in the evidence directory.

## E. Remaining issues and release gates

1. **R01 actual OTP delivery/activation:** both audited environments advertise Email OTP and SMS OTP unavailable; existing provider staging protections remain active. Obtain current authorised destinations/consent and verify delivery using the existing provider configuration without changing ownership or reusing prior per-send approval. The eligible-provider-I/O versus unknown-fast-response timing distinction needs security review/mitigation before activating the public login capability. Do not label real delivery or timing resistance PASS from local adapters or uniform JSON response shape.
2. **R08 buyer definition:** the current contract binds the buyer to the authenticated User and selects a property. Clarification is unanswered. Decide whether the request means the signed-in customer, an authorised Admin-only customer lookup or the property selector. No cross-customer search, Buyer model or authorisation was invented.
3. **R09 dependent portion:** actual property comparison, safe request replay and history pass, but the requested buyer-selection portion cannot be completed until R08 is resolved. No automated transfer or payment approval was added.
4. **Existing Production MEMBER_PREVIEW policy:** business writes remain held. This release does not silently enable purchases, property/media edits or receiving-bank POSTs in Production. A confirmed business/security release decision and successful gates are required before changing that boundary.
5. **New Production release held:** Staging is Ready and its implemented-scope QA passed. The unresolved requirements/policy gates prevent promoting the new candidate to Production under the user's instructions. The previous Production release was retained and verified non-destructively; its success is not a claim of new-release deployment.
6. **Low-priority PostgreSQL TLS maintenance:** the 22 reviewed records were exact known compatibility warnings, with no fatal or unknown exception. Before a future pg 9 upgrade, explicitly review/configure `verify-full` semantics using the existing connection policy. The current pg 8 behavior verifies the full TLS connection; no credential or environment change was made for this task.
7. **Production test identities:** the three Gmail identities requested earlier still require their separate explicit approval and remain absent. This implementation task is not that approval. No demo listing/document workaround or real-customer record edit was used to manufacture Production QA.

The source work and verified Staging deployment are concrete deliverables. The report intentionally records the genuine incomplete requirements and holds the unsafe Production step rather than fabricating all-16/dual-environment completion.

## Appendix F. Requested test-account verification

| Environment | Email | Role | Account Status | Login Status | RBAC Status |
| --- | --- | --- | --- | --- | --- |
| Staging | testuser@gmail.com | USER | Provisioned earlier; active | PASS TH/EN, Desktop/Mobile | PASS; session/reload/logout PASS |
| Staging | testmerchant@gmail.com | MERCHANT | Provisioned earlier; active | PASS TH/EN, Desktop/Mobile | PASS; session/reload/logout PASS |
| Staging | testadmin@gmail.com | ADMIN | Provisioned earlier; active, application Admin only | PASS TH/EN, Desktop/Mobile | PASS; session/reload/logout PASS |
| Production | testuser@gmail.com | USER | Absent; separate approval outstanding | NOT RUN | NOT RUN |
| Production | testmerchant@gmail.com | MERCHANT | Absent; separate approval outstanding | NOT RUN | NOT RUN |
| Production | testadmin@gmail.com | ADMIN | Absent; separate approval outstanding | NOT RUN | NOT RUN |

Provisioning method and earlier account evidence: [requested account report](../../reports/requested-test-accounts-v2/FINAL-REPORT.md). It used the existing salted-scrypt `hashPassword` service in an exact-scope, transactional, idempotent operator script. No plaintext password, hash or token is included in either account evidence or this report; no real emails were sent by provisioning. The initial rerun created zero duplicates.

Scope update during the 16-requirement task: the Staging Merchant is now allocated **only the two new owned QA fixture IDs**, with a business-write allocation for that exact test actor where required by the scoped test policy. This is a documented evolution from the older account report's no-property/no-business-allocation baseline; it is not an expansion for existing real Merchants. Self-bank operations remain session-owned and separate from platform/Villa bank details. Existing real users, original Villas and original documents were preserved as shown in section C.

The Admin receives application privileges only; no infrastructure, billing, Vercel/Neon membership or Google Cloud ownership was granted. All three identities have explicit internal labels/markers and known IDs. Removal must recheck dependencies and remove the Staging actor-scope entries before deleting allocated user rows, because runtime verification expects those actors to exist. No account deletion was performed.

No password, password hash, OTP, token, connection URI, full bank account number or provider secret is intentionally included in this report.
