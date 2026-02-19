DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'trade_grade'
          AND n.nspname = current_schema()
    ) THEN
        CREATE TYPE trade_grade AS ENUM ('A', 'B', 'C');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'trade_session'
          AND n.nspname = current_schema()
    ) THEN
        CREATE TYPE trade_session AS ENUM ('ASIA', 'LONDON', 'NY', 'CUSTOM');
    END IF;
END
$$;

ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS strategy_id UUID,
    ADD COLUMN IF NOT EXISTS setup_grade trade_grade,
    ADD COLUMN IF NOT EXISTS session trade_session;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = current_schema()
          AND table_name = 'trades'
          AND constraint_name = 'fk_trades_strategy_content'
    ) THEN
        ALTER TABLE trades
            ADD CONSTRAINT fk_trades_strategy_content
                FOREIGN KEY (strategy_id) REFERENCES content_post (id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS trade_content_links
(
    trade_id    UUID                     NOT NULL REFERENCES trades (id) ON DELETE CASCADE,
    content_id  UUID                     NOT NULL REFERENCES content_post (id) ON DELETE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trade_id, content_id)
);

CREATE TABLE IF NOT EXISTS trade_rule_breaks
(
    trade_id    UUID                     NOT NULL REFERENCES trades (id) ON DELETE CASCADE,
    rule_break  TEXT                     NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trade_id, rule_break)
);

CREATE INDEX IF NOT EXISTS idx_trades_strategy_id
    ON trades (strategy_id);

CREATE INDEX IF NOT EXISTS idx_trade_content_links_content
    ON trade_content_links (content_id);
