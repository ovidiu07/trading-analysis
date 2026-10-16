-- Extend the canonical strategy and version records. No historical trade is rewritten.
ALTER TABLE user_strategies ADD COLUMN revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE user_strategies ADD COLUMN studio_json JSONB;
ALTER TABLE user_strategies ADD CONSTRAINT chk_strategy_studio_object
    CHECK (studio_json IS NULL OR studio_json = 'null'::jsonb OR jsonb_typeof(studio_json) = 'object');
ALTER TABLE strategy_versions ADD COLUMN name VARCHAR(120);
ALTER TABLE strategy_versions ADD COLUMN change_description TEXT;

CREATE TABLE strategy_checklist_executions (
    id UUID PRIMARY KEY,
    strategy_id UUID NOT NULL REFERENCES user_strategies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_version_id UUID REFERENCES strategy_versions(id),
    snapshot_json JSONB NOT NULL,
    answers_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_strategy_checklist_executions_owner
    ON strategy_checklist_executions(strategy_id, user_id, created_at DESC);

-- Replay research trades already have strategy_id. Reuse that relationship and add
-- only the missing optional checkpoint and sample annotation.
ALTER TABLE backtesting_trades ADD COLUMN strategy_version_id UUID REFERENCES strategy_versions(id);
ALTER TABLE backtesting_trades ADD COLUMN research_sample VARCHAR(16)
    CHECK (research_sample IS NULL OR research_sample IN ('IN_SAMPLE', 'OUT_OF_SAMPLE'));
CREATE INDEX idx_backtesting_strategy_version ON backtesting_trades(strategy_version_id);
CREATE INDEX idx_backtesting_strategy_owner ON backtesting_trades(user_id, strategy_id);
