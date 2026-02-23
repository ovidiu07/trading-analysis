CREATE TABLE IF NOT EXISTS session_auto_trade_events
(
    id             UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id     UUID                     NOT NULL REFERENCES today_sessions (id) ON DELETE CASCADE,
    user_id        UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    trade_id       UUID                              REFERENCES trades (id) ON DELETE SET NULL,
    event_type     VARCHAR(24)              NOT NULL,
    price_side     VARCHAR(8),
    price          NUMERIC(18, 8),
    note           VARCHAR(280),
    created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_session_auto_trade_event_type CHECK (
        event_type IN (
            'ARMED',
            'DISARMED',
            'ENTRY_FILLED',
            'SL_HIT',
            'TP_HIT',
            'TIMEOUT',
            'ERROR',
            'MANUAL_CLOSE',
            'KEEP_ALIVE'
        )
    ),
    CONSTRAINT chk_session_auto_trade_price_side CHECK (
        price_side IS NULL OR price_side IN ('BID', 'ASK')
    ),
    CONSTRAINT chk_session_auto_trade_price_positive CHECK (
        price IS NULL OR price > 0
    )
);

CREATE INDEX IF NOT EXISTS idx_session_auto_trade_events_session_created
    ON session_auto_trade_events (session_id, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS idx_session_auto_trade_events_user_created
    ON session_auto_trade_events (user_id, created_at_utc DESC);
