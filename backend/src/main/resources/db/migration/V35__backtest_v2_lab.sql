ALTER TABLE backtest_datasets
    DROP CONSTRAINT IF EXISTS chk_backtest_datasets_timeframe;

ALTER TABLE candle_chunks
    DROP CONSTRAINT IF EXISTS chk_candle_chunks_timeframe;

ALTER TABLE backtest_datasets
    ADD CONSTRAINT chk_backtest_datasets_timeframe
        CHECK (timeframe IN ('M1', 'M5', 'M15', 'H1', 'H4', 'D1', 'W1'));

ALTER TABLE candle_chunks
    ADD CONSTRAINT chk_candle_chunks_timeframe
        CHECK (timeframe IN ('M1', 'M5', 'M15', 'H1', 'H4', 'D1', 'W1'));

CREATE TABLE IF NOT EXISTS backtest_dataset_sets
(
    id             UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    instrument     VARCHAR(64)              NOT NULL,
    timezone_basis VARCHAR(64)              NOT NULL DEFAULT 'UTC',
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backtest_dataset_sets_user_created
    ON backtest_dataset_sets (user_id, created_at DESC);

ALTER TABLE backtest_datasets
    ADD COLUMN IF NOT EXISTS dataset_set_id UUID REFERENCES backtest_dataset_sets (id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255),
    ADD COLUMN IF NOT EXISTS min_time_utc TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS max_time_utc TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS candle_count INTEGER,
    ADD COLUMN IF NOT EXISTS parsed_ok BOOLEAN,
    ADD COLUMN IF NOT EXISTS error_msg TEXT;

CREATE INDEX IF NOT EXISTS idx_backtest_datasets_dataset_set
    ON backtest_datasets (dataset_set_id, timeframe);

UPDATE backtest_datasets
SET min_time_utc = COALESCE(min_time_utc, data_from),
    max_time_utc = COALESCE(max_time_utc, data_to),
    candle_count = COALESCE(candle_count, row_count),
    parsed_ok = COALESCE(parsed_ok, TRUE),
    original_filename = COALESCE(original_filename, name)
WHERE min_time_utc IS NULL
   OR max_time_utc IS NULL
   OR candle_count IS NULL
   OR parsed_ok IS NULL
   OR original_filename IS NULL;

CREATE TABLE IF NOT EXISTS backtest_strategy_configs
(
    id             UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_set_id UUID                     NOT NULL REFERENCES backtest_dataset_sets (id) ON DELETE CASCADE,
    name           VARCHAR(180)             NOT NULL,
    config_json    JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_backtest_strategy_configs_name_nonblank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_backtest_strategy_configs_dataset_set
    ON backtest_strategy_configs (dataset_set_id, updated_at DESC);

ALTER TABLE backtest_runs
    ADD COLUMN IF NOT EXISTS dataset_set_id UUID REFERENCES backtest_dataset_sets (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS strategy_config_id UUID REFERENCES backtest_strategy_configs (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS from_utc TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS to_utc TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS error_msg TEXT;

UPDATE backtest_runs
SET from_utc = COALESCE(from_utc, range_from),
    to_utc = COALESCE(to_utc, range_to)
WHERE from_utc IS NULL
   OR to_utc IS NULL;

CREATE INDEX IF NOT EXISTS idx_backtest_runs_dataset_set_created
    ON backtest_runs (dataset_set_id, created_at DESC);

CREATE TABLE IF NOT EXISTS backtest_setups
(
    id                   UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id               UUID                     NOT NULL REFERENCES backtest_runs (id) ON DELETE CASCADE,
    session_name         VARCHAR(64),
    direction            VARCHAR(16),
    sweep_type           VARCHAR(64),
    confirm_type         VARCHAR(32),
    sweep_time_utc       TIMESTAMP WITH TIME ZONE,
    displacement_time_utc TIMESTAMP WITH TIME ZONE,
    confirm_time_utc     TIMESTAMP WITH TIME ZONE,
    evidence_json        JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backtest_setups_run_created
    ON backtest_setups (run_id, created_at ASC);

ALTER TABLE backtest_trades
    ADD COLUMN IF NOT EXISTS setup_id UUID REFERENCES backtest_setups (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fill_status VARCHAR(16),
    ADD COLUMN IF NOT EXISTS evidence_json JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS duration_sec INTEGER;

CREATE INDEX IF NOT EXISTS idx_backtest_trades_run_entry_time
    ON backtest_trades (run_id, entry_time ASC);

CREATE TABLE IF NOT EXISTS backtest_run_reports
(
    id                               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id                           UUID                     NOT NULL REFERENCES backtest_runs (id) ON DELETE CASCADE,
    strategy_id                      UUID,
    strategy_name_snapshot           VARCHAR(180)             NOT NULL,
    strategy_config_snapshot_json    JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    filters_snapshot_json            JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    summary_snapshot_json            JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    trades_timeline_snapshot_json    JSONB                    NOT NULL DEFAULT '[]'::jsonb,
    recommendations_snapshot_json    JSONB                    NOT NULL DEFAULT '[]'::jsonb,
    report_markdown                  TEXT                     NOT NULL,
    report_version                   VARCHAR(32)              NOT NULL DEFAULT 'v1',
    created_at_utc                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_backtest_run_reports_run
    ON backtest_run_reports (run_id, created_at_utc);

CREATE INDEX IF NOT EXISTS idx_backtest_run_reports_created
    ON backtest_run_reports (created_at_utc DESC);
