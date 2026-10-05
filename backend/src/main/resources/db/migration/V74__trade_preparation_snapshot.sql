ALTER TABLE trades ADD COLUMN preparation_snapshot jsonb;
COMMENT ON COLUMN trades.preparation_snapshot IS 'Immutable trader preparation and execution configuration captured when the trade is logged; null for legacy trades.';
