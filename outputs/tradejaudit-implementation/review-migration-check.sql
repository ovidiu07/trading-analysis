BEGIN;
INSERT INTO users(id,email,password_hash,role) VALUES ('00000000-0000-4000-8000-000000000001','fixture@example.invalid','LOGIN_DISABLED','USER');
INSERT INTO accounts(id,user_id,name,account_currency) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Synthetic migration fixture','EUR');
INSERT INTO session_review_revisions(id,user_id,account_id,session_date,revision,payload) VALUES
('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','2026-09-06',1,'{"state":"COMPLETE","nextFocus":"Wait for confirmation"}'),
('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','2026-09-06',2,'{"state":"REVIEW","nextFocus":""}');
DO $$ BEGIN
 IF (SELECT count(*) FROM session_review_revisions) <> 2 THEN RAISE EXCEPTION 'Revision history lost'; END IF;
 IF (SELECT payload->>'nextFocus' FROM session_review_revisions ORDER BY revision DESC LIMIT 1) <> '' THEN RAISE EXCEPTION 'Explicit blank lost'; END IF;
 BEGIN
 INSERT INTO session_review_revisions SELECT '00000000-0000-4000-8000-000000000005',user_id,account_id,session_date,revision,payload,created_at FROM session_review_revisions WHERE revision=2;
 RAISE EXCEPTION 'Duplicate revision accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 RAISE NOTICE 'REVIEW_MIGRATION_ASSERTIONS_PASSED: 3';
END $$;
ROLLBACK;
