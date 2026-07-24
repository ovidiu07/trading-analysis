ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS external_instrument_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS external_symbol VARCHAR(80),
    ADD COLUMN IF NOT EXISTS broker_reported_result_after_fx_fee NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS source_exchange_rate NUMERIC(24,10),
    ADD COLUMN IF NOT EXISTS broker_reported_spread NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS fx_fee NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS overnight_interest NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS dividend_adjustment NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS source_recorded_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE instrument_aliases
    ADD COLUMN IF NOT EXISTS external_instrument_name VARCHAR(255);

CREATE UNIQUE INDEX uq_trading212_trade_external_position
    ON trades (user_id, account_id, source, external_position_id)
    WHERE source = 'TRADING212_CSV'
      AND account_id IS NOT NULL
      AND external_position_id IS NOT NULL;

CREATE INDEX idx_trading212_trades_external_order
    ON trades (user_id, account_id, external_order_id)
    WHERE source = 'TRADING212_CSV';
