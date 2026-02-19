DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'trade_session'
          AND n.nspname = current_schema()
          AND e.enumlabel = 'NY_AM'
    ) THEN
        ALTER TYPE trade_session ADD VALUE 'NY_AM';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'trade_session'
          AND n.nspname = current_schema()
          AND e.enumlabel = 'NY_PM'
    ) THEN
        ALTER TYPE trade_session ADD VALUE 'NY_PM';
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS checklist_templates
(
    id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       VARCHAR(120)             NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_checklist_templates_name_nonblank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_user
    ON checklist_templates (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS checklist_template_entries
(
    id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID                    NOT NULL REFERENCES checklist_templates (id) ON DELETE CASCADE,
    item_text  VARCHAR(160)             NOT NULL,
    sort_order INTEGER                  NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_checklist_template_entries_text_nonblank CHECK (length(trim(item_text)) > 0),
    CONSTRAINT chk_checklist_template_entries_sort_order_non_negative CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_checklist_template_entries_template_sort
    ON checklist_template_entries (template_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS today_sessions
(
    id                   UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    session_date         DATE                     NOT NULL,
    profit_target        NUMERIC(18, 4)           NOT NULL,
    loss_limit           NUMERIC(18, 4)           NOT NULL,
    max_trades           INTEGER                  NOT NULL,
    status               VARCHAR(24)              NOT NULL DEFAULT 'ACTIVE',
    planned_tickers      TEXT,
    checklist_state      TEXT,
    checklist_template_id UUID                    REFERENCES checklist_templates (id) ON DELETE SET NULL,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_today_sessions_max_trades_positive CHECK (max_trades > 0),
    CONSTRAINT chk_today_sessions_profit_target_non_negative CHECK (profit_target >= 0),
    CONSTRAINT chk_today_sessions_loss_limit_non_negative CHECK (loss_limit >= 0),
    CONSTRAINT chk_today_sessions_status CHECK (status IN ('ACTIVE', 'COMPLETED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_today_sessions_user_date
    ON today_sessions (user_id, session_date);

CREATE INDEX IF NOT EXISTS idx_today_sessions_user_status
    ON today_sessions (user_id, status, session_date);

CREATE TABLE IF NOT EXISTS user_strategies
(
    id                  UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name                VARCHAR(120)             NOT NULL,
    model               VARCHAR(255)             NOT NULL,
    entry_conditions    TEXT                     NOT NULL,
    invalidation_logic  TEXT                     NOT NULL,
    tp_framework        TEXT                     NOT NULL,
    no_trade_rules      TEXT,
    session_suitability TEXT,
    tags                TEXT,
    archived            BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_strategies_name_nonblank CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_user_strategies_model_nonblank CHECK (length(trim(model)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_user_strategies_user_archived
    ON user_strategies (user_id, archived, updated_at DESC);

ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES today_sessions (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS feeling VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_trades_session_id
    ON trades (session_id);
