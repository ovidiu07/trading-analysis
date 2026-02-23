ALTER TABLE session_levels
    ADD COLUMN IF NOT EXISTS symbol VARCHAR(64),
    ADD COLUMN IF NOT EXISTS level_type VARCHAR(32) NOT NULL DEFAULT 'OTHER',
    ADD COLUMN IF NOT EXISTS timeframe VARCHAR(8) NOT NULL DEFAULT 'M15',
    ADD COLUMN IF NOT EXISTS zone_low NUMERIC(18, 8),
    ADD COLUMN IF NOT EXISTS zone_high NUMERIC(18, 8),
    ADD COLUMN IF NOT EXISTS origin_rule VARCHAR(400),
    ADD COLUMN IF NOT EXISTS strength_score SMALLINT NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'FRESH',
    ADD COLUMN IF NOT EXISTS touched_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_touched_at_utc TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(16) NOT NULL DEFAULT 'USER',
    ADD COLUMN IF NOT EXISTS expectation VARCHAR(48),
    ADD COLUMN IF NOT EXISTS is_sweep_role BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_entry_role BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_sl_role BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_tp_role BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_session_levels_strength_score'
    ) THEN
        ALTER TABLE session_levels
            ADD CONSTRAINT chk_session_levels_strength_score CHECK (strength_score BETWEEN 0 AND 5);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_session_levels_touched_count'
    ) THEN
        ALTER TABLE session_levels
            ADD CONSTRAINT chk_session_levels_touched_count CHECK (touched_count >= 0);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_session_levels_level_type'
    ) THEN
        ALTER TABLE session_levels
            ADD CONSTRAINT chk_session_levels_level_type CHECK (
                level_type IN (
                    'PDH', 'PDL', 'ASIA_H', 'ASIA_L',
                    'LONDON_H', 'LONDON_L', 'NY_H', 'NY_L',
                    'SESSION_H', 'SESSION_L',
                    'EQH', 'EQL',
                    'HTF_SWING_HIGH', 'HTF_SWING_LOW',
                    'OB_HIGH', 'OB_LOW',
                    'FVG_MID',
                    'OTHER'
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_session_levels_timeframe'
    ) THEN
        ALTER TABLE session_levels
            ADD CONSTRAINT chk_session_levels_timeframe CHECK (
                timeframe IN ('W1', 'D1', 'H4', 'H1', 'M15', 'M5', 'M1')
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_session_levels_status_v1'
    ) THEN
        ALTER TABLE session_levels
            ADD CONSTRAINT chk_session_levels_status_v1 CHECK (
                status IN ('FRESH', 'TAPPED', 'SWEPT', 'RECLAIMED', 'INVALID')
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_session_levels_created_by'
    ) THEN
        ALTER TABLE session_levels
            ADD CONSTRAINT chk_session_levels_created_by CHECK (
                created_by IN ('MENTOR', 'USER')
            );
    END IF;
END
$$;

UPDATE session_levels
SET status = 'SWEPT',
    touched_count = GREATEST(touched_count, 1),
    last_touched_at_utc = COALESCE(last_touched_at_utc, swept_at)
WHERE swept_at IS NOT NULL
  AND status = 'FRESH';

UPDATE session_levels
SET level_type = CASE UPPER(TRIM(label))
    WHEN 'PDH' THEN 'PDH'
    WHEN 'PDL' THEN 'PDL'
    WHEN 'ASIAH' THEN 'ASIA_H'
    WHEN 'ASIAL' THEN 'ASIA_L'
    WHEN 'EQH' THEN 'EQH'
    WHEN 'EQL' THEN 'EQL'
    ELSE level_type
END;

UPDATE session_levels sl
SET is_sweep_role = TRUE
FROM today_sessions ts
WHERE ts.active_sweep_level_id = sl.id;

CREATE INDEX IF NOT EXISTS idx_session_levels_session_symbol
    ON session_levels (today_session_id, symbol);

CREATE INDEX IF NOT EXISTS idx_session_levels_symbol_type
    ON session_levels (symbol, level_type);

CREATE INDEX IF NOT EXISTS idx_session_levels_session_status
    ON session_levels (today_session_id, status);

CREATE INDEX IF NOT EXISTS idx_session_levels_session_symbol_sweep
    ON session_levels (today_session_id, symbol, is_sweep_role);

CREATE TABLE IF NOT EXISTS liquidity_pools
(
    id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    today_session_id UUID                     NOT NULL REFERENCES today_sessions (id) ON DELETE CASCADE,
    user_id          UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    symbol           VARCHAR(64)              NOT NULL,
    pool_name        VARCHAR(120)             NOT NULL,
    type             VARCHAR(32)              NOT NULL DEFAULT 'OTHER',
    timeframe        VARCHAR(8)               NOT NULL DEFAULT 'M15',
    zone_low         NUMERIC(18, 8)           NOT NULL,
    zone_high        NUMERIC(18, 8)           NOT NULL,
    cleanliness_score SMALLINT                NOT NULL DEFAULT 3,
    status           VARCHAR(16)              NOT NULL DEFAULT 'FRESH',
    is_sweep_role    BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at_utc   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_liquidity_pools_name_nonblank CHECK (length(trim(pool_name)) > 0),
    CONSTRAINT chk_liquidity_pools_zone CHECK (zone_high >= zone_low),
    CONSTRAINT chk_liquidity_pools_cleanliness CHECK (cleanliness_score BETWEEN 0 AND 5),
    CONSTRAINT chk_liquidity_pools_type CHECK (
        type IN (
            'PDH', 'PDL', 'ASIA_H', 'ASIA_L',
            'LONDON_H', 'LONDON_L', 'NY_H', 'NY_L',
            'SESSION_H', 'SESSION_L',
            'EQH', 'EQL',
            'HTF_SWING_HIGH', 'HTF_SWING_LOW',
            'OB_HIGH', 'OB_LOW',
            'FVG_MID',
            'OTHER'
        )
    ),
    CONSTRAINT chk_liquidity_pools_timeframe CHECK (timeframe IN ('W1', 'D1', 'H4', 'H1', 'M15', 'M5', 'M1')),
    CONSTRAINT chk_liquidity_pools_status CHECK (status IN ('FRESH', 'TAPPED', 'SWEPT', 'INVALID'))
);

CREATE INDEX IF NOT EXISTS idx_liquidity_pools_session_symbol
    ON liquidity_pools (today_session_id, symbol);

CREATE INDEX IF NOT EXISTS idx_liquidity_pools_session_status
    ON liquidity_pools (today_session_id, status);

CREATE TABLE IF NOT EXISTS pool_levels
(
    pool_id  UUID NOT NULL REFERENCES liquidity_pools (id) ON DELETE CASCADE,
    level_id UUID NOT NULL REFERENCES session_levels (id) ON DELETE CASCADE,
    PRIMARY KEY (pool_id, level_id)
);

CREATE INDEX IF NOT EXISTS idx_pool_levels_level
    ON pool_levels (level_id);

CREATE TABLE IF NOT EXISTS session_narratives
(
    session_id             UUID                     PRIMARY KEY REFERENCES today_sessions (id) ON DELETE CASCADE,
    user_id                UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    htf_draw               VARCHAR(32),
    expected_manipulation  VARCHAR(24),
    delivery_model         VARCHAR(64),
    confirmation_model     VARCHAR(64),
    notes                  VARCHAR(400),
    created_at_utc         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_session_narratives_htf_draw CHECK (
        htf_draw IS NULL OR htf_draw IN (
            'PDH', 'PDL', 'WEEKLY_H', 'WEEKLY_L',
            'DAILY_SWING_HIGH', 'DAILY_SWING_LOW', 'OTHER'
        )
    ),
    CONSTRAINT chk_session_narratives_expected_manipulation CHECK (
        expected_manipulation IS NULL OR expected_manipulation IN ('RAID_UP', 'RAID_DOWN', 'NONE')
    ),
    CONSTRAINT chk_session_narratives_delivery_model CHECK (
        delivery_model IS NULL OR delivery_model IN (
            'ASIA_RAID_LONDON_REVERSAL',
            'ASIA_RAID_LONDON_CONTINUATION',
            'LONDON_RAID_NY_REVERSAL',
            'TREND_DAY',
            'OTHER'
        )
    ),
    CONSTRAINT chk_session_narratives_confirmation_model CHECK (
        confirmation_model IS NULL OR confirmation_model IN (
            'DISPLACEMENT_M5_MSS_M5',
            'DISPLACEMENT_M1_MSS_M1',
            'DISPLACEMENT_M15_MSS_M5',
            'OTHER'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_session_narratives_user
    ON session_narratives (user_id, updated_at_utc DESC);

ALTER TABLE today_sessions
    ADD COLUMN IF NOT EXISTS active_entry_level_id UUID REFERENCES session_levels (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS active_sl_level_id UUID REFERENCES session_levels (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS active_tp_level_id UUID REFERENCES session_levels (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS active_sweep_pool_id UUID REFERENCES liquidity_pools (id) ON DELETE SET NULL;

ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS sweep_level_id UUID REFERENCES session_levels (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sweep_pool_id UUID REFERENCES liquidity_pools (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS entry_level_id UUID REFERENCES session_levels (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sl_level_id UUID REFERENCES session_levels (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tp_level_id UUID REFERENCES session_levels (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS narrative_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS sweep_confirmed BOOLEAN,
    ADD COLUMN IF NOT EXISTS displacement_confirmed BOOLEAN,
    ADD COLUMN IF NOT EXISTS mss_confirmed BOOLEAN,
    ADD COLUMN IF NOT EXISTS sweep_depth_points NUMERIC(18, 8),
    ADD COLUMN IF NOT EXISTS displacement_size_points NUMERIC(18, 8),
    ADD COLUMN IF NOT EXISTS time_sweep_to_entry_seconds INTEGER,
    ADD COLUMN IF NOT EXISTS mfe_points NUMERIC(18, 8),
    ADD COLUMN IF NOT EXISTS mae_points NUMERIC(18, 8),
    ADD COLUMN IF NOT EXISTS level_expectation_met BOOLEAN,
    ADD COLUMN IF NOT EXISTS level_expectation VARCHAR(48);

CREATE INDEX IF NOT EXISTS idx_trades_session_role_levels
    ON trades (session_id, sweep_level_id, entry_level_id, sl_level_id, tp_level_id);

CREATE INDEX IF NOT EXISTS idx_trades_sweep_pool
    ON trades (sweep_pool_id);
