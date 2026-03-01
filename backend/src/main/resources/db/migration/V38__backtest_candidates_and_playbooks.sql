ALTER TABLE backtest_setups
    ADD COLUMN IF NOT EXISTS template_key VARCHAR(64),
    ADD COLUMN IF NOT EXISTS candidate_state VARCHAR(32),
    ADD COLUMN IF NOT EXISTS quality_score NUMERIC(8, 4),
    ADD COLUMN IF NOT EXISTS quality_label VARCHAR(32),
    ADD COLUMN IF NOT EXISTS story_summary TEXT,
    ADD COLUMN IF NOT EXISTS converted_trade_id UUID,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

UPDATE backtest_setups
SET candidate_state = COALESCE(candidate_state, 'DETECTED')
WHERE candidate_state IS NULL;

ALTER TABLE backtest_setups
    ALTER COLUMN candidate_state SET DEFAULT 'DETECTED';

ALTER TABLE backtest_setups
    ALTER COLUMN candidate_state SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_backtest_setups_run_state_created
    ON backtest_setups (run_id, candidate_state, created_at);

CREATE TABLE IF NOT EXISTS backtest_candidate_reviews
(
    id             UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    setup_id       UUID                     NOT NULL REFERENCES backtest_setups (id) ON DELETE CASCADE,
    user_id        UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    decision       VARCHAR(16)              NOT NULL,
    note           TEXT,
    reviewed_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backtest_candidate_reviews_setup_created
    ON backtest_candidate_reviews (setup_id, created_at_utc DESC);

CREATE TABLE IF NOT EXISTS strategy_playbooks
(
    id                      UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    dataset_set_id          UUID                     REFERENCES backtest_dataset_sets (id) ON DELETE SET NULL,
    strategy_config_id      UUID                     REFERENCES backtest_strategy_configs (id) ON DELETE SET NULL,
    run_id                  UUID                     REFERENCES backtest_runs (id) ON DELETE SET NULL,
    name                    VARCHAR(180)             NOT NULL,
    template_family         VARCHAR(64)              NOT NULL DEFAULT 'CUSTOM',
    status                  VARCHAR(16)              NOT NULL DEFAULT 'ACTIVE',
    expected_win_rate       NUMERIC(8, 4),
    expectancy_r            NUMERIC(12, 6),
    profit_factor           NUMERIC(12, 6),
    max_drawdown_r          NUMERIC(12, 6),
    sample_size             INTEGER,
    playbook_json           JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    validation_summary_json JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at_utc          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_strategy_playbooks_name_nonblank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_strategy_playbooks_user_updated
    ON strategy_playbooks (user_id, updated_at_utc DESC);

ALTER TABLE today_sessions
    ADD COLUMN IF NOT EXISTS active_playbook_id UUID,
    ADD COLUMN IF NOT EXISTS active_playbook_name VARCHAR(180),
    ADD COLUMN IF NOT EXISTS active_playbook_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'today_sessions'
          AND constraint_name = 'fk_today_sessions_active_playbook'
    ) THEN
        ALTER TABLE today_sessions
            ADD CONSTRAINT fk_today_sessions_active_playbook
                FOREIGN KEY (active_playbook_id)
                    REFERENCES strategy_playbooks (id)
                    ON DELETE SET NULL;
    END IF;
END;
$$;
