ALTER TABLE notebook_note
    ADD COLUMN IF NOT EXISTS related_session_id UUID REFERENCES today_sessions (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS related_setup_id UUID REFERENCES session_setups (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS related_plan_id UUID REFERENCES plans (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notebook_note_user_session
    ON notebook_note (user_id, related_session_id)
    WHERE related_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notebook_note_user_setup
    ON notebook_note (user_id, related_setup_id)
    WHERE related_setup_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notebook_note_user_plan
    ON notebook_note (user_id, related_plan_id)
    WHERE related_plan_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_notebook_note_live_setup_analysis
    ON notebook_note (user_id, related_session_id, related_setup_id, type)
    WHERE related_session_id IS NOT NULL
      AND related_setup_id IS NOT NULL
      AND is_deleted = FALSE
      AND type IN ('PLAN', 'SESSION_RECAP');
