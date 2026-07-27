CREATE TABLE account_period_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    period_type VARCHAR(16) NOT NULL,
    period_key VARCHAR(16) NOT NULL,
    timezone VARCHAR(80) NOT NULL,
    target_type VARCHAR(40) NOT NULL DEFAULT 'FIXED_AMOUNT',
    target_value NUMERIC(20,4) NOT NULL DEFAULT 0,
    target_amount NUMERIC(20,4),
    max_loss_type VARCHAR(40) NOT NULL DEFAULT 'FIXED_AMOUNT',
    max_loss_value NUMERIC(20,4),
    max_loss_amount NUMERIC(20,4),
    max_trades INTEGER,
    max_risk_budget NUMERIC(20,4),
    max_consecutive_losses INTEGER,
    max_losing_days INTEGER,
    default_risk_per_trade NUMERIC(20,4),
    minimum_rr NUMERIC(12,4),
    stop_after_target BOOLEAN NOT NULL DEFAULT FALSE,
    reduce_risk_after_target BOOLEAN NOT NULL DEFAULT TRUE,
    risk_reduction_pct NUMERIC(9,4),
    stop_after_max_loss BOOLEAN NOT NULL DEFAULT TRUE,
    stop_after_consecutive_losses BOOLEAN NOT NULL DEFAULT TRUE,
    permitted_sessions VARCHAR(240),
    focus VARCHAR(240),
    notes TEXT,
    allocation_mode VARCHAR(24) NOT NULL DEFAULT 'MANUAL',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_account_period_plan UNIQUE (account_id, period_type, period_key),
    CONSTRAINT fk_account_period_plan_owner
        FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE CASCADE,
    CONSTRAINT chk_account_period_plan_type CHECK (period_type IN ('DAY', 'WEEK', 'MONTH')),
    CONSTRAINT chk_account_period_plan_target CHECK (target_value >= 0),
    CONSTRAINT chk_account_period_plan_loss CHECK (max_loss_value IS NULL OR max_loss_value >= 0),
    CONSTRAINT chk_account_period_plan_trades CHECK (max_trades IS NULL OR max_trades > 0)
);

CREATE TABLE account_period_plan_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES account_period_plans(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot_json JSONB NOT NULL,
    change_reason VARCHAR(240) NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_account_period_plan_revision_owner
        FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE CASCADE
);

INSERT INTO account_period_plans (
    user_id, account_id, period_type, period_key, timezone,
    target_type, target_value, target_amount, max_trades,
    default_risk_per_trade, minimum_rr, active, version, effective_from,
    created_at, updated_at
)
SELECT
    user_id,
    account_id,
    'MONTH',
    month_key,
    timezone,
    target_type,
    COALESCE(target_pct, target_amount, target_r, 0),
    target_amount,
    planned_max_trades_per_week,
    planned_risk_per_trade_pct,
    planned_minimum_rr,
    status = 'ACTIVE',
    1,
    COALESCE(snapshot_locked_at, created_at),
    created_at,
    updated_at
FROM monthly_growth_plans
ON CONFLICT (account_id, period_type, period_key) DO NOTHING;

ALTER TABLE account_ledger_events
    ADD COLUMN event_status VARCHAR(24) NOT NULL DEFAULT 'COMPLETED',
    ADD COLUMN metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN created_by UUID REFERENCES users(id),
    ADD COLUMN reversal_event_id UUID REFERENCES account_ledger_events(id),
    ADD COLUMN planning_behavior VARCHAR(32) NOT NULL DEFAULT 'PRESERVE_BASELINE';

CREATE INDEX idx_account_period_plans_lookup
    ON account_period_plans(user_id, account_id, period_type, period_key);
CREATE INDEX idx_account_period_plan_revisions_history
    ON account_period_plan_revisions(plan_id, version DESC);
CREATE INDEX idx_account_ledger_status_time
    ON account_ledger_events(account_id, event_status, event_time);

