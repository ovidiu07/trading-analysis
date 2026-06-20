ALTER TABLE backtesting_trades
    DROP CONSTRAINT IF EXISTS backtesting_trades_strategy_id_fkey;

ALTER TABLE backtesting_trades
    ADD COLUMN IF NOT EXISTS strategy_source VARCHAR(16),
    ADD COLUMN IF NOT EXISTS strategy_name_snapshot VARCHAR(255),
    ADD COLUMN IF NOT EXISTS gap_present BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS gap_type VARCHAR(16),
    ADD COLUMN IF NOT EXISTS gap_timeframe VARCHAR(40),
    ADD COLUMN IF NOT EXISTS gap_created_at TIME,
    ADD COLUMN IF NOT EXISTS gap_mitigated_at TIME,
    ADD COLUMN IF NOT EXISTS gap_high NUMERIC(20, 8),
    ADD COLUMN IF NOT EXISTS gap_low NUMERIC(20, 8),
    ADD COLUMN IF NOT EXISTS gap_midpoint NUMERIC(20, 8),
    ADD COLUMN IF NOT EXISTS gap_size_points NUMERIC(20, 8),
    ADD COLUMN IF NOT EXISTS gap_size_percent NUMERIC(12, 6),
    ADD COLUMN IF NOT EXISTS gap_entry_position_percent NUMERIC(12, 6),
    ADD COLUMN IF NOT EXISTS gap_fill_status VARCHAR(32),
    ADD COLUMN IF NOT EXISTS gap_relation_to_liquidity VARCHAR(48),
    ADD COLUMN IF NOT EXISTS gap_confluence_notes TEXT;

UPDATE backtesting_trades trade
SET strategy_source = 'MY',
    strategy_name_snapshot = strategy.name
FROM user_strategies strategy
WHERE trade.strategy_id = strategy.id
  AND (trade.strategy_source IS NULL OR trade.strategy_name_snapshot IS NULL);

ALTER TABLE backtesting_trades
    ADD CONSTRAINT chk_backtesting_trade_strategy_source
        CHECK (strategy_source IS NULL OR strategy_source IN ('MY', 'MENTOR')),
    ADD CONSTRAINT chk_backtesting_trade_gap_entry_position
        CHECK (gap_entry_position_percent IS NULL OR (gap_entry_position_percent >= 0 AND gap_entry_position_percent <= 100)),
    ADD CONSTRAINT chk_backtesting_trade_gap_size_percent
        CHECK (gap_size_percent IS NULL OR gap_size_percent >= 0);

CREATE INDEX IF NOT EXISTS idx_backtesting_trades_strategy ON backtesting_trades (user_id, strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtesting_trades_gap ON backtesting_trades (user_id, gap_present, gap_type, gap_fill_status);
