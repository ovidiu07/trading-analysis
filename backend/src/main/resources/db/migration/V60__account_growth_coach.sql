CREATE TABLE account_growth_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    account_type VARCHAR(40) NOT NULL DEFAULT 'OTHER',
    initial_capital NUMERIC(20,4),
    capital_source VARCHAR(32) NOT NULL DEFAULT 'ACCOUNT_DEFAULT',
    default_risk_per_trade_pct NUMERIC(9,4) NOT NULL DEFAULT 0.5000,
    preferred_max_risk_per_trade_pct NUMERIC(9,4) NOT NULL DEFAULT 1.0000,
    max_concurrent_risk_pct NUMERIC(9,4) NOT NULL DEFAULT 2.0000,
    max_daily_risk_pct NUMERIC(9,4),
    max_daily_loss_amount NUMERIC(20,4),
    max_total_drawdown_pct NUMERIC(9,4),
    max_total_drawdown_amount NUMERIC(20,4),
    drawdown_type VARCHAR(32) NOT NULL DEFAULT 'NONE',
    monthly_target_pct NUMERIC(9,4) NOT NULL DEFAULT 3.0000,
    compounds_monthly BOOLEAN NOT NULL DEFAULT FALSE,
    profit_target_pct NUMERIC(9,4),
    profit_target_amount NUMERIC(20,4),
    minimum_trading_days INTEGER,
    challenge_deadline DATE,
    consistency_rule_type VARCHAR(40),
    consistency_rule_value NUMERIC(20,4),
    trailing_drawdown_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    trailing_drawdown_type VARCHAR(40),
    trailing_drawdown_amount NUMERIC(20,4),
    trailing_drawdown_high_water_mark NUMERIC(20,4),
    contract_limit INTEGER,
    scaling_restrictions TEXT,
    profit_split_pct NUMERIC(9,4),
    payout_threshold NUMERIC(20,4),
    payout_frequency VARCHAR(80),
    payout_eligibility_rules TEXT,
    reset_details TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_growth_profile_account UNIQUE (account_id),
    CONSTRAINT fk_growth_profile_account_owner
        FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE CASCADE,
    CONSTRAINT chk_growth_profile_capital CHECK (initial_capital IS NULL OR initial_capital >= 0),
    CONSTRAINT chk_growth_profile_risk CHECK (
        default_risk_per_trade_pct >= 0
        AND preferred_max_risk_per_trade_pct >= 0
        AND max_concurrent_risk_pct >= 0
    )
);

CREATE TABLE monthly_growth_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    month_key VARCHAR(7) NOT NULL,
    timezone VARCHAR(80) NOT NULL,
    month_start_balance NUMERIC(20,4),
    month_start_equity NUMERIC(20,4),
    target_type VARCHAR(40) NOT NULL DEFAULT 'PERCENTAGE',
    target_basis VARCHAR(40) NOT NULL DEFAULT 'MONTH_START_BALANCE',
    target_pct NUMERIC(9,4),
    target_amount NUMERIC(20,4),
    target_r NUMERIC(20,4),
    planned_risk_per_trade_pct NUMERIC(9,4),
    hard_max_risk_per_trade_pct NUMERIC(9,4),
    planned_max_trades_per_day INTEGER,
    planned_max_trades_per_week INTEGER,
    planned_minimum_rr NUMERIC(12,4),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    snapshot_source VARCHAR(32) NOT NULL DEFAULT 'RECONSTRUCTED',
    snapshot_locked_at TIMESTAMP WITH TIME ZONE,
    snapshot_adjustment_amount NUMERIC(20,4),
    snapshot_adjustment_note TEXT,
    target_changed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_monthly_growth_plan UNIQUE (account_id, month_key),
    CONSTRAINT fk_monthly_growth_plan_account_owner
        FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE CASCADE,
    CONSTRAINT chk_month_key CHECK (month_key ~ '^[0-9]{4}-[0-9]{2}$')
);

CREATE TABLE monthly_growth_plan_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES monthly_growth_plans(id) ON DELETE CASCADE,
    previous_target_type VARCHAR(40),
    previous_target_pct NUMERIC(9,4),
    previous_target_amount NUMERIC(20,4),
    previous_target_r NUMERIC(20,4),
    new_target_type VARCHAR(40),
    new_target_pct NUMERIC(9,4),
    new_target_amount NUMERIC(20,4),
    new_target_r NUMERIC(20,4),
    reason VARCHAR(240),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_growth_plan_revision_account_owner
        FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE CASCADE
);

CREATE TABLE account_ledger_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    amount NUMERIC(20,4) NOT NULL,
    currency VARCHAR(16) NOT NULL,
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    description VARCHAR(240),
    external_reference VARCHAR(160),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_account_ledger_event_account_owner
        FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE CASCADE,
    CONSTRAINT chk_account_ledger_non_zero CHECK (amount <> 0)
);

CREATE INDEX idx_growth_profiles_user_account
    ON account_growth_profiles(user_id, account_id);
CREATE INDEX idx_growth_plans_user_account_month
    ON monthly_growth_plans(user_id, account_id, month_key);
CREATE INDEX idx_growth_plan_revisions_account_changed
    ON monthly_growth_plan_revisions(account_id, changed_at DESC);
CREATE INDEX idx_account_ledger_user_account_time
    ON account_ledger_events(user_id, account_id, event_time);
CREATE INDEX idx_trades_user_account_status
    ON trades(user_id, account_id, status);
CREATE INDEX idx_trades_account_updated_at
    ON trades(account_id, updated_at);
