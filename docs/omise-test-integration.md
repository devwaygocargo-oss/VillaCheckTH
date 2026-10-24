# Omise test integration and acceptance boundary

Default is disabled. Use private `OMISE_TEST_ENABLED=true` and `OMISE_TEST_SECRET_KEY` only in an isolated test environment. Only `skey_test_…`, `src_test_…`, test charge/event/transaction IDs and `livemode:false` responses are accepted. No live environment key is read or accepted by this adapter. Never enable customer checkout until source collection/UI and provider acceptance are complete.

## API

- `POST /api/payments/:invoiceId/omise` with a test `source`, authenticated Merchant ownership and CSRF. Backend reads the saved invoice amount/currency; frontend success/amount fields have no authority.
- `GET /api/payments/:invoiceId/omise` restores status after refresh and rechecks the saved provider charge. Owner/Admin authorization is enforced by the HTTP layer.
- `POST /api/webhooks/omise` is unauthenticated at the session layer and rate limited. Only its event ID is used to retrieve the provider event and then the charge through authenticated server requests. Amount, currency, test mode, invoice binding, charge ID and captured transaction are revalidated.
- Success records receipt/payment state and queues Villa approval; it never grants public verification without a later Admin approval.

Creation reserves an invoice before external I/O, uses a stable `ref_id`, and persists the charge ID. A timeout/crash without a charge ID remains UNKNOWN/CREATING and blocks automatic duplicate creation until reconciliation. Duplicate events/transactions and late pending events do not extend rights twice. Failed/expired payments remain visible; retry/reconciliation and source-collection UI still need provider acceptance. Legacy account-wide invoices must be reconciled before gateway conversion. Legacy manual invoices retain their review history/workflow; enabled newly created invoices accept Omise only.

Zero-net Basic signup uses promotion grants and does not create a gateway charge or payment invoice. Any zero-amount call at the integration boundary returns NO_PAYMENT_REQUIRED without calling the provider.

## Documentation verified

Reviewed on 24 October 2026:

- [Authentication](https://docs.omise.co/api-authentication): server Basic authentication and separate test/live keys.
- [Charges API](https://docs.omise.co/charges-api): minor-unit amount/currency, source, metadata, `ref_id` and charge statuses.
- [Webhooks](https://docs.opn.ooo/api-webhooks): independent charge retrieval to authenticate webhook outcomes.

No undocumented signature header is assumed. Real Omise account/API acceptance was **not** performed; tests inject a mock provider. The production/live gateway remains disabled. No actual credentials are recorded in this document.

Provider reversals preserve the original paid receipt and dates, record FAILED/reversed state and an Owner notification, and queue reconciliation. A reversal blocks subsequent Villa approval until reconciliation; refund/credit handling is deliberately not invented. New Omise invoice DTOs/UI expose gateway status and suppress manual bank/slip controls.

## Phase 3 checkout preparation

`OmiseCheckout` now obtains owner-scoped configuration from `GET /api/payments/:invoiceId/checkout`, creates a test source through Omise.js and sends only that source to the existing POST endpoint. Server retrieval validates source test mode, method, amount and currency. Source methods are opt-in (`promptpay`, `mobile_banking_scb`) for Test acceptance, not a production payment-method decision. Empty methods/public-key configuration disables creation UI. Zero-net does not create a source/charge.

Return URI is server-built from APP_URL and invoice; provider authorize/QR URLs are restricted to test paths on `https://api.omise.co`. Pending actions/expiry persist and refresh/re-entry retrieves status. The return URL's success claim has no payment authority. Source rejection/ambiguous creation remains blocked from automatic duplicate charge creation pending operator reconciliation.

`PAYMENT_ACCESS_MODE=DISABLED` blocks new payment actions; `OMISE_TEST` blocks manual proof/confirmation and legacy invoice conversion while retaining history. Test webhooks/status can reconcile earlier test attempts. See [staging deployment](staging-deployment-guide.md) and [external acceptance](staging-external-acceptance.md). UI browser evidence uses mocked SDK/checkout/status/redirect, paired with separate real-HTTP/database backend regression. No actual Omise account acceptance has been performed.
