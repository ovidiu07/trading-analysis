CREATE TABLE IF NOT EXISTS backtest_optimizer_runs
(
    id                 UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    dataset_set_id     UUID                     NOT NULL REFERENCES backtest_dataset_sets (id) ON DELETE CASCADE,
    strategy_config_id UUID                     REFERENCES backtest_strategy_configs (id) ON DELETE SET NULL,
    request_json       JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    results_json       JSONB                    NOT NULL DEFAULT '[]'::jsonb,
    summary_json       JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    variant_count      INTEGER                  NOT NULL DEFAULT 0,
    max_variants       INTEGER                  NOT NULL DEFAULT 100,
    status             VARCHAR(24)              NOT NULL DEFAULT 'COMPLETED',
    created_at_utc     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backtest_optimizer_runs_user_created
    ON backtest_optimizer_runs (user_id, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS idx_backtest_optimizer_runs_dataset_set_created
    ON backtest_optimizer_runs (dataset_set_id, created_at_utc DESC);
