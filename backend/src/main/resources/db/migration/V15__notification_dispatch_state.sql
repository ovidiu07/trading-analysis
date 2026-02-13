ALTER TABLE notification_event
    ADD COLUMN IF NOT EXISTS status VARCHAR(32);

UPDATE notification_event
SET status = CASE
                 WHEN dispatched_at IS NOT NULL THEN 'SENT'
                 ELSE 'PENDING'
    END
WHERE status IS NULL;

UPDATE notification_event
SET status = 'SENT'
WHERE dispatched_at IS NOT NULL
  AND status <> 'SENT';

ALTER TABLE notification_event
    ALTER COLUMN status SET DEFAULT 'PENDING';

ALTER TABLE notification_event
    ALTER COLUMN status SET NOT NULL;

ALTER TABLE notification_event
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE notification_event
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE notification_event
    ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE notification_event
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_notification_event_status
    ON notification_event (status);

CREATE INDEX IF NOT EXISTS idx_notification_event_status_retry
    ON notification_event (status, next_retry_at);
