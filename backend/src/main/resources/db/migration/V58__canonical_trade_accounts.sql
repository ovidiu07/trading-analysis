ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS account_type VARCHAR(40),
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE accounts
    DROP CONSTRAINT IF EXISTS chk_accounts_status;

ALTER TABLE accounts
    ADD CONSTRAINT chk_accounts_status
        CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DISABLED'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_user_default
    ON accounts (user_id)
    WHERE is_default = TRUE AND status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_accounts_user_status_name
    ON accounts (user_id, status, name);

CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_id_user
    ON accounts (id, user_id);

CREATE TABLE IF NOT EXISTS trade_account_remediation_audit (
    trade_id UUID PRIMARY KEY REFERENCES trades(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    legacy_account_id VARCHAR(128),
    classification VARCHAR(40) NOT NULL,
    matched_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    remediated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO trade_account_remediation_audit (
    trade_id,
    user_id,
    legacy_account_id,
    classification,
    matched_account_id
)
SELECT
    t.id,
    t.user_id,
    t.broker_account_id,
    'OWNERSHIP_MISMATCH',
    t.account_id
FROM trades t
JOIN accounts a ON a.id = t.account_id
WHERE a.user_id <> t.user_id
ON CONFLICT (trade_id) DO NOTHING;

UPDATE trades t
SET account_id = NULL
FROM accounts a
WHERE a.id = t.account_id
  AND a.user_id <> t.user_id;

ALTER TABLE trades
    DROP CONSTRAINT IF EXISTS fk_trades_account_owner;

ALTER TABLE trades
    ADD CONSTRAINT fk_trades_account_owner
        FOREIGN KEY (account_id, user_id)
        REFERENCES accounts (id, user_id)
        ON DELETE RESTRICT
        NOT VALID;

ALTER TABLE trades
    VALIDATE CONSTRAINT fk_trades_account_owner;

WITH deterministic_matches AS (
    SELECT
        t.id AS trade_id,
        MIN(a.id::text)::uuid AS account_id,
        COUNT(*) AS match_count
    FROM trades t
    JOIN accounts a
      ON a.user_id = t.user_id
     AND LOWER(TRIM(a.external_account_id)) = LOWER(TRIM(t.broker_account_id))
     AND (
          COALESCE(TRIM(t.source_broker_server), '') = ''
          OR COALESCE(TRIM(a.broker_server), '') = ''
          OR LOWER(TRIM(a.broker_server)) = LOWER(TRIM(t.source_broker_server))
     )
    WHERE t.account_id IS NULL
      AND NULLIF(TRIM(t.broker_account_id), '') IS NOT NULL
      AND NULLIF(TRIM(a.external_account_id), '') IS NOT NULL
    GROUP BY t.id
)
INSERT INTO trade_account_remediation_audit (
    trade_id,
    user_id,
    legacy_account_id,
    classification,
    matched_account_id
)
SELECT
    t.id,
    t.user_id,
    t.broker_account_id,
    'DETERMINISTIC_EXTERNAL_MATCH',
    matches.account_id
FROM trades t
JOIN deterministic_matches matches ON matches.trade_id = t.id
WHERE matches.match_count = 1
ON CONFLICT (trade_id) DO NOTHING;

UPDATE trades t
SET account_id = audit.matched_account_id
FROM trade_account_remediation_audit audit
WHERE audit.trade_id = t.id
  AND audit.classification = 'DETERMINISTIC_EXTERNAL_MATCH'
  AND t.account_id IS NULL;

INSERT INTO trade_account_remediation_audit (
    trade_id,
    user_id,
    legacy_account_id,
    classification,
    matched_account_id
)
SELECT
    t.id,
    t.user_id,
    t.broker_account_id,
    CASE
        WHEN NULLIF(TRIM(t.broker_account_id), '') IS NULL THEN 'UNASSIGNED'
        ELSE 'UNMATCHED_OR_AMBIGUOUS_LEGACY'
    END,
    NULL
FROM trades t
WHERE t.account_id IS NULL
ON CONFLICT (trade_id) DO NOTHING;
