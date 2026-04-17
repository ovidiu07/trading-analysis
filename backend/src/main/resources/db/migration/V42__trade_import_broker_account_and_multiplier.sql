ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS broker_account_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS contract_multiplier NUMERIC(18, 8);

UPDATE trades
SET contract_multiplier = 1
WHERE contract_multiplier IS NULL;

ALTER TABLE trades
    ALTER COLUMN contract_multiplier SET DEFAULT 1,
    ALTER COLUMN contract_multiplier SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_user_broker_account_id
    ON trades (user_id, broker_account_id);

CREATE INDEX IF NOT EXISTS idx_trades_import_lookup
    ON trades (user_id, symbol, direction, opened_at, broker_account_id);
