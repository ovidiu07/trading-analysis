CREATE TYPE notebook_note_type AS ENUM ('DAILY_LOG','TRADE_NOTE','PLAN','GOAL','SESSION_RECAP','NOTE');
CREATE TYPE notebook_tag_entity_type AS ENUM ('NOTE');

CREATE TABLE notebook_folder (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES notebook_folder(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    system_key VARCHAR(60),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ux_notebook_folder_system_key ON notebook_folder(user_id, system_key)
    WHERE system_key IS NOT NULL;
CREATE INDEX idx_notebook_folder_user_parent ON notebook_folder(user_id, parent_id);

CREATE TABLE notebook_note (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notebook_note_type NOT NULL,
    folder_id UUID REFERENCES notebook_folder(id) ON DELETE SET NULL,
    title VARCHAR(255),
    body TEXT,
    body_json JSONB,
    date_key DATE,
    related_trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notebook_note_user_type_date ON notebook_note(user_id, type, date_key);
CREATE INDEX idx_notebook_note_user_folder_updated ON notebook_note(user_id, folder_id, updated_at);
CREATE INDEX idx_notebook_note_user_trade ON notebook_note(user_id, related_trade_id);

CREATE TABLE notebook_tag (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    color VARCHAR(40),
    UNIQUE (user_id, name)
);

CREATE TABLE notebook_tag_link (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES notebook_tag(id) ON DELETE CASCADE,
    entity_type notebook_tag_entity_type NOT NULL,
    entity_id UUID NOT NULL REFERENCES notebook_note(id) ON DELETE CASCADE
);

CREATE INDEX idx_notebook_tag_link_user_tag ON notebook_tag_link(user_id, tag_id);
CREATE INDEX idx_notebook_tag_link_user_entity ON notebook_tag_link(user_id, entity_id);

CREATE TABLE notebook_attachment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES notebook_note(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120),
    size_bytes BIGINT,
    storage_key VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notebook_attachment_user_note ON notebook_attachment(user_id, note_id);

CREATE TABLE notebook_template (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    applies_to_type notebook_note_type,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notebook_template_user_type ON notebook_template(user_id, applies_to_type);
