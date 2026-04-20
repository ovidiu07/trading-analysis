DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = current_schema()
          AND table_name = 'trades'
          AND constraint_name = 'fk_trades_strategy_content'
    ) THEN
        UPDATE trades t
        SET strategy_tag = cpt.title
        FROM content_post cp
        JOIN LATERAL (
            SELECT translation.title
            FROM content_post_translation translation
            WHERE translation.content_post_id = cp.id
            ORDER BY CASE WHEN translation.locale = 'en' THEN 0 ELSE 1 END,
                     translation.created_at ASC,
                     translation.id ASC
            LIMIT 1
        ) cpt ON TRUE
        WHERE t.strategy_id = cp.id
          AND (t.strategy_tag IS NULL OR btrim(t.strategy_tag) = '');

        ALTER TABLE trades
            DROP CONSTRAINT fk_trades_strategy_content;
    END IF;
END
$$;

UPDATE trades t
SET strategy_id = NULL
WHERE t.strategy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_strategies us
    WHERE us.id = t.strategy_id
  );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = current_schema()
          AND table_name = 'trades'
          AND constraint_name = 'fk_trades_strategy_user_strategy'
    ) THEN
        ALTER TABLE trades
            ADD CONSTRAINT fk_trades_strategy_user_strategy
                FOREIGN KEY (strategy_id) REFERENCES user_strategies (id) ON DELETE SET NULL;
    END IF;
END
$$;

UPDATE trades
SET risk_percent = CASE
        WHEN risk_amount IS NOT NULL
            AND capital_used IS NOT NULL
            AND capital_used <> 0
            THEN ROUND((risk_amount / capital_used) * 100, 4)
        ELSE NULL
    END,
    pnl_percent = CASE
        WHEN pnl_net IS NOT NULL
            AND capital_used IS NOT NULL
            AND capital_used <> 0
            THEN ROUND((pnl_net / capital_used) * 100, 4)
        ELSE NULL
    END,
    r_multiple = CASE
        WHEN pnl_net IS NOT NULL
            AND risk_amount IS NOT NULL
            AND risk_amount <> 0
            THEN ROUND(pnl_net / risk_amount, 4)
        ELSE NULL
    END;
