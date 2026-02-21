ALTER TABLE checklist_templates
    ADD COLUMN IF NOT EXISTS type VARCHAR(24) NOT NULL DEFAULT 'PREREQS',
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE checklist_template_entries
    ADD COLUMN IF NOT EXISTS has_note BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS note_placeholder VARCHAR(160),
    ADD COLUMN IF NOT EXISTS has_value BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS value_label VARCHAR(80),
    ADD COLUMN IF NOT EXISTS value_type VARCHAR(16) NOT NULL DEFAULT 'TEXT',
    ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS default_checked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE checklist_templates
    ADD CONSTRAINT chk_checklist_templates_type
        CHECK (type IN ('PREREQS', 'TRIGGERS'));

ALTER TABLE checklist_template_entries
    ADD CONSTRAINT chk_checklist_template_entries_value_type
        CHECK (value_type IN ('TEXT', 'NUMBER', 'TIME'));

CREATE INDEX IF NOT EXISTS idx_checklist_templates_user_type
    ON checklist_templates (user_id, type, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uk_checklist_templates_default_per_type
    ON checklist_templates (user_id, type)
    WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS session_levels
(
    id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    today_session_id UUID                     NOT NULL REFERENCES today_sessions (id) ON DELETE CASCADE,
    user_id          UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    label            VARCHAR(64)              NOT NULL,
    price            NUMERIC(18, 8),
    category         VARCHAR(24)              NOT NULL DEFAULT 'OTHER',
    notes            VARCHAR(280),
    swept_at         TIMESTAMP WITH TIME ZONE,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_session_levels_label_nonblank CHECK (length(trim(label)) > 0),
    CONSTRAINT chk_session_levels_category CHECK (category IN ('LIQUIDITY', 'TARGET', 'INVALIDATION', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_session_levels_session_created
    ON session_levels (today_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_session_levels_user_session
    ON session_levels (user_id, today_session_id);

ALTER TABLE today_sessions
    ADD COLUMN IF NOT EXISTS prereqs_state TEXT,
    ADD COLUMN IF NOT EXISTS triggers_state TEXT,
    ADD COLUMN IF NOT EXISTS prereqs_template_id UUID REFERENCES checklist_templates (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS triggers_template_id UUID REFERENCES checklist_templates (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS active_sweep_level_id UUID REFERENCES session_levels (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS lock_in_session VARCHAR(24),
    ADD COLUMN IF NOT EXISTS lock_in_objective VARCHAR(32),
    ADD COLUMN IF NOT EXISTS lock_in_bias VARCHAR(16),
    ADD COLUMN IF NOT EXISTS lock_in_bias_reason VARCHAR(140),
    ADD COLUMN IF NOT EXISTS lock_in_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE today_sessions
    ADD CONSTRAINT chk_today_sessions_lock_in_bias
        CHECK (lock_in_bias IS NULL OR lock_in_bias IN ('LONG', 'SHORT', 'NEUTRAL'));

UPDATE today_sessions
SET prereqs_state = checklist_state
WHERE prereqs_state IS NULL
  AND checklist_state IS NOT NULL;

UPDATE today_sessions
SET prereqs_template_id = checklist_template_id
WHERE prereqs_template_id IS NULL
  AND checklist_template_id IS NOT NULL;
