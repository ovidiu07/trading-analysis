CREATE TYPE content_post_type AS ENUM ('STRATEGY','WEEKLY_PLAN');
CREATE TYPE content_post_status AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');

CREATE TABLE content_post (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type content_post_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    summary TEXT,
    body TEXT NOT NULL,
    status content_post_status NOT NULL DEFAULT 'DRAFT',
    tags JSONB,
    symbols JSONB,
    visible_from TIMESTAMP WITH TIME ZONE,
    visible_until TIMESTAMP WITH TIME ZONE,
    week_start DATE,
    week_end DATE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_content_post_type_status ON content_post(type, status);
CREATE INDEX idx_content_post_published_at ON content_post(published_at);
CREATE INDEX idx_content_post_week_range ON content_post(week_start, week_end);
CREATE INDEX idx_content_post_visible_range ON content_post(visible_from, visible_until);
