ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS removed_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE today_sessions
    ADD COLUMN IF NOT EXISTS plan_removed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS plan_removed_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_plans_active_not_removed
    ON plans (source, scope, author_user_id, active_from, active_to)
    WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_today_sessions_active_plan_user_date
    ON today_sessions (user_id, session_date)
    WHERE plan_removed_at IS NULL;
