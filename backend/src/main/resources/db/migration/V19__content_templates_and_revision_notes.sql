ALTER TABLE content_post
    ADD COLUMN IF NOT EXISTS template_fields JSONB;

ALTER TABLE content_post
    ADD COLUMN IF NOT EXISTS revision_notes TEXT;

UPDATE content_post
SET template_fields = '{}'::jsonb
WHERE template_fields IS NULL;

ALTER TABLE content_post
    ALTER COLUMN template_fields SET DEFAULT '{}'::jsonb;

ALTER TABLE content_post
    ALTER COLUMN template_fields SET NOT NULL;
