ALTER TABLE users
    ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(16);

UPDATE users
SET theme_preference = 'SYSTEM'
WHERE theme_preference IS NULL;

ALTER TABLE users
    ALTER COLUMN theme_preference SET DEFAULT 'SYSTEM';

ALTER TABLE users
    ALTER COLUMN theme_preference SET NOT NULL;
