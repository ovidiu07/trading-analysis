ALTER TABLE session_setups
    ADD COLUMN IF NOT EXISTS account_id UUID,
    ADD COLUMN IF NOT EXISTS source_draft_id VARCHAR(120);

ALTER TABLE session_setups
    DROP CONSTRAINT IF EXISTS fk_session_setups_account_owner;

ALTER TABLE session_setups
    ADD CONSTRAINT fk_session_setups_account_owner
        FOREIGN KEY (account_id, user_id)
        REFERENCES accounts (id, user_id)
        ON DELETE RESTRICT
        NOT VALID;

ALTER TABLE session_setups
    VALIDATE CONSTRAINT fk_session_setups_account_owner;

CREATE INDEX IF NOT EXISTS idx_session_setups_user_account
    ON session_setups (user_id, account_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_session_setups_user_source_draft
    ON session_setups (user_id, source_draft_id)
    WHERE source_draft_id IS NOT NULL;
