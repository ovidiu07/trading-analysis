CREATE TABLE IF NOT EXISTS session_setups
(
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id             UUID                     NOT NULL REFERENCES today_sessions (id) ON DELETE CASCADE,
    user_id                UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    symbol                 VARCHAR(64)              NOT NULL,
    direction              direction_type           NOT NULL,
    market                 market_type,
    trade_session          trade_session,
    strategy_id            UUID,
    strategy_label         VARCHAR(120),
    setup_title            VARCHAR(140)             NOT NULL,
    bias_alignment         VARCHAR(24),
    narrative_snapshot_json JSONB                   NOT NULL DEFAULT '{}'::jsonb,
    context_snapshot_json  JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    trigger_snapshot_json  JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    execution_snapshot_json JSONB                   NOT NULL DEFAULT '{}'::jsonb,
    levels_json            JSONB                    NOT NULL DEFAULT '[]'::jsonb,
    mentor_reference_json  JSONB,
    readiness_score        INTEGER                  NOT NULL DEFAULT 0,
    readiness_state        VARCHAR(24)              NOT NULL DEFAULT 'INCOMPLETE',
    status                 VARCHAR(24)              NOT NULL DEFAULT 'DRAFT',
    linked_trade_id        UUID REFERENCES trades (id) ON DELETE SET NULL,
    executed_at            TIMESTAMP WITH TIME ZONE,
    invalidated_at         TIMESTAMP WITH TIME ZONE,
    skipped_at             TIMESTAMP WITH TIME ZONE,
    archived_at            TIMESTAMP WITH TIME ZONE,
    closed_at              TIMESTAMP WITH TIME ZONE,
    sort_order             INTEGER                  NOT NULL DEFAULT 0,
    created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_session_setups_symbol_nonblank CHECK (length(trim(symbol)) > 0),
    CONSTRAINT chk_session_setups_title_nonblank CHECK (length(trim(setup_title)) > 0),
    CONSTRAINT chk_session_setups_readiness_score CHECK (readiness_score BETWEEN 0 AND 100),
    CONSTRAINT chk_session_setups_sort_order CHECK (sort_order >= 0),
    CONSTRAINT chk_session_setups_readiness_state CHECK (
        readiness_state IN ('READY', 'INCOMPLETE', 'BLOCKED')
    ),
    CONSTRAINT chk_session_setups_status CHECK (
        status IN ('DRAFT', 'WATCHING', 'READY', 'TRIGGERED', 'EXECUTED', 'INVALIDATED', 'SKIPPED', 'ARCHIVED', 'CLOSED')
    )
);

CREATE INDEX IF NOT EXISTS idx_session_setups_session_sort
    ON session_setups (session_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_session_setups_user_status
    ON session_setups (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_setups_session_symbol
    ON session_setups (session_id, symbol);

ALTER TABLE today_sessions
    ADD COLUMN IF NOT EXISTS live_mode_only BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS active_setup_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_today_sessions_active_setup'
    ) THEN
        ALTER TABLE today_sessions
            ADD CONSTRAINT fk_today_sessions_active_setup
                FOREIGN KEY (active_setup_id) REFERENCES session_setups (id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_today_sessions_active_setup
    ON today_sessions (active_setup_id);

ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS setup_id UUID REFERENCES session_setups (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trades_setup_id
    ON trades (setup_id);
