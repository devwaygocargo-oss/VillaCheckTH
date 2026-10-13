ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_months_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_months_check CHECK (months BETWEEN 1 AND 36);
