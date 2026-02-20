DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'asset_scope'
          AND n.nspname = current_schema()
          AND e.enumlabel = 'STRATEGY'
    ) THEN
        ALTER TYPE asset_scope ADD VALUE 'STRATEGY';
    END IF;
END
$$;

ALTER TABLE user_strategies
    ADD COLUMN IF NOT EXISTS entry_conditions_rich TEXT,
    ADD COLUMN IF NOT EXISTS snapshot_asset_id UUID;

UPDATE user_strategies
SET entry_conditions_rich = entry_conditions
WHERE entry_conditions_rich IS NULL
  AND entry_conditions IS NOT NULL;

ALTER TABLE user_strategies
    ALTER COLUMN entry_conditions_rich SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_user_strategies_snapshot_asset'
          AND connamespace = current_schema()::regnamespace
    ) THEN
        ALTER TABLE user_strategies
            ADD CONSTRAINT fk_user_strategies_snapshot_asset
                FOREIGN KEY (snapshot_asset_id) REFERENCES asset (id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_user_strategies_snapshot_asset
    ON user_strategies (snapshot_asset_id);

CREATE TABLE IF NOT EXISTS strategy_asset
(
    id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID                    NOT NULL REFERENCES user_strategies (id) ON DELETE CASCADE,
    asset_id   UUID                     NOT NULL REFERENCES asset (id) ON DELETE CASCADE,
    sort_order INTEGER                  NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_strategy_asset UNIQUE (strategy_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_strategy_asset_strategy_sort
    ON strategy_asset (strategy_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_strategy_asset_asset
    ON strategy_asset (asset_id);

ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS trade_currency VARCHAR(10),
    ADD COLUMN IF NOT EXISTS profile_currency VARCHAR(10),
    ADD COLUMN IF NOT EXISTS fx_rate_trade_to_profile NUMERIC(18, 8),
    ADD COLUMN IF NOT EXISTS fx_rate_timestamp TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS fx_rate_source VARCHAR(32),
    ADD COLUMN IF NOT EXISTS pnl_profile_currency NUMERIC(18, 4),
    ADD COLUMN IF NOT EXISTS fees_profile_currency NUMERIC(18, 4);

UPDATE trades t
SET trade_currency = COALESCE(NULLIF(t.trade_currency, ''), COALESCE(NULLIF(u.base_currency, ''), 'USD')),
    profile_currency = COALESCE(NULLIF(t.profile_currency, ''), COALESCE(NULLIF(u.base_currency, ''), 'USD')),
    fx_rate_trade_to_profile = COALESCE(t.fx_rate_trade_to_profile, 1),
    fx_rate_timestamp = COALESCE(t.fx_rate_timestamp, CURRENT_TIMESTAMP),
    fx_rate_source = COALESCE(NULLIF(t.fx_rate_source, ''), 'LEGACY_DEFAULT'),
    pnl_profile_currency = COALESCE(t.pnl_profile_currency, t.pnl_net),
    fees_profile_currency = COALESCE(t.fees_profile_currency, t.fees)
FROM users u
WHERE u.id = t.user_id;

ALTER TABLE trades
    ALTER COLUMN trade_currency SET NOT NULL,
    ALTER COLUMN profile_currency SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_profile_currency
    ON trades (user_id, profile_currency);

CREATE INDEX IF NOT EXISTS idx_trades_trade_currency
    ON trades (user_id, trade_currency);
