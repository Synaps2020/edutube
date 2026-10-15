ALTER TABLE accounts ADD COLUMN biography text NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN email_verified_at timestamptz;
ALTER TABLE accounts ADD COLUMN profile_version integer NOT NULL DEFAULT 1 CHECK (profile_version > 0);
CREATE TABLE account_tokens (
 token_hash varchar(64) PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 purpose varchar(10) NOT NULL CHECK (purpose IN ('VERIFY','RESET')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_tokens_account_idx ON account_tokens(account_id,purpose);
CREATE TABLE mail_outbox (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 recipient varchar(254) NOT NULL,
 subject text NOT NULL,
 content text NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_outbox_pending_idx ON mail_outbox(available_at) WHERE sent_at IS NULL;
