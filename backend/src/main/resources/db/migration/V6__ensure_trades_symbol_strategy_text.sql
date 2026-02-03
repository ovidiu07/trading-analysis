CREATE OR REPLACE FUNCTION safe_convert_from_utf8(input bytea)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF input IS NULL THEN
        RETURN NULL;
    END IF;
    BEGIN
        RETURN convert_from(input, 'UTF8');
    EXCEPTION WHEN others THEN
        RETURN encode(input, 'escape');
    END;
END;
$$;

DO $$
DECLARE
    symbol_is_bytea boolean;
    strategy_is_bytea boolean;
    symbol_not_null boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'trades'
          AND column_name = 'symbol'
          AND data_type = 'bytea'
    ) INTO symbol_is_bytea;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'trades'
          AND column_name = 'strategy_tag'
          AND data_type = 'bytea'
    ) INTO strategy_is_bytea;

    IF symbol_is_bytea THEN
        SELECT (is_nullable = 'NO')
        FROM information_schema.columns
        WHERE table_name = 'trades'
          AND column_name = 'symbol'
        INTO symbol_not_null;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'trades'
              AND column_name = 'symbol_text'
        ) THEN
            ALTER TABLE trades ADD COLUMN symbol_text text;
        END IF;

        UPDATE trades
        SET symbol_text = safe_convert_from_utf8(symbol)
        WHERE symbol_text IS NULL;

        IF symbol_not_null THEN
            ALTER TABLE trades ALTER COLUMN symbol_text SET NOT NULL;
        END IF;

        ALTER TABLE trades DROP COLUMN symbol;
        ALTER TABLE trades RENAME COLUMN symbol_text TO symbol;
    END IF;

    IF strategy_is_bytea THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'trades'
              AND column_name = 'strategy_tag_text'
        ) THEN
            ALTER TABLE trades ADD COLUMN strategy_tag_text text;
        END IF;

        UPDATE trades
        SET strategy_tag_text = safe_convert_from_utf8(strategy_tag)
        WHERE strategy_tag_text IS NULL;

        ALTER TABLE trades DROP COLUMN strategy_tag;
        ALTER TABLE trades RENAME COLUMN strategy_tag_text TO strategy_tag;
    END IF;
END $$;

DROP FUNCTION IF EXISTS safe_convert_from_utf8(bytea);

CREATE INDEX IF NOT EXISTS idx_trades_user_symbol_lower ON trades (user_id, lower(symbol));
CREATE INDEX IF NOT EXISTS idx_trades_user_strategy_lower ON trades (user_id, lower(strategy_tag));
