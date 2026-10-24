# Pending business decisions

- BL-01: promotion end date, subscription duration and renewal rules. Preserve existing free grants; never retroactively charge.
- BL-02: partial-day convention, rounding, residual credit/refund handling and new billing-cycle start. Exact rational value calculation may be used for review; do not settle a package change automatically.
- BL-05: treatment of historical QR URLs and public visibility while edits await approval. Conservative default: retain approved snapshot privately, suspend public pending details, rotate after approval; no destructive deletion.
- BL-06: confirmed guarantee scope, exclusions and legally approved wording per package. Do not advertise a guarantee until confirmed.
- BL-07: identify Owner account/notification destination. Persist notifications for later delivery; do not invent an email recipient.
- BL-03: Omise test credentials and approved enabled payment methods required before provider end-to-end testing. Live payments remain disabled.
- Operations: operator must repair SMTP credentials, review existing inactive-package invoices, production demo cleanup and credential rotation; no production mutation authorized in this session.

Implementation limits needing a later acceptance pass:

- Basic promotion disabled: new free grants are rejected, existing grants preserved. Paid Basic onboarding remains blocked until duration/renewal terms are confirmed; no automatic charge is attempted.
- Owner notifications are a durable private outbox, not confirmed external delivery. Owner identity/channel and delivery acceptance remain required.
