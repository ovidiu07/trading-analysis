CREATE TABLE content_type (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(120) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_type_translation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type_id UUID NOT NULL REFERENCES content_type(id) ON DELETE CASCADE,
    locale VARCHAR(20) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_content_type_translation UNIQUE (content_type_id, locale)
);

CREATE INDEX idx_content_type_translation_locale ON content_type_translation(locale);
CREATE INDEX idx_content_type_translation_type ON content_type_translation(content_type_id);

CREATE TABLE content_post_translation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_post_id UUID NOT NULL REFERENCES content_post(id) ON DELETE CASCADE,
    locale VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    body_markdown TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_content_post_translation UNIQUE (content_post_id, locale)
);

CREATE INDEX idx_content_post_translation_locale ON content_post_translation(locale);
CREATE INDEX idx_content_post_translation_post ON content_post_translation(content_post_id);

ALTER TABLE content_post
    ADD COLUMN IF NOT EXISTS content_type_id UUID;

INSERT INTO content_type (key, sort_order, active)
VALUES
    ('STRATEGY', 10, TRUE),
    ('WEEKLY_PLAN', 20, TRUE),
    ('DAILY_PLAN', 30, TRUE),
    ('PLAYBOOK', 40, TRUE),
    ('CHECKLIST', 50, TRUE),
    ('EDUCATION', 60, TRUE),
    ('MARKET_RECAP', 70, TRUE),
    ('RISK_MANAGEMENT', 80, TRUE),
    ('PSYCHOLOGY', 90, TRUE)
ON CONFLICT (key)
DO UPDATE SET sort_order = EXCLUDED.sort_order;

WITH seed(key, locale, display_name, description) AS (
    VALUES
        ('STRATEGY', 'en', 'Strategy', NULL),
        ('STRATEGY', 'ro', 'Strategie', NULL),
        ('WEEKLY_PLAN', 'en', 'Weekly plan', NULL),
        ('WEEKLY_PLAN', 'ro', 'Plan săptămânal', NULL),
        ('DAILY_PLAN', 'en', 'Daily plan', NULL),
        ('DAILY_PLAN', 'ro', 'Plan zilnic', NULL),
        ('PLAYBOOK', 'en', 'Playbook', NULL),
        ('PLAYBOOK', 'ro', 'Ghid (Playbook)', NULL),
        ('CHECKLIST', 'en', 'Checklist', NULL),
        ('CHECKLIST', 'ro', 'Listă de verificare', NULL),
        ('EDUCATION', 'en', 'Education', NULL),
        ('EDUCATION', 'ro', 'Educație', NULL),
        ('MARKET_RECAP', 'en', 'Market recap', NULL),
        ('MARKET_RECAP', 'ro', 'Recap piață', NULL),
        ('RISK_MANAGEMENT', 'en', 'Risk management', NULL),
        ('RISK_MANAGEMENT', 'ro', 'Managementul riscului', NULL),
        ('PSYCHOLOGY', 'en', 'Psychology', NULL),
        ('PSYCHOLOGY', 'ro', 'Psihologie', NULL)
)
INSERT INTO content_type_translation (content_type_id, locale, display_name, description)
SELECT ct.id, seed.locale, seed.display_name, seed.description
FROM seed
JOIN content_type ct ON ct.key = seed.key
ON CONFLICT (content_type_id, locale)
DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

UPDATE content_post p
SET content_type_id = ct.id
FROM content_type ct
WHERE ct.key = p.type::text;

INSERT INTO content_post_translation (content_post_id, locale, title, summary, body_markdown)
SELECT p.id, 'en', p.title, p.summary, p.body
FROM content_post p
ON CONFLICT (content_post_id, locale)
DO NOTHING;

ALTER TABLE content_post
    ALTER COLUMN content_type_id SET NOT NULL;

ALTER TABLE content_post
    ADD CONSTRAINT fk_content_post_content_type
    FOREIGN KEY (content_type_id) REFERENCES content_type(id) ON DELETE RESTRICT;

DROP INDEX IF EXISTS idx_content_post_type_status;
CREATE INDEX idx_content_post_content_type_status ON content_post(content_type_id, status);

ALTER TABLE content_post
    DROP COLUMN IF EXISTS type,
    DROP COLUMN IF EXISTS title,
    DROP COLUMN IF EXISTS summary,
    DROP COLUMN IF EXISTS body;

DROP TYPE IF EXISTS content_post_type;
