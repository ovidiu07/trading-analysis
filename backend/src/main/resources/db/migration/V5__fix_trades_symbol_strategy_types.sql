DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'trades'
          AND column_name = 'symbol'
          AND data_type = 'bytea'
    ) THEN
        ALTER TABLE trades
            ALTER COLUMN symbol
            TYPE text
            USING CASE
                WHEN symbol IS NULL THEN NULL
                ELSE convert_from(symbol, 'UTF8')
            END;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'trades'
          AND column_name = 'strategy_tag'
          AND data_type = 'bytea'
    ) THEN
        ALTER TABLE trades
            ALTER COLUMN strategy_tag
            TYPE text
            USING CASE
                WHEN strategy_tag IS NULL THEN NULL
                ELSE convert_from(strategy_tag, 'UTF8')
            END;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trades_user_symbol_lower ON trades (user_id, lower(symbol));
CREATE INDEX IF NOT EXISTS idx_trades_user_strategy_lower ON trades (user_id, lower(strategy_tag));
