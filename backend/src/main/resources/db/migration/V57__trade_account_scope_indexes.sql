CREATE INDEX IF NOT EXISTS idx_trades_user_account_id
    ON trades (user_id, account_id);

CREATE INDEX IF NOT EXISTS idx_trades_user_account_closed_at
    ON trades (user_id, account_id, closed_at);

CREATE INDEX IF NOT EXISTS idx_trades_user_account_opened_at
    ON trades (user_id, account_id, opened_at);
