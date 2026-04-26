DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'asset_scope'
          AND n.nspname = current_schema()
          AND e.enumlabel = 'BACKTESTING'
    ) THEN
        ALTER TYPE asset_scope ADD VALUE 'BACKTESTING';
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS backtesting_workspaces
(
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    symbol                 VARCHAR(40) NOT NULL,
    market_type            VARCHAR(40),
    strategy_id            UUID REFERENCES user_strategies (id) ON DELETE SET NULL,
    strategy_name_snapshot VARCHAR(180),
    title                  VARCHAR(180),
    primary_timeframe      VARCHAR(40),
    context_timeframe      VARCHAR(40),
    execution_timeframe    VARCHAR(40),
    entry_timeframe        VARCHAR(40),
    number_of_trades       INTEGER NOT NULL DEFAULT 0,
    winning_trades         INTEGER NOT NULL DEFAULT 0,
    losing_trades          INTEGER NOT NULL DEFAULT 0,
    breakeven_trades       INTEGER NOT NULL DEFAULT 0,
    average_r              NUMERIC(12, 4),
    notes                  TEXT,
    what_worked            TEXT,
    what_failed            TEXT,
    best_conditions        TEXT,
    avoid_conditions       TEXT,
    status                 VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_backtesting_stats_nonnegative CHECK (
        number_of_trades >= 0
        AND winning_trades >= 0
        AND losing_trades >= 0
        AND breakeven_trades >= 0
    ),
    CONSTRAINT chk_backtesting_stats_categorized CHECK (
        winning_trades + losing_trades + breakeven_trades <= number_of_trades
    ),
    CONSTRAINT chk_backtesting_workspace_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_backtesting_workspaces_user_status_updated
    ON backtesting_workspaces (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_backtesting_workspaces_user_symbol
    ON backtesting_workspaces (user_id, symbol);

CREATE INDEX IF NOT EXISTS idx_backtesting_workspaces_strategy
    ON backtesting_workspaces (strategy_id);

CREATE TABLE IF NOT EXISTS backtesting_screenshots
(
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES backtesting_workspaces (id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    asset_id     UUID NOT NULL REFERENCES asset (id) ON DELETE CASCADE,
    caption      VARCHAR(500),
    trade_result VARCHAR(32),
    session      VARCHAR(60),
    timeframe    VARCHAR(40),
    tags         TEXT,
    sort_order   INTEGER,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_backtesting_screenshot_asset UNIQUE (asset_id),
    CONSTRAINT chk_backtesting_screenshot_result CHECK (
        trade_result IS NULL OR trade_result IN ('WIN', 'LOSS', 'BREAKEVEN', 'MISSED', 'INVALID', 'GOOD_EXAMPLE', 'BAD_EXAMPLE')
    )
);

CREATE INDEX IF NOT EXISTS idx_backtesting_screenshots_workspace_sort
    ON backtesting_screenshots (workspace_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_backtesting_screenshots_user_created
    ON backtesting_screenshots (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backtesting_screenshots_filters
    ON backtesting_screenshots (user_id, trade_result, session, timeframe);
