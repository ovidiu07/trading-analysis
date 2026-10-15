-- TradingView signals can contain versioned strategy metadata longer than 255 characters.
ALTER TABLE backtesting_trades ALTER COLUMN entry_signal TYPE TEXT;
ALTER TABLE backtesting_trades ALTER COLUMN exit_signal TYPE TEXT;

-- Workspaces can group research across instruments; each trade retains its own instrument.
ALTER TABLE backtesting_workspaces ALTER COLUMN symbol DROP NOT NULL;
UPDATE backtesting_workspaces SET symbol = NULL WHERE btrim(symbol) = '';
