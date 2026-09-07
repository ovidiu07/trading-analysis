-- Typed extension of Mentor CMS. Generic CMS rows stay DRAFT; discovery uses immutable revisions.
INSERT INTO content_type(key,sort_order,active) VALUES ('SESSION_BRIEFING',80,true);
INSERT INTO content_type_translation(content_type_id,locale,display_name)
SELECT id,'en','Session briefings' FROM content_type WHERE key='SESSION_BRIEFING';
INSERT INTO content_type_translation(content_type_id,locale,display_name)
SELECT id,'ro','Informări de sesiune' FROM content_type WHERE key='SESSION_BRIEFING';
CREATE TABLE session_briefing (
 id UUID PRIMARY KEY REFERENCES content_post(id) ON DELETE RESTRICT,
 editorial_date DATE NOT NULL, slot VARCHAR(16) NOT NULL CHECK(slot IN ('ASIA','LONDON','DAY_RECAP')),
 editorial_timezone TEXT NOT NULL DEFAULT 'Europe/Bucharest' CHECK(editorial_timezone='Europe/Bucharest'),
 draft JSONB NOT NULL, draft_version INTEGER NOT NULL DEFAULT 1,
 published_draft_version INTEGER, withdrawn BOOLEAN NOT NULL DEFAULT false,
 updated_by UUID NOT NULL REFERENCES users(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(editorial_date,slot)
);
CREATE TABLE session_briefing_revision (
 id UUID PRIMARY KEY, briefing_id UUID NOT NULL REFERENCES session_briefing(id),
 revision INTEGER NOT NULL, draft_version INTEGER NOT NULL, payload JSONB NOT NULL,
 reference_time TIMESTAMPTZ NOT NULL, published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 actor_id UUID NOT NULL REFERENCES users(id), request_id UUID NOT NULL UNIQUE,
 UNIQUE(briefing_id,revision), UNIQUE(briefing_id,draft_version)
);
CREATE INDEX session_briefing_discovery ON session_briefing(editorial_date DESC,slot) WHERE NOT withdrawn;
CREATE INDEX session_briefing_revision_lookup ON session_briefing_revision(briefing_id,published_at DESC);
CREATE TABLE content_publication_audit (
 id UUID PRIMARY KEY, content_id UUID NOT NULL REFERENCES content_post(id),
 revision_id UUID REFERENCES session_briefing_revision(id), actor_id UUID NOT NULL REFERENCES users(id),
 action TEXT NOT NULL CHECK(action IN ('CREATE','SAVE_DRAFT','PUBLISH','WITHDRAW')),
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), draft_version INTEGER NOT NULL
);
CREATE TABLE session_briefing_fact (
 revision_id UUID NOT NULL REFERENCES session_briefing_revision(id), locale VARCHAR(2) NOT NULL,
 fact_id TEXT NOT NULL, related_fact_id TEXT, relationship TEXT CHECK(relationship IN ('UPDATE','CORRECTION','CONTINUATION')),
 PRIMARY KEY(revision_id,locale,fact_id), CHECK((related_fact_id IS NULL)=(relationship IS NULL))
);
CREATE INDEX session_briefing_fact_relation ON session_briefing_fact(fact_id,related_fact_id);
CREATE TABLE session_briefing_event (
 revision_id UUID NOT NULL REFERENCES session_briefing_revision(id), locale VARCHAR(2) NOT NULL,
 event_id TEXT NOT NULL, PRIMARY KEY(revision_id,locale,event_id)
);
CREATE TABLE preparation_briefing_composition (
 preparation_id UUID NOT NULL REFERENCES preparation_briefings(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position>=0), revision_id UUID NOT NULL REFERENCES session_briefing_revision(id),
 PRIMARY KEY(preparation_id,position), UNIQUE(preparation_id,revision_id)
);
CREATE FUNCTION protect_editorial_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Published editorial revisions and audit actions are immutable'; END $$;
CREATE TRIGGER immutable_editorial_revision BEFORE UPDATE OR DELETE ON session_briefing_revision FOR EACH ROW EXECUTE FUNCTION protect_editorial_revision();
CREATE TRIGGER immutable_editorial_audit BEFORE UPDATE OR DELETE ON content_publication_audit FOR EACH ROW EXECUTE FUNCTION protect_editorial_revision();
