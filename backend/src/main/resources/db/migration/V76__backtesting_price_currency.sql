-- Quote currency is independent of the monetary PnL currency in TradingView exports.
-- Existing rows remain unspecified because their original price header is not stored.
ALTER TABLE backtesting_trades ADD COLUMN price_currency VARCHAR(3);
