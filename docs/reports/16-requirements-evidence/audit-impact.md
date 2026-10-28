Audit completed before implementation on 29 October 2026 (Asia/Bangkok).

Repository: React 19 / Next.js 16.4 / NestJS / PostgreSQL (the Vite description in AGENTS.md is historical). Local HEAD c1b73bd7e1310d94ffa746b2f5f4d66219566ae7, branch fix/autonomous-business-security-20261024. Workspace contains extensive unrelated changes and will not be deployed as a whole. Canonical origin https://github.com/devwaygocargo-oss/VillaCheckTH.git; remote main read-only HEAD 6ce3dce4eeaaec96f108bbd5fb4ee3ddb082100f.

Current Staging: dpl_DxiVvDHRkTBwK11zzWrriqbU1FQ5, source digest b90bc944bb2db3eb890e969963efb2a5ca5f4640ebfff8487f16bd7cc8800022 (verified uploaded source manifest; its scope-only change was not previously committed). Current Production: dpl_DCuj1oySbaWhBdt5XkbAwojnby23, release source commit 39325cc8f028f58ef9787c1b9f5f0122570f1850, digest 8ebddc691f7930551ec0702cfe37461ec7a01fbe835462e607ed805d7491be12. Production excludes 100 existing Staging demo image assets. No current deployment contains the unrelated workspace draft changes.

Staging neondb / twilight-leaf-26518545 / ep-lively-wildflower-azuxgq19 and Production villacheck_production / green-sun-56847773 / ep-square-resonance-aohwf0z5 are separate PostgreSQL targets. Read-only audit found identical 188-column public schemas. Staging counts users60/villas68/documents249; Production users4/villas0/documents0. Environment values were not output; both advertise OTP email=false/sms=false. Staging STAGING_INTERACTIVE allows exact test identities; Production MEMBER_PREVIEW blocks business mutations. Google is existing-accounts-only; LINE and Facebook configuration/ownership must remain unchanged.

| Req | Source status | Impact and reusable code | Verification needed |
| --- | --- | --- | --- |
| 01 | PARTIAL / live delivery BLOCKED | OtpLogin.tsx, prototype.tsx, login-otp.mjs, runtime route policies; existing secure OTP core; no implicit provider activation | Existing-account role/expiry/replay/resend/attempt tests; actual authorized destinations pending |
| 02 | PARTIAL | cms.tsx/useCopy, thaiUi.ts, api.ts, public-error.mjs, shared layout and localized catalogs; no schema needed | Persisted language, TH/EN major flows, API stable-code privacy, label coverage |
| 03 | PARTIAL | PortalShell in prototype.tsx + scoped design-system CSS | White/sidebar-blue contrast/focus/mobile all roles |
| 04 | PARTIAL | Reviews.tsx, reviews.mjs; preserve one-review/User/approved ACTIVE Villa and moderation | Summary/distribution/filter/sort/pagination/private-name tests; no verified-stay badge without evidence |
| 05 | PARTIAL | StatusCornerRibbon.tsx, villaStatus.ts, gallery CSS | Ribbon prominence, responsive spacing, labels both languages |
| 06 | PARTIAL | villaStatus.ts, Backoffice.tsx, OwnershipDocuments.tsx | changes label vs missing-initial-submission stay distinct |
| 07 | MISSING | OperationsPortal.tsx .user-recent-checks | Remove visible section only, retain history records/route/counts |
| 08 | BLOCKED pending entity confirmation | Existing selector is Villa; buyer is authenticated user.id, no authorized other-buyer data contract | User clarification requested; no cross-customer access invented |
| 09 | PARTIAL | OperationsPortal.tsx, operations.mjs | Preserve MATCHED/REVIEW_REQUIRED comparison and idempotent requestKey; no payment approvals invented |
| 10 | PARTIAL UI, backend limits present | PropertyMedia.tsx queue; property-media.mjs/villa-media-limits.mjs | Multiple files/progress/retry, 10/11 extra images, 2/3 videos, ownership and persistence |
| 11 | MISSING | Backoffice/VillaPackagePanel package-page date banners | Package page only; entitlement expiry stays unchanged |
| 12 | MISSING | Dedicated authenticated owner-package Coming Soon presentation | No purchases, route preserved, entitlements unaffected |
| 13 | MISSING | Package and owner-pending document page branches | No Add controls there; retain owner-add-villa and creation API |
| 14 | MISSING | owner-pending nav/title/breadcrumb | Document Management terminology without route/table rename |
| 15 | PARTIAL | New DocumentManagement using actual /state + OwnershipDocuments; authorized PDF inline disposition in app.mjs | Actual PDF metadata/unknown legacy dates; owner/admin view, cross-role denial; retain frame protection |
| 16 | MISSING | MerchantProfile + new owner-scoped merchant bank metadata/service | Self-only, masked account, revision and audit, no platform/Villa bank changes, synthetic local/Staging values only |

Attached images are layout references only; no cargo branding, personal identifiers, booking IDs, or proprietary image assets will be copied. No existing Production test-identity approval is inferred from this task. Previously requested Gmail Production accounts remain unprovisioned.
