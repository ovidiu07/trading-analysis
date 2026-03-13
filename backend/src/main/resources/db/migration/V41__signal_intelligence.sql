ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tradingview_webhook_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tradingview_webhook_secret_hash VARCHAR(128),
    ADD COLUMN IF NOT EXISTS tradingview_webhook_secret_hint VARCHAR(24),
    ADD COLUMN IF NOT EXISTS tradingview_webhook_secret_rotated_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS signal_events
(
    id                   UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    external_trade_id    VARCHAR(191)             NOT NULL,
    symbol               VARCHAR(64)              NOT NULL,
    timeframe            VARCHAR(16)              NOT NULL,
    event_type           VARCHAR(32)              NOT NULL DEFAULT 'SIGNAL_OPEN',
    setup_type           VARCHAR(48)              NOT NULL,
    direction            VARCHAR(8)               NOT NULL,
    signal_timestamp     TIMESTAMP WITH TIME ZONE NOT NULL,
    signal_bar_time      TIMESTAMP WITH TIME ZONE NOT NULL,
    entry_price          NUMERIC(18, 8)           NOT NULL,
    stop_loss            NUMERIC(18, 8)           NOT NULL,
    take_profit          NUMERIC(18, 8),
    rr                   NUMERIC(18, 8),
    confidence_score     INTEGER                  NOT NULL,
    regime               VARCHAR(32)              NOT NULL,
    htf_bias             VARCHAR(16)              NOT NULL,
    session_name         VARCHAR(64),
    parameter_profile_id VARCHAR(64)              NOT NULL,
    schema_version       VARCHAR(16)              NOT NULL,
    raw_payload_json     JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_signal_events_user_external UNIQUE (user_id, external_trade_id),
    CONSTRAINT chk_signal_events_direction CHECK (direction IN ('LONG', 'SHORT')),
    CONSTRAINT chk_signal_events_event_type CHECK (event_type IN ('SIGNAL_OPEN')),
    CONSTRAINT chk_signal_events_regime CHECK (regime IN ('TREND', 'RANGE', 'VOL_EXPANSION', 'VOL_COMPRESSION')),
    CONSTRAINT chk_signal_events_htf_bias CHECK (htf_bias IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    CONSTRAINT chk_signal_events_confidence CHECK (confidence_score BETWEEN 0 AND 100),
    CONSTRAINT chk_signal_events_rr CHECK (rr IS NULL OR (rr >= 0 AND rr <= 50))
);

CREATE INDEX IF NOT EXISTS idx_signal_events_user_symbol_timeframe_ts
    ON signal_events (user_id, symbol, timeframe, signal_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_signal_events_user_setup
    ON signal_events (user_id, setup_type);

CREATE INDEX IF NOT EXISTS idx_signal_events_user_regime
    ON signal_events (user_id, regime);

CREATE INDEX IF NOT EXISTS idx_signal_events_user_profile
    ON signal_events (user_id, parameter_profile_id);

CREATE TABLE IF NOT EXISTS signal_feature_snapshots
(
    id                UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_event_id   UUID                     NOT NULL REFERENCES signal_events (id) ON DELETE CASCADE,
    atr               NUMERIC(18, 8),
    atr_mean          NUMERIC(18, 8),
    adx               NUMERIC(18, 8),
    ema_slope         NUMERIC(18, 8),
    body_pct          NUMERIC(18, 8),
    sweep_depth_atr   NUMERIC(18, 8),
    fvg_size_atr      NUMERIC(18, 8),
    ob_size_atr       NUMERIC(18, 8),
    volatility_state  VARCHAR(32),
    range_state       VARCHAR(32),
    feature_json      JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_signal_feature_snapshots_event UNIQUE (signal_event_id)
);

CREATE TABLE IF NOT EXISTS signal_outcomes
(
    id                UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_event_id   UUID                     NOT NULL REFERENCES signal_events (id) ON DELETE CASCADE,
    outcome_status    VARCHAR(24)              NOT NULL,
    close_timestamp   TIMESTAMP WITH TIME ZONE NOT NULL,
    pnl_r             NUMERIC(18, 8),
    pnl_amount        NUMERIC(18, 8),
    hold_bars         INTEGER,
    hold_minutes      INTEGER,
    exit_reason       VARCHAR(32),
    slippage          NUMERIC(18, 8),
    linked_trade_id   UUID REFERENCES trades (id) ON DELETE SET NULL,
    raw_payload_json  JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_signal_outcomes_event UNIQUE (signal_event_id),
    CONSTRAINT chk_signal_outcomes_status CHECK (outcome_status IN ('WIN', 'LOSS', 'BREAKEVEN', 'OPEN', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_signal_outcomes_close_timestamp
    ON signal_outcomes (close_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_signal_outcomes_linked_trade
    ON signal_outcomes (linked_trade_id);

CREATE TABLE IF NOT EXISTS signal_profile_recommendations
(
    id                   UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    symbol_scope         VARCHAR(64)              NOT NULL,
    timeframe            VARCHAR(16)              NOT NULL,
    regime_scope         VARCHAR(32)              NOT NULL,
    profile_id           VARCHAR(64)              NOT NULL,
    profile_json         JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    min_samples          INTEGER                  NOT NULL,
    sample_size          INTEGER                  NOT NULL DEFAULT 0,
    recommendation_score NUMERIC(18, 8)          NOT NULL,
    win_rate             NUMERIC(18, 8),
    expectancy_r         NUMERIC(18, 8),
    active               BOOLEAN                  NOT NULL DEFAULT TRUE,
    generated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signal_profile_recommendations_lookup
    ON signal_profile_recommendations (user_id, symbol_scope, timeframe, regime_scope, active, generated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uk_signal_profile_recommendations_active_scope
    ON signal_profile_recommendations (user_id, symbol_scope, timeframe, regime_scope)
    WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS signal_performance_aggregates
(
    id                   UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    symbol               VARCHAR(64)              NOT NULL,
    timeframe            VARCHAR(16)              NOT NULL,
    parameter_profile_id VARCHAR(64)              NOT NULL,
    setup_type           VARCHAR(48)              NOT NULL,
    regime               VARCHAR(32)              NOT NULL,
    direction            VARCHAR(8)               NOT NULL,
    sample_size          INTEGER                  NOT NULL,
    win_rate             NUMERIC(18, 8)          NOT NULL,
    avg_pnl_r            NUMERIC(18, 8)          NOT NULL,
    expectancy_r         NUMERIC(18, 8)          NOT NULL,
    max_drawdown_r       NUMERIC(18, 8)          NOT NULL,
    avg_confidence_score NUMERIC(18, 8)          NOT NULL DEFAULT 0,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_signal_performance_direction CHECK (direction IN ('LONG', 'SHORT')),
    CONSTRAINT chk_signal_performance_regime CHECK (regime IN ('TREND', 'RANGE', 'VOL_EXPANSION', 'VOL_COMPRESSION'))
);

CREATE INDEX IF NOT EXISTS idx_signal_performance_aggregates_user_symbol_timeframe
    ON signal_performance_aggregates (user_id, symbol, timeframe, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_performance_aggregates_user_setup_regime
    ON signal_performance_aggregates (user_id, setup_type, regime, direction);

CREATE UNIQUE INDEX IF NOT EXISTS uk_signal_performance_aggregates_scope
    ON signal_performance_aggregates (user_id, symbol, timeframe, parameter_profile_id, setup_type, regime, direction);
