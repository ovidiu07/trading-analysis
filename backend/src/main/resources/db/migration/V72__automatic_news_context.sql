-- Shared public information only. Private plans, editorial revisions and Ready captures are untouched.
CREATE TABLE news_feed_state (
 feed_id TEXT PRIMARY KEY,
 last_attempt_at TIMESTAMPTZ,
 last_success_at TIMESTAMPTZ,
 next_refresh_at TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
 lease_until TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
 lease_token UUID,
 status TEXT NOT NULL DEFAULT 'PENDING'
);
CREATE TABLE news_provider_budget (
 provider TEXT NOT NULL,
 budget_day DATE NOT NULL,
 requests INTEGER NOT NULL CHECK (requests >= 0),
 PRIMARY KEY (provider, budget_day)
);
-- Immutable fetch snapshots provide a conservative first-seen/as-of boundary.
CREATE TABLE news_feed_snapshot (
 id BIGSERIAL PRIMARY KEY,
 feed_id TEXT NOT NULL REFERENCES news_feed_state(feed_id),
 fetched_at TIMESTAMPTZ NOT NULL,
 payload JSONB NOT NULL
);
CREATE INDEX news_feed_snapshot_asof ON news_feed_snapshot(feed_id, fetched_at DESC, id DESC);
CREATE TRIGGER immutable_news_snapshot BEFORE UPDATE OR DELETE ON news_feed_snapshot
 FOR EACH ROW EXECUTE FUNCTION protect_editorial_revision();
