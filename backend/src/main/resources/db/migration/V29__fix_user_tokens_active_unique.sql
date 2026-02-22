ALTER TABLE user_tokens
    DROP CONSTRAINT IF EXISTS uq_user_tokens_active_type;

DROP INDEX IF EXISTS uq_user_tokens_active_type;

WITH ranked_active AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY user_id, type
               ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM user_tokens
    WHERE used_at IS NULL
)
UPDATE user_tokens ut
SET used_at = NOW()
FROM ranked_active ra
WHERE ut.id = ra.id
  AND ra.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_tokens_active_type
    ON user_tokens(user_id, type)
    WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_user_tokens_token_hash
    ON user_tokens(token_hash);

CREATE INDEX IF NOT EXISTS ix_user_tokens_user_type
    ON user_tokens(user_id, type);
