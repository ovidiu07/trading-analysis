DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'asset_scope'
          AND n.nspname = current_schema()
          AND e.enumlabel = 'PLAN'
    ) THEN
        ALTER TYPE asset_scope ADD VALUE 'PLAN';
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS plan_asset
(
    id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id          UUID                     REFERENCES plans (id) ON DELETE CASCADE,
    today_session_id UUID                     REFERENCES today_sessions (id) ON DELETE CASCADE,
    user_id          UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    plan_scope       planscope                NOT NULL,
    asset_id         UUID                     NOT NULL REFERENCES asset (id) ON DELETE CASCADE,
    sort_order       INTEGER                  NOT NULL DEFAULT 0,
    caption          VARCHAR(240),
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_plan_asset_target CHECK (
        (plan_id IS NOT NULL AND today_session_id IS NULL AND plan_scope IN ('WEEKLY', 'MONTHLY'))
        OR
        (plan_id IS NULL AND today_session_id IS NOT NULL AND plan_scope = 'DAILY')
    ),
    CONSTRAINT uk_plan_asset_plan UNIQUE (plan_id, asset_id),
    CONSTRAINT uk_plan_asset_today_session UNIQUE (today_session_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_asset_plan_sort
    ON plan_asset (plan_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_plan_asset_today_session_sort
    ON plan_asset (today_session_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_plan_asset_user_scope_created
    ON plan_asset (user_id, plan_scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_asset_asset
    ON plan_asset (asset_id);
