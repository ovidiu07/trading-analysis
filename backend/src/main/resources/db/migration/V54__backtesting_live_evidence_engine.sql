ALTER TABLE backtesting_workspaces
    ADD COLUMN IF NOT EXISTS session VARCHAR(40),
    ADD COLUMN IF NOT EXISTS auto_import_mode VARCHAR(32) NOT NULL DEFAULT 'EXACT_MATCH',
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS research_objective TEXT,
    ADD COLUMN IF NOT EXISTS execution_observations TEXT,
    ADD COLUMN IF NOT EXISTS live_execution_gap TEXT,
    ADD COLUMN IF NOT EXISTS next_testing_objective TEXT,
    ADD COLUMN IF NOT EXISTS research_conclusion TEXT;

ALTER TABLE backtesting_workspaces
    DROP CONSTRAINT IF EXISTS chk_backtesting_auto_import_mode;

ALTER TABLE backtesting_workspaces
    ADD CONSTRAINT chk_backtesting_auto_import_mode CHECK (
        auto_import_mode IN ('EXACT_MATCH', 'STRATEGY_MATCH', 'REVIEW_BEFORE_IMPORT', 'DISABLED')
    );

ALTER TABLE backtesting_trades
    DROP CONSTRAINT IF EXISTS chk_backtesting_trade_source;

ALTER TABLE backtesting_trades
    ADD CONSTRAINT chk_backtesting_trade_source CHECK (
        source IN ('MANUAL', 'IMPORT', 'SCREENSHOT', 'LIVE')
    );

CREATE TABLE IF NOT EXISTS backtest_evidence_links
(
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id             UUID REFERENCES backtesting_workspaces (id) ON DELETE SET NULL,
    user_id                  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    live_trade_id            UUID NOT NULL,
    source_type              VARCHAR(16) NOT NULL DEFAULT 'LIVE',
    sync_status              VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    classification_status    VARCHAR(32) NOT NULL DEFAULT 'NEEDS_CLASSIFICATION',
    included_in_analytics    BOOLEAN NOT NULL DEFAULT FALSE,
    excluded_reason          TEXT,
    research_classification  TEXT,
    trade_date               DATE,
    opened_at                TIMESTAMP WITH TIME ZONE,
    closed_at                TIMESTAMP WITH TIME ZONE,
    instrument               VARCHAR(64),
    direction                VARCHAR(16),
    session                  VARCHAR(40),
    timeframe                VARCHAR(40),
    strategy_id              UUID,
    strategy_name_snapshot   VARCHAR(255),
    setup_name               VARCHAR(255),
    setup_grade              VARCHAR(32),
    result                   VARCHAR(16),
    realized_r               NUMERIC(12, 4),
    net_pnl                  NUMERIC(20, 8),
    risk_percent             NUMERIC(10, 4),
    rule_break_count         INTEGER NOT NULL DEFAULT 0,
    screenshot_count         INTEGER NOT NULL DEFAULT 0,
    notes_snapshot           TEXT,
    last_synced_at           TIMESTAMP WITH TIME ZONE,
    created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_backtest_evidence_live_trade UNIQUE (user_id, live_trade_id),
    CONSTRAINT chk_backtest_evidence_source CHECK (source_type IN ('MANUAL', 'LIVE', 'IMPORTED')),
    CONSTRAINT chk_backtest_evidence_sync CHECK (sync_status IN ('SYNCED', 'NEEDS_REVIEW', 'NOT_LINKED', 'EXCLUDED', 'PENDING', 'ERROR')),
    CONSTRAINT chk_backtest_evidence_classification CHECK (classification_status IN ('COMPLETE', 'NEEDS_CLASSIFICATION', 'PARTIAL')),
    CONSTRAINT chk_backtest_evidence_result CHECK (result IS NULL OR result IN ('WIN', 'LOSS', 'BREAKEVEN'))
);

CREATE INDEX IF NOT EXISTS idx_backtest_evidence_workspace_status
    ON backtest_evidence_links (workspace_id, included_in_analytics, sync_status, trade_date);

CREATE INDEX IF NOT EXISTS idx_backtest_evidence_user_inbox
    ON backtest_evidence_links (user_id, sync_status, classification_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_backtesting_workspace_matching
    ON backtesting_workspaces (user_id, status, strategy_id, symbol, session, primary_timeframe, auto_import_mode);

UPDATE backtesting_trades
SET source = 'MANUAL'
WHERE source IS NULL;
