CREATE TYPE legal_document_type AS ENUM ('TERMS','PRIVACY');

CREATE TABLE legal_acceptance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type legal_document_type NOT NULL,
    doc_version VARCHAR(60) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address VARCHAR(80),
    user_agent TEXT,
    locale VARCHAR(20)
);

CREATE INDEX idx_legal_acceptance_user_doc ON legal_acceptance(user_id, doc_type, doc_version);

ALTER TABLE notebook_note ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
