-- EIA public weekly JSON is staged for review; this does not publish a briefing.
ALTER TABLE official_event_source DROP CONSTRAINT official_event_source_source_id_check;
ALTER TABLE official_event_source ADD CONSTRAINT official_event_source_source_id_check CHECK (source_id IN ('BLS','EUROSTAT','EIA'));
INSERT INTO official_event_source(source_id) VALUES ('EIA');
