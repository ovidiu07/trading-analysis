ALTER TABLE notebook_note
    ADD COLUMN IF NOT EXISTS review_json JSONB;
