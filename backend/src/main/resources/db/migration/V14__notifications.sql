ALTER TABLE content_post
    ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 0;

UPDATE content_post
SET content_version = 1
WHERE status = 'PUBLISHED'
  AND content_version = 0;

CREATE TYPE notification_event_type AS ENUM ('CONTENT_PUBLISHED', 'CONTENT_UPDATED');
CREATE TYPE notification_preference_mode AS ENUM ('ALL', 'SELECTED');
CREATE TYPE notification_match_policy AS ENUM ('CATEGORY_ONLY', 'CATEGORY_OR_TAGS_OR_SYMBOLS');

CREATE TABLE notification_event (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type notification_event_type NOT NULL,
    content_id UUID NOT NULL REFERENCES content_post(id) ON DELETE CASCADE,
    content_version INTEGER NOT NULL,
    category_id UUID NOT NULL REFERENCES content_type(id) ON DELETE RESTRICT,
    tags JSONB,
    symbols JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_at TIMESTAMP WITH TIME ZONE NOT NULL,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    payload_json JSONB
);

CREATE UNIQUE INDEX uk_notification_event_content_version
    ON notification_event (content_id, type, content_version);
CREATE INDEX idx_notification_event_pending
    ON notification_event (dispatched_at, effective_at);
CREATE INDEX idx_notification_event_content
    ON notification_event (content_id, created_at DESC);

CREATE TABLE user_notification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES notification_event(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX uk_user_notification_user_event
    ON user_notification (user_id, event_id);
CREATE INDEX idx_user_notification_user_created
    ON user_notification (user_id, created_at DESC);
CREATE INDEX idx_user_notification_unread
    ON user_notification (user_id, read_at, dismissed_at, created_at DESC);

CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_new BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_updates BOOLEAN NOT NULL DEFAULT TRUE,
    mode notification_preference_mode NOT NULL DEFAULT 'ALL',
    categories_json JSONB,
    tags_json JSONB,
    symbols_json JSONB,
    match_policy notification_match_policy NOT NULL DEFAULT 'CATEGORY_ONLY',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_preferences_enabled_mode
    ON notification_preferences (enabled, mode);

INSERT INTO notification_preferences (
    user_id,
    enabled,
    notify_on_new,
    notify_on_updates,
    mode,
    match_policy
)
SELECT u.id, TRUE, TRUE, TRUE, 'ALL', 'CATEGORY_ONLY'
FROM users u
ON CONFLICT (user_id) DO NOTHING;
