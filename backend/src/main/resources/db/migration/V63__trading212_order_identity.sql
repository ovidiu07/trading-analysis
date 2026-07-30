ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS external_trade_id VARCHAR(160);

UPDATE trades
SET external_trade_id = TRIM(external_order_id)
WHERE source = 'TRADING212_CSV'
  AND external_trade_id IS NULL
  AND NULLIF(TRIM(external_order_id), '') IS NOT NULL;

DO $$
DECLARE
    conflicts TEXT;
BEGIN
    SELECT STRING_AGG(
                   FORMAT(
                           'account=%s external_trade_id=%s trade_ids=%s',
                           account_id,
                           external_trade_id,
                           trade_ids
                   ),
                   E'\n'
           )
    INTO conflicts
    FROM (
        SELECT account_id,
               external_trade_id,
               STRING_AGG(id::TEXT, ',' ORDER BY created_at, id) AS trade_ids
        FROM trades
        WHERE source = 'TRADING212_CSV'
          AND account_id IS NOT NULL
          AND external_trade_id IS NOT NULL
        GROUP BY account_id, external_trade_id
        HAVING COUNT(*) > 1
    ) duplicates;

    IF conflicts IS NOT NULL THEN
        RAISE EXCEPTION USING
            MESSAGE = 'Trading 212 duplicate external identities must be resolved before V63 can continue',
            DETAIL = conflicts,
            HINT = 'Preserve the canonical trade and any user-authored journal data. Never merge rows merely because Position ID matches.';
    END IF;
END
$$;

DROP INDEX IF EXISTS uq_trading212_trade_external_position;

CREATE UNIQUE INDEX uq_trading212_trade_external_identity
    ON trades (account_id, source, external_trade_id)
    WHERE source = 'TRADING212_CSV'
      AND account_id IS NOT NULL
      AND external_trade_id IS NOT NULL;

-- Legacy imports without a recoverable Order ID retain their previous protection.
-- New imports always populate external_trade_id, using Order ID or a SHA-256 fallback.
CREATE UNIQUE INDEX uq_trading212_legacy_external_position
    ON trades (user_id, account_id, source, external_position_id)
    WHERE source = 'TRADING212_CSV'
      AND account_id IS NOT NULL
      AND external_trade_id IS NULL
      AND external_position_id IS NOT NULL;

CREATE INDEX idx_trading212_trades_external_identity_lookup
    ON trades (user_id, account_id, source, external_trade_id)
    WHERE source = 'TRADING212_CSV';

CREATE OR REPLACE VIEW trading212_external_identity_diagnostics AS
SELECT t.user_id,
       t.account_id,
       t.id AS trade_id,
       t.external_order_id,
       t.external_position_id,
       t.opened_at,
       t.closed_at,
       t.pnl_net,
       CASE
           WHEN t.external_trade_id IS NULL THEN 'MISSING_EXTERNAL_IDENTITY'
           ELSE 'OK'
       END AS diagnostic
FROM trades t
WHERE t.source = 'TRADING212_CSV';

COMMENT ON VIEW trading212_external_identity_diagnostics IS
    'Diagnostic inventory for legacy Trading 212 identities. Missing identities remain protected by the legacy Position ID index and are never deleted automatically.';

