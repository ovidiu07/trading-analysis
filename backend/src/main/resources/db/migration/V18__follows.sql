DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'follow_type'
          AND n.nspname = current_schema()
    ) THEN
        CREATE TYPE follow_type AS ENUM ('SYMBOL', 'TAG', 'STRATEGY');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS follows
(
    id          UUID PRIMARY KEY                  DEFAULT uuid_generate_v4(),
    user_id     UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    follow_type follow_type              NOT NULL,
    value       TEXT                     NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_follows_user_type_value UNIQUE (user_id, follow_type, value)
);

CREATE INDEX IF NOT EXISTS idx_follows_user
    ON follows (user_id);
