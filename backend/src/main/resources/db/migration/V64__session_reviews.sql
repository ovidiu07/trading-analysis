-- Append-only account/day review revisions. Existing sessions and trades are untouched.
CREATE TABLE session_review_revisions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    revision INTEGER NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, account_id, session_date, revision),
    FOREIGN KEY(account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE CASCADE
);
CREATE INDEX session_review_latest ON session_review_revisions(user_id, account_id, session_date, revision DESC);
