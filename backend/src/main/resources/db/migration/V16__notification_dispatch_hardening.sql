ALTER TABLE notification_event
    ADD COLUMN IF NOT EXISTS status VARCHAR(32);

UPDATE notification_event
SET status = CASE
                 WHEN dispatched_at IS NOT NULL THEN 'SENT'
                 ELSE 'PENDING'
    END
WHERE status IS NULL;

ALTER TABLE notification_event
    ALTER COLUMN status SET DEFAULT 'PENDING';

ALTER TABLE notification_event
    ALTER COLUMN status SET NOT NULL;

ALTER TABLE notification_event
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE notification_event
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE notification_event
    ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE notification_event
    ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE notification_event
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_notif_event_status
    ON notification_event (status);

CREATE INDEX IF NOT EXISTS idx_notif_event_status_nextretry
    ON notification_event (status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_notif_event_nextretry
    ON notification_event (next_retry_at);

CREATE INDEX IF NOT EXISTS idx_notif_event_due_scan
    ON notification_event (status, effective_at, next_retry_at, created_at);
