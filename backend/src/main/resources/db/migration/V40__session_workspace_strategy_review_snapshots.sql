ALTER TABLE session_setups
    ADD COLUMN IF NOT EXISTS strategy_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS review_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;
