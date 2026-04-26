ALTER TABLE today_sessions
    ADD COLUMN IF NOT EXISTS risk_per_trade NUMERIC(18, 4),
    ADD COLUMN IF NOT EXISTS max_consecutive_losses INTEGER,
    ADD COLUMN IF NOT EXISTS stop_after_target_reached BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS stop_after_max_loss_reached BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE today_sessions
    ADD CONSTRAINT chk_today_sessions_risk_per_trade_non_negative
        CHECK (risk_per_trade IS NULL OR risk_per_trade >= 0);

ALTER TABLE today_sessions
    ADD CONSTRAINT chk_today_sessions_max_consecutive_losses_positive
        CHECK (max_consecutive_losses IS NULL OR max_consecutive_losses > 0);

ALTER TABLE session_setups
    ADD COLUMN IF NOT EXISTS confluences_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS manual_setup_mode BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TYPE planscope ADD VALUE IF NOT EXISTS 'MONTHLY';
