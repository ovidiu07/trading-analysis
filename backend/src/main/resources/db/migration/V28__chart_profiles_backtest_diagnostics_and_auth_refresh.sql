CREATE TABLE IF NOT EXISTS chart_profiles
(
    id                UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name              VARCHAR(120)             NOT NULL,
    is_default        BOOLEAN                  NOT NULL DEFAULT FALSE,
    scope             VARCHAR(32)              NOT NULL DEFAULT 'SESSION_MODE',
    embed_config_json JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    tja_prefs_json    JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_chart_profiles_name_nonblank CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_chart_profiles_scope CHECK (scope IN ('SESSION_MODE'))
);

CREATE INDEX IF NOT EXISTS idx_chart_profiles_user_scope_updated
    ON chart_profiles (user_id, scope, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uk_chart_profiles_user_scope_default
    ON chart_profiles (user_id, scope)
    WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS strategy_versions
(
    id             UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id    UUID                     NOT NULL REFERENCES user_strategies (id) ON DELETE CASCADE,
    user_id        UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    version_number INTEGER                  NOT NULL,
    snapshot_json  JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_strategy_versions_unique UNIQUE (strategy_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_strategy_versions_strategy_desc
    ON strategy_versions (strategy_id, version_number DESC);

CREATE TABLE IF NOT EXISTS checklist_template_versions
(
    id             UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id    UUID                     NOT NULL REFERENCES checklist_templates (id) ON DELETE CASCADE,
    user_id        UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    version_number INTEGER                  NOT NULL,
    items_json     JSONB                    NOT NULL DEFAULT '[]'::jsonb,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_checklist_template_versions_unique UNIQUE (template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_checklist_template_versions_template_desc
    ON checklist_template_versions (template_id, version_number DESC);

CREATE TABLE IF NOT EXISTS context_snapshots
(
    id                           UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                      UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    mode                         VARCHAR(16)              NOT NULL,
    strategy_id                  UUID REFERENCES user_strategies (id) ON DELETE SET NULL,
    strategy_version_id          UUID REFERENCES strategy_versions (id) ON DELETE SET NULL,
    prereqs_template_id          UUID REFERENCES checklist_templates (id) ON DELETE SET NULL,
    prereqs_template_version_id  UUID REFERENCES checklist_template_versions (id) ON DELETE SET NULL,
    prereqs_states_json          JSONB                    NOT NULL DEFAULT '[]'::jsonb,
    triggers_template_id         UUID REFERENCES checklist_templates (id) ON DELETE SET NULL,
    triggers_template_version_id UUID REFERENCES checklist_template_versions (id) ON DELETE SET NULL,
    triggers_states_json         JSONB                    NOT NULL DEFAULT '[]'::jsonb,
    selected_sweep_level_id      UUID,
    levels_snapshot_json         JSONB                    NOT NULL DEFAULT '[]'::jsonb,
    lock_in_snapshot_json        JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    rr_at_entry                  NUMERIC(18, 8),
    quality_score_inputs_json    JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_context_snapshots_mode CHECK (mode IN ('LIVE', 'BACKTEST'))
);

CREATE INDEX IF NOT EXISTS idx_context_snapshots_user_mode_created
    ON context_snapshots (user_id, mode, created_at DESC);

ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS context_snapshot_id UUID REFERENCES context_snapshots (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS strategy_version_id UUID REFERENCES strategy_versions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trades_context_snapshot
    ON trades (context_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_trades_strategy_version
    ON trades (strategy_version_id);

CREATE TABLE IF NOT EXISTS candle_cache
(
    id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider   VARCHAR(32)              NOT NULL,
    symbol     VARCHAR(64)              NOT NULL,
    timeframe  VARCHAR(16)              NOT NULL,
    range_from TIMESTAMP WITH TIME ZONE NOT NULL,
    range_to   TIMESTAMP WITH TIME ZONE NOT NULL,
    payload    TEXT                     NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_candle_cache_key UNIQUE (provider, symbol, timeframe, range_from, range_to)
);

CREATE INDEX IF NOT EXISTS idx_candle_cache_lookup
    ON candle_cache (provider, symbol, timeframe, range_from, range_to);

CREATE TABLE IF NOT EXISTS backtest_runs
(
    id             UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    symbol         VARCHAR(64)              NOT NULL,
    timeframe      VARCHAR(16)              NOT NULL,
    range_from     TIMESTAMP WITH TIME ZONE NOT NULL,
    range_to       TIMESTAMP WITH TIME ZONE NOT NULL,
    session_window VARCHAR(64),
    spread         NUMERIC(18, 8),
    slippage       NUMERIC(18, 8),
    provider       VARCHAR(32)              NOT NULL DEFAULT 'OANDA',
    status         VARCHAR(24)              NOT NULL DEFAULT 'READY',
    candle_count   INTEGER                  NOT NULL DEFAULT 0,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_backtest_runs_status CHECK (status IN ('READY', 'RUNNING', 'COMPLETED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_backtest_runs_user_created
    ON backtest_runs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS backtest_trades
(
    id                     UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id                 UUID                     NOT NULL REFERENCES backtest_runs (id) ON DELETE CASCADE,
    user_id                UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    strategy_id            UUID REFERENCES user_strategies (id) ON DELETE SET NULL,
    strategy_version_id    UUID REFERENCES strategy_versions (id) ON DELETE SET NULL,
    context_snapshot_id    UUID REFERENCES context_snapshots (id) ON DELETE SET NULL,
    symbol                 VARCHAR(64)              NOT NULL,
    direction              VARCHAR(8)               NOT NULL,
    order_type             VARCHAR(16)              NOT NULL DEFAULT 'MARKET',
    entry_price            NUMERIC(18, 8)           NOT NULL,
    stop_loss_price        NUMERIC(18, 8)           NOT NULL,
    take_profit_price      NUMERIC(18, 8),
    risk_amount            NUMERIC(18, 4),
    invalidation_text      TEXT,
    requested_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    entry_time             TIMESTAMP WITH TIME ZONE,
    exit_time              TIMESTAMP WITH TIME ZONE,
    filled                 BOOLEAN                  NOT NULL DEFAULT FALSE,
    exit_reason            VARCHAR(16),
    win                    BOOLEAN,
    break_even             BOOLEAN                  NOT NULL DEFAULT FALSE,
    r_multiple             NUMERIC(18, 8),
    mae_price              NUMERIC(18, 8),
    mfe_price              NUMERIC(18, 8),
    mae_r                  NUMERIC(18, 8),
    mfe_r                  NUMERIC(18, 8),
    duration_minutes       INTEGER,
    duration_bars          INTEGER,
    time_to_plus_1r_minutes INTEGER,
    time_to_plus_1r_bars   INTEGER,
    metadata_json          JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_backtest_trades_direction CHECK (direction IN ('LONG', 'SHORT')),
    CONSTRAINT chk_backtest_trades_order_type CHECK (order_type IN ('MARKET', 'LIMIT')),
    CONSTRAINT chk_backtest_trades_exit_reason CHECK (exit_reason IS NULL OR exit_reason IN ('SL', 'TP', 'MANUAL', 'OPEN'))
);

CREATE INDEX IF NOT EXISTS idx_backtest_trades_run_created
    ON backtest_trades (run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backtest_trades_user_created
    ON backtest_trades (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backtest_trades_context_snapshot
    ON backtest_trades (context_snapshot_id);
