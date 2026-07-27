ALTER TABLE account_period_plans
    ADD COLUMN max_consecutive_losing_days INTEGER,
    ADD COLUMN minimum_review_days INTEGER,
    ADD COLUMN risk_reduction_type VARCHAR(24) NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN risk_reduction_value NUMERIC(20,4),
    ADD COLUMN risk_reduction_after_drawdown_pct NUMERIC(9,4),
    ADD COLUMN maximum_drawdown_tolerance NUMERIC(20,4),
    ADD COLUMN planned_trading_days INTEGER,
    ADD COLUMN withdrawal_policy VARCHAR(240),
    ADD COLUMN compounding_behavior VARCHAR(40);

ALTER TABLE account_period_plans
    ADD CONSTRAINT chk_account_period_plan_review_days
        CHECK (minimum_review_days IS NULL OR minimum_review_days >= 0),
    ADD CONSTRAINT chk_account_period_plan_trading_days
        CHECK (planned_trading_days IS NULL OR planned_trading_days > 0),
    ADD CONSTRAINT chk_account_period_plan_risk_reduction_type
        CHECK (risk_reduction_type IN ('FIXED_AMOUNT', 'PERCENTAGE'));
