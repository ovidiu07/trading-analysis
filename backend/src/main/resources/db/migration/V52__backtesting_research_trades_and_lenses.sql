CREATE TABLE IF NOT EXISTS backtesting_trades
(
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id        UUID NOT NULL REFERENCES backtesting_workspaces (id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    trade_date          DATE NOT NULL,
    weekday             VARCHAR(16),
    entry_time          TIME NOT NULL,
    instrument          VARCHAR(64) NOT NULL,
    direction           VARCHAR(8) NOT NULL,
    session             VARCHAR(40),
    setup_name          VARCHAR(180),
    strategy_id         UUID REFERENCES user_strategies (id) ON DELETE SET NULL,
    risk_percent        NUMERIC(10, 4),
    planned_rr          NUMERIC(10, 4),
    result              VARCHAR(16) NOT NULL,
    pnl_r               NUMERIC(12, 4) NOT NULL,
    context_timeframe   VARCHAR(40),
    execution_timeframe VARCHAR(40),
    entry_timeframe     VARCHAR(40),
    tags                TEXT,
    notes               TEXT,
    source              VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
    trade_scope         VARCHAR(16) NOT NULL DEFAULT 'BACKTEST',
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_backtesting_trade_direction CHECK (direction IN ('LONG', 'SHORT')),
    CONSTRAINT chk_backtesting_trade_result CHECK (result IN ('WIN', 'LOSS', 'BREAKEVEN')),
    CONSTRAINT chk_backtesting_trade_source CHECK (source IN ('MANUAL', 'IMPORT', 'SCREENSHOT')),
    CONSTRAINT chk_backtesting_trade_scope CHECK (trade_scope IN ('BACKTEST', 'LIVE', 'REPLAY'))
);

CREATE INDEX IF NOT EXISTS idx_backtesting_trades_workspace_time
    ON backtesting_trades (workspace_id, trade_date, entry_time);

CREATE INDEX IF NOT EXISTS idx_backtesting_trades_user_filters
    ON backtesting_trades (user_id, instrument, direction, session, result);

CREATE TABLE IF NOT EXISTS backtesting_edge_lenses
(
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id        UUID NOT NULL REFERENCES backtesting_workspaces (id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name                VARCHAR(160) NOT NULL,
    description         TEXT,
    filter_definition   TEXT NOT NULL,
    metrics_snapshot    TEXT,
    recalculated_at     TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backtesting_edge_lenses_workspace_updated
    ON backtesting_edge_lenses (workspace_id, updated_at DESC);

ALTER TABLE backtesting_screenshots
    ADD COLUMN IF NOT EXISTS backtesting_trade_id UUID REFERENCES backtesting_trades (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_backtesting_screenshots_trade
    ON backtesting_screenshots (backtesting_trade_id);
