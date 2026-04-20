WITH mnq_imports AS (
    SELECT t.id,
           CASE
               WHEN t.exit_price IS NULL THEN NULL
               WHEN t.direction::text = 'LONG' THEN ROUND((t.exit_price - t.entry_price) * t.quantity * 2, 4)
               ELSE ROUND((t.entry_price - t.exit_price) * t.quantity * 2, 4)
           END AS pnl_gross_recomputed,
           COALESCE(t.fees, 0) + COALESCE(t.commission, 0) + COALESCE(t.slippage, 0) AS total_costs,
           COALESCE(t.fx_rate_trade_to_profile, 1) AS fx_rate,
           t.capital_used,
           t.risk_amount
    FROM trades t
    WHERE t.market::text = 'FUTURES'
      AND COALESCE(t.contract_multiplier, 1) = 1
      AND regexp_replace(UPPER(t.symbol), '([FGHJKMNQUVXZ][0-9]{1,4})$', '') = 'MNQ'
      AND COALESCE(t.initial_notes, '') LIKE 'Imported from Tradovate Orders CSV%'
),
recomputed AS (
    SELECT id,
           pnl_gross_recomputed,
           CASE
               WHEN pnl_gross_recomputed IS NULL THEN NULL
               ELSE ROUND(pnl_gross_recomputed - total_costs, 4)
           END AS pnl_net_recomputed,
           CASE
               WHEN pnl_gross_recomputed IS NULL THEN NULL
               ELSE ROUND((pnl_gross_recomputed - total_costs) * fx_rate, 4)
           END AS pnl_profile_currency_recomputed,
           CASE
               WHEN pnl_gross_recomputed IS NULL OR capital_used IS NULL OR capital_used = 0 THEN NULL
               ELSE ROUND(((pnl_gross_recomputed - total_costs) / capital_used) * 100, 4)
           END AS pnl_percent_recomputed,
           CASE
               WHEN pnl_gross_recomputed IS NULL OR risk_amount IS NULL OR risk_amount = 0 THEN NULL
               ELSE ROUND((pnl_gross_recomputed - total_costs) / risk_amount, 4)
           END AS r_multiple_recomputed
    FROM mnq_imports
)
UPDATE trades t
SET contract_multiplier = 2,
    pnl_gross = r.pnl_gross_recomputed,
    pnl_net = r.pnl_net_recomputed,
    pnl_profile_currency = r.pnl_profile_currency_recomputed,
    pnl_percent = r.pnl_percent_recomputed,
    r_multiple = r.r_multiple_recomputed
FROM recomputed r
WHERE t.id = r.id;
