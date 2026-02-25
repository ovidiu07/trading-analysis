-- CSV source ids are internal UUIDs. Keep them lowercase so dataset metadata and chunk storage
-- resolve to the same key across imports and range queries.
UPDATE backtest_datasets d
SET source_id = lower(d.source_id)
WHERE d.provider = 'CSV'
  AND d.source_id ~* '^[0-9a-f-]{36}$'
  AND d.source_id <> lower(d.source_id)
  AND NOT EXISTS (
      SELECT 1
      FROM backtest_datasets x
      WHERE x.id <> d.id
        AND x.user_id = d.user_id
        AND x.provider = d.provider
        AND x.symbol_canonical = d.symbol_canonical
        AND x.timeframe = d.timeframe
        AND x.source_id = lower(d.source_id)
  );

UPDATE candle_chunks c
SET source_id = lower(c.source_id)
WHERE c.provider = 'CSV'
  AND c.source_id ~* '^[0-9a-f-]{36}$'
  AND c.source_id <> lower(c.source_id)
  AND NOT EXISTS (
      SELECT 1
      FROM candle_chunks x
      WHERE x.id <> c.id
        AND COALESCE(x.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE(c.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND x.provider = c.provider
        AND x.symbol_canonical = c.symbol_canonical
        AND x.timeframe = c.timeframe
        AND x.chunk_start_utc = c.chunk_start_utc
        AND x.source_id = lower(c.source_id)
  );

UPDATE backtest_runs r
SET source_id = lower(r.source_id)
WHERE r.provider = 'CSV'
  AND r.source_id IS NOT NULL
  AND r.source_id ~* '^[0-9a-f-]{36}$'
  AND r.source_id <> lower(r.source_id);
