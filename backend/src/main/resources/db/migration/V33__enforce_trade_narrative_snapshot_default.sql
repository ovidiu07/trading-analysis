UPDATE trades
SET narrative_snapshot_json = '{}'::jsonb
WHERE narrative_snapshot_json IS NULL;

ALTER TABLE trades
    ALTER COLUMN narrative_snapshot_json SET DEFAULT '{}'::jsonb;

ALTER TABLE trades
    ALTER COLUMN narrative_snapshot_json SET NOT NULL;
