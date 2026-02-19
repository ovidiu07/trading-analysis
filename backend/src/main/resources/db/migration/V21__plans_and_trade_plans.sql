DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'plan_scope'
          AND n.nspname = current_schema()
    ) THEN
        CREATE TYPE plan_scope AS ENUM ('DAILY', 'WEEKLY');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'plan_source'
          AND n.nspname = current_schema()
    ) THEN
        CREATE TYPE plan_source AS ENUM ('MENTOR', 'USER');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS plans
(
    id                  UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope               plan_scope               NOT NULL,
    source              plan_source              NOT NULL,
    author_user_id      UUID                     REFERENCES users (id) ON DELETE SET NULL,
    author_display_name VARCHAR(255),
    title               VARCHAR(255)             NOT NULL,
    content             TEXT                     NOT NULL,
    checklist_json      TEXT,
    active_from         TIMESTAMP WITH TIME ZONE NOT NULL,
    active_to           TIMESTAMP WITH TIME ZONE NOT NULL,
    featured            BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plans_source_scope_active
    ON plans (source, scope, active_from, active_to);

CREATE INDEX IF NOT EXISTS idx_plans_author_user
    ON plans (author_user_id);

CREATE TABLE IF NOT EXISTS trade_plans
(
    trade_id   UUID                     NOT NULL REFERENCES trades (id) ON DELETE CASCADE,
    plan_id    UUID                     NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
    linked_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (trade_id, plan_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_plans_plan_id
    ON trade_plans (plan_id);
