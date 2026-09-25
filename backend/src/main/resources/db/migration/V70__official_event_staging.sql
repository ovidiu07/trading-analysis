-- Official observations are suggestions. Only the existing reviewed briefing flow publishes them.
CREATE TABLE official_event_source (source_id TEXT PRIMARY KEY CHECK(source_id IN ('BLS','EUROSTAT')));
INSERT INTO official_event_source VALUES ('BLS'),('EUROSTAT');
CREATE TABLE official_event_import_run (
 id UUID PRIMARY KEY, source_id TEXT NOT NULL REFERENCES official_event_source,
 request_key TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('CALENDAR','RESULT')),
 actor_id UUID NOT NULL REFERENCES users(id), started_at TIMESTAMPTZ NOT NULL,
 finished_at TIMESTAMPTZ, status TEXT NOT NULL CHECK(status IN ('STARTED','STAGED','FAILED')),
 detail TEXT, staged_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX official_event_run_budget ON official_event_import_run(source_id,started_at DESC);
CREATE TABLE official_event_revision (
 id UUID PRIMARY KEY, source_id TEXT NOT NULL REFERENCES official_event_source,
 event_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
 previous_id UUID REFERENCES official_event_revision(id),
 run_id UUID NOT NULL REFERENCES official_event_import_run(id),
 observed_at TIMESTAMPTZ NOT NULL, scheduled_date DATE NOT NULL,
 payload JSONB NOT NULL, fingerprint TEXT NOT NULL,
 UNIQUE(source_id,event_id,revision)
);
CREATE INDEX official_event_revision_latest ON official_event_revision(source_id,event_id,revision DESC);
CREATE INDEX official_event_revision_date ON official_event_revision(scheduled_date);
CREATE TABLE official_event_alias (
 source_id TEXT NOT NULL REFERENCES official_event_source, event_id TEXT NOT NULL,
 target_event_id TEXT NOT NULL, reviewed_by UUID NOT NULL REFERENCES users(id), reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(source_id,event_id), CHECK(event_id<>target_event_id)
);
CREATE TRIGGER immutable_official_event_alias BEFORE UPDATE OR DELETE ON official_event_alias
 FOR EACH ROW EXECUTE FUNCTION protect_editorial_revision();
CREATE TRIGGER immutable_official_event_revision BEFORE UPDATE OR DELETE ON official_event_revision
 FOR EACH ROW EXECUTE FUNCTION protect_editorial_revision();
