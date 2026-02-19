ALTER TABLE content_post
    ADD COLUMN IF NOT EXISTS trading_view_symbol VARCHAR(120),
    ADD COLUMN IF NOT EXISTS trading_view_interval VARCHAR(8),
    ADD COLUMN IF NOT EXISTS trading_view_theme VARCHAR(16),
    ADD COLUMN IF NOT EXISTS trading_view_hide_controls BOOLEAN,
    ADD COLUMN IF NOT EXISTS trading_view_allow_symbol_change BOOLEAN,
    ADD COLUMN IF NOT EXISTS snapshot_asset_id UUID,
    ADD COLUMN IF NOT EXISTS snapshot_caption TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_content_post_snapshot_asset'
          AND connamespace = current_schema()::regnamespace
    ) THEN
        ALTER TABLE content_post
            ADD CONSTRAINT fk_content_post_snapshot_asset
                FOREIGN KEY (snapshot_asset_id) REFERENCES asset (id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_content_post_snapshot_asset
    ON content_post (snapshot_asset_id);

ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS initial_notes TEXT;
