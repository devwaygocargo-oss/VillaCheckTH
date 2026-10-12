ALTER TABLE villas ADD COLUMN IF NOT EXISTS guest_capacity INTEGER CHECK (guest_capacity BETWEEN 1 AND 1000);
UPDATE system_settings SET value='MANUAL' WHERE key='payment_verification_mode';
