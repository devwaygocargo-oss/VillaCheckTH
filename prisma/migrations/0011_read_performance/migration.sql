CREATE INDEX IF NOT EXISTS villas_owner_created ON villas(owner_id,created);
CREATE INDEX IF NOT EXISTS villas_status_created ON villas(status,created);
CREATE INDEX IF NOT EXISTS invoices_villa_created ON invoices(villa_id,created);
CREATE INDEX IF NOT EXISTS mails_villa_created ON mails(villa_id,created);
CREATE INDEX IF NOT EXISTS payment_qrs_payment_status_created ON payment_qrs(payment_id,status,created);
