ALTER TABLE login_otps ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'user' CHECK (account_type IN ('user','merchant'));
ALTER TABLE login_otps ADD COLUMN IF NOT EXISTS binding_user_id TEXT REFERENCES users(id);
ALTER TABLE login_otps ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'login' CHECK(purpose IN ('login','register','link_identity'));
