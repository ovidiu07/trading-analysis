CREATE TYPE asset_scope AS ENUM ('CONTENT', 'NOTEBOOK');

CREATE TABLE asset (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    scope asset_scope NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(160) NOT NULL,
    size_bytes BIGINT NOT NULL,
    s3_key VARCHAR(900) NOT NULL UNIQUE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    demo_seed_id UUID
);

CREATE INDEX idx_asset_scope_created ON asset(scope, created_at DESC);
CREATE INDEX idx_asset_owner_scope ON asset(owner_user_id, scope);

CREATE TABLE content_asset (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES content_post(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES asset(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_content_asset UNIQUE (content_id, asset_id)
);

CREATE INDEX idx_content_asset_content_sort ON content_asset(content_id, sort_order, created_at);
CREATE INDEX idx_content_asset_asset ON content_asset(asset_id);

ALTER TABLE notebook_attachment
    ADD COLUMN IF NOT EXISTS asset_id UUID,
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

INSERT INTO asset (id, owner_user_id, scope, original_file_name, content_type, size_bytes, s3_key, created_at, demo_seed_id)
SELECT na.id,
       na.user_id,
       'NOTEBOOK'::asset_scope,
       COALESCE(NULLIF(na.file_name, ''), 'attachment'),
       COALESCE(NULLIF(na.mime_type, ''), 'application/octet-stream'),
       COALESCE(na.size_bytes, 0),
       COALESCE(NULLIF(na.storage_key, ''), CONCAT('legacy/notebook/', na.id::text)),
       COALESCE(na.created_at, CURRENT_TIMESTAMP),
       na.demo_seed_id
FROM notebook_attachment na
ON CONFLICT (id) DO NOTHING;

UPDATE notebook_attachment na
SET asset_id = na.id
WHERE na.asset_id IS NULL;

ALTER TABLE notebook_attachment
    ADD CONSTRAINT fk_notebook_attachment_asset
    FOREIGN KEY (asset_id) REFERENCES asset(id) ON DELETE CASCADE;

CREATE INDEX idx_notebook_attachment_note_sort ON notebook_attachment(note_id, sort_order, created_at);
CREATE INDEX idx_notebook_attachment_asset ON notebook_attachment(asset_id);

ALTER TABLE notebook_attachment
    ALTER COLUMN asset_id SET NOT NULL;

ALTER TABLE notebook_attachment
    DROP COLUMN IF EXISTS file_name,
    DROP COLUMN IF EXISTS mime_type,
    DROP COLUMN IF EXISTS size_bytes,
    DROP COLUMN IF EXISTS storage_key;
