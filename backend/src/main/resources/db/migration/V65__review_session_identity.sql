-- Preserve existing daily reviews and allow independent European and US preparation.
ALTER TABLE session_review_revisions ADD COLUMN session_key VARCHAR(16) NOT NULL DEFAULT 'DAY';
DO $$ DECLARE constraint_name text; BEGIN
 SELECT conname INTO constraint_name FROM pg_constraint
 WHERE conrelid = 'session_review_revisions'::regclass AND contype = 'u';
 IF constraint_name IS NOT NULL THEN
 EXECUTE format('ALTER TABLE session_review_revisions DROP CONSTRAINT %I', constraint_name);
 END IF;
END $$;
ALTER TABLE session_review_revisions ADD CONSTRAINT session_review_identity UNIQUE(user_id, account_id, session_date, session_key, revision);
CREATE INDEX session_review_session_latest ON session_review_revisions(user_id, account_id, session_date, session_key, revision DESC);
CREATE TABLE preparation_journals (
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 account_id UUID NOT NULL, session_date DATE NOT NULL, session_key VARCHAR(16) NOT NULL,
 note_id UUID NOT NULL REFERENCES notebook_note(id),
 PRIMARY KEY(user_id, account_id, session_date, session_key),
 FOREIGN KEY(account_id,user_id) REFERENCES accounts(id,user_id) ON DELETE CASCADE
);
CREATE TABLE preparation_trade_links (
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_id UUID NOT NULL, request_payload JSONB NOT NULL,
 trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
 review_id UUID REFERENCES session_review_revisions(id),
 PRIMARY KEY(user_id, request_id), UNIQUE(trade_id)
);
CREATE TABLE preparation_briefings (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 reference_date DATE NOT NULL, session_key VARCHAR(16) NOT NULL,
 payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX preparation_briefing_latest ON preparation_briefings(user_id,reference_date,session_key,created_at DESC);
