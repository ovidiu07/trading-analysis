DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'asset_scope'
          AND n.nspname = current_schema()
          AND e.enumlabel = 'TRADE'
    ) THEN
        ALTER TYPE asset_scope ADD VALUE 'TRADE';
    END IF;
END
$$;

ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS entry_journal_text TEXT,
    ADD COLUMN IF NOT EXISTS entry_invalidation TEXT;

CREATE TABLE IF NOT EXISTS trade_entry_screenshot_assets
(
    trade_id UUID NOT NULL REFERENCES trades (id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES asset (id) ON DELETE CASCADE,
    CONSTRAINT pk_trade_entry_screenshot_assets PRIMARY KEY (trade_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_entry_screenshot_assets_trade
    ON trade_entry_screenshot_assets (trade_id);

CREATE INDEX IF NOT EXISTS idx_trade_entry_screenshot_assets_asset
    ON trade_entry_screenshot_assets (asset_id);
