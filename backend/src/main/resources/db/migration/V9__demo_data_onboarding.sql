ALTER TABLE users
    ADD COLUMN IF NOT EXISTS demo_enabled BOOLEAN,
    ADD COLUMN IF NOT EXISTS demo_seed_id UUID,
    ADD COLUMN IF NOT EXISTS demo_removed_at TIMESTAMPTZ;

UPDATE users
SET demo_enabled = FALSE
WHERE demo_enabled IS NULL;

ALTER TABLE users
    ALTER COLUMN demo_enabled SET NOT NULL,
    ALTER COLUMN demo_enabled SET DEFAULT TRUE;

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS demo_seed_id UUID;

ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS demo_seed_id UUID;

ALTER TABLE tags
    ADD COLUMN IF NOT EXISTS demo_seed_id UUID;

ALTER TABLE notebook_folder
    ADD COLUMN IF NOT EXISTS demo_seed_id UUID;

ALTER TABLE notebook_note
    ADD COLUMN IF NOT EXISTS demo_seed_id UUID;

ALTER TABLE notebook_tag
    ADD COLUMN IF NOT EXISTS demo_seed_id UUID;

ALTER TABLE notebook_tag_link
    ADD COLUMN IF NOT EXISTS demo_seed_id UUID;

ALTER TABLE notebook_attachment
    ADD COLUMN IF NOT EXISTS demo_seed_id UUID;

ALTER TABLE notebook_template
    ADD COLUMN IF NOT EXISTS demo_seed_id UUID;

CREATE INDEX IF NOT EXISTS idx_users_demo_seed_id ON users(demo_seed_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_demo_seed_id ON accounts(user_id, demo_seed_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_demo_seed_id ON trades(user_id, demo_seed_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_demo_seed_id ON tags(user_id, demo_seed_id);
CREATE INDEX IF NOT EXISTS idx_notebook_folder_user_demo_seed_id ON notebook_folder(user_id, demo_seed_id);
CREATE INDEX IF NOT EXISTS idx_notebook_note_user_demo_seed_id ON notebook_note(user_id, demo_seed_id);
CREATE INDEX IF NOT EXISTS idx_notebook_tag_user_demo_seed_id ON notebook_tag(user_id, demo_seed_id);
CREATE INDEX IF NOT EXISTS idx_notebook_tag_link_user_demo_seed_id ON notebook_tag_link(user_id, demo_seed_id);
CREATE INDEX IF NOT EXISTS idx_notebook_attachment_user_demo_seed_id ON notebook_attachment(user_id, demo_seed_id);
CREATE INDEX IF NOT EXISTS idx_notebook_template_user_demo_seed_id ON notebook_template(user_id, demo_seed_id);
