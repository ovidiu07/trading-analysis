ALTER TABLE today_sessions
    ADD COLUMN IF NOT EXISTS auto_journal_state VARCHAR(16) NOT NULL DEFAULT 'DISARMED',
    ADD COLUMN IF NOT EXISTS auto_journal_symbol VARCHAR(64),
    ADD COLUMN IF NOT EXISTS auto_journal_side VARCHAR(8),
    ADD COLUMN IF NOT EXISTS auto_journal_entry_price NUMERIC(18, 8),
    ADD COLUMN IF NOT EXISTS auto_journal_sl_price NUMERIC(18, 8),
    ADD COLUMN IF NOT EXISTS auto_journal_tp_price NUMERIC(18, 8),
    ADD COLUMN IF NOT EXISTS auto_journal_tolerance_pips NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS auto_journal_timeout_min INTEGER,
    ADD COLUMN IF NOT EXISTS auto_journal_armed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS auto_journal_last_event_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS auto_journal_last_error VARCHAR(280);

UPDATE today_sessions
SET auto_journal_tolerance_pips = 0
WHERE auto_journal_tolerance_pips IS NULL;

UPDATE today_sessions
SET auto_journal_timeout_min = 30
WHERE auto_journal_timeout_min IS NULL;

ALTER TABLE today_sessions
    ALTER COLUMN auto_journal_tolerance_pips SET DEFAULT 0,
    ALTER COLUMN auto_journal_tolerance_pips SET NOT NULL,
    ALTER COLUMN auto_journal_timeout_min SET DEFAULT 30,
    ALTER COLUMN auto_journal_timeout_min SET NOT NULL;

ALTER TABLE today_sessions
    ADD CONSTRAINT chk_today_sessions_auto_journal_state
        CHECK (auto_journal_state IN ('DISARMED', 'ARMED', 'ACTIVE', 'CLOSED'));

ALTER TABLE today_sessions
    ADD CONSTRAINT chk_today_sessions_auto_journal_side
        CHECK (auto_journal_side IS NULL OR auto_journal_side IN ('LONG', 'SHORT'));

ALTER TABLE today_sessions
    ADD CONSTRAINT chk_today_sessions_auto_journal_prices_positive
        CHECK (
            (auto_journal_entry_price IS NULL OR auto_journal_entry_price > 0)
                AND (auto_journal_sl_price IS NULL OR auto_journal_sl_price > 0)
                AND (auto_journal_tp_price IS NULL OR auto_journal_tp_price > 0)
        );

ALTER TABLE today_sessions
    ADD CONSTRAINT chk_today_sessions_auto_journal_tolerance_non_negative
        CHECK (auto_journal_tolerance_pips >= 0);

ALTER TABLE today_sessions
    ADD CONSTRAINT chk_today_sessions_auto_journal_timeout_positive
        CHECK (auto_journal_timeout_min > 0);

CREATE INDEX IF NOT EXISTS idx_today_sessions_auto_journal_state
    ON today_sessions (auto_journal_state, auto_journal_last_event_at DESC);
