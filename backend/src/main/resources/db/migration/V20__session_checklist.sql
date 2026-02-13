CREATE TABLE checklist_template_state (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    initialized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE checklist_template_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text VARCHAR(160) NOT NULL,
    sort_order INTEGER NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_checklist_template_items_text_nonblank CHECK (length(trim(text)) > 0),
    CONSTRAINT chk_checklist_template_items_sort_order_non_negative CHECK (sort_order >= 0)
);

CREATE INDEX idx_checklist_template_items_user_sort_order
    ON checklist_template_items (user_id, sort_order, created_at);

CREATE INDEX idx_checklist_template_items_user_enabled
    ON checklist_template_items (user_id, is_enabled, sort_order);

CREATE TABLE checklist_item_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES checklist_template_items(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uk_checklist_item_completions_user_item_date
    ON checklist_item_completions (user_id, checklist_item_id, date);

CREATE INDEX idx_checklist_item_completions_user_date
    ON checklist_item_completions (user_id, date);
