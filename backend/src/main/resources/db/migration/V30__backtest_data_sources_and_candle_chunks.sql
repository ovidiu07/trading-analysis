CREATE TABLE IF NOT EXISTS backtest_datasets
(
    id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider         VARCHAR(16)              NOT NULL,
    source_id        VARCHAR(128)             NOT NULL,
    name             VARCHAR(180)             NOT NULL,
    symbol_canonical VARCHAR(64)              NOT NULL,
    symbol_display   VARCHAR(96)              NOT NULL,
    timeframe        VARCHAR(16)              NOT NULL,
    data_from        TIMESTAMP WITH TIME ZONE NOT NULL,
    data_to          TIMESTAMP WITH TIME ZONE NOT NULL,
    row_count        INTEGER                  NOT NULL DEFAULT 0,
    metadata_json    JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_backtest_datasets_provider CHECK (provider IN ('CSV', 'OANDA', 'DEMO')),
    CONSTRAINT chk_backtest_datasets_timeframe CHECK (timeframe IN ('M1', 'M5', 'M15', 'H1', 'D1')),
    CONSTRAINT chk_backtest_datasets_name_nonblank CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_backtest_datasets_lookup
    ON backtest_datasets (user_id, provider, source_id, symbol_canonical, timeframe);

CREATE INDEX IF NOT EXISTS idx_backtest_datasets_user_created
    ON backtest_datasets (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS candle_chunks
(
    id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID REFERENCES users (id) ON DELETE CASCADE,
    provider         VARCHAR(16)              NOT NULL,
    source_id        VARCHAR(128)             NOT NULL,
    symbol_canonical VARCHAR(64)              NOT NULL,
    symbol_display   VARCHAR(96)              NOT NULL,
    timeframe        VARCHAR(16)              NOT NULL,
    chunk_start_utc  TIMESTAMP WITH TIME ZONE NOT NULL,
    chunk_end_utc    TIMESTAMP WITH TIME ZONE NOT NULL,
    format           VARCHAR(16)              NOT NULL,
    payload          BYTEA,
    object_key       VARCHAR(512),
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_candle_chunks_provider CHECK (provider IN ('CSV', 'OANDA', 'DEMO')),
    CONSTRAINT chk_candle_chunks_timeframe CHECK (timeframe IN ('M1', 'M5', 'M15', 'H1', 'D1')),
    CONSTRAINT chk_candle_chunks_format CHECK (format IN ('JSON_GZIP', 'PARQUET', 'CSV_GZIP')),
    CONSTRAINT chk_candle_chunks_payload_ref CHECK (payload IS NOT NULL OR object_key IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_candle_chunks_lookup
    ON candle_chunks (
        COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
        provider,
        source_id,
        symbol_canonical,
        timeframe,
        chunk_start_utc
    );

CREATE INDEX IF NOT EXISTS idx_candle_chunks_lookup
    ON candle_chunks (provider, source_id, symbol_canonical, timeframe, chunk_start_utc);

CREATE INDEX IF NOT EXISTS idx_candle_chunks_range_lookup
    ON candle_chunks (
        COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
        provider,
        source_id,
        symbol_canonical,
        timeframe,
        chunk_end_utc
    );

CREATE TABLE IF NOT EXISTS backtest_csv_uploads
(
    id                 UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    original_file_name VARCHAR(255)             NOT NULL,
    content_type       VARCHAR(128),
    file_size_bytes    BIGINT                   NOT NULL,
    file_payload       BYTEA                    NOT NULL,
    header_signature   VARCHAR(256),
    detected_json      JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backtest_csv_uploads_user_created
    ON backtest_csv_uploads (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS backtest_csv_mappings
(
    id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    header_signature VARCHAR(256)             NOT NULL,
    time_column      VARCHAR(128)             NOT NULL,
    open_column      VARCHAR(128)             NOT NULL,
    high_column      VARCHAR(128)             NOT NULL,
    low_column       VARCHAR(128)             NOT NULL,
    close_column     VARCHAR(128)             NOT NULL,
    volume_column    VARCHAR(128),
    timezone         VARCHAR(64),
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_backtest_csv_mappings_signature
    ON backtest_csv_mappings (user_id, header_signature);

CREATE TABLE IF NOT EXISTS backtest_provider_credentials
(
    id                  UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider            VARCHAR(16)              NOT NULL,
    encrypted_token     BYTEA                    NOT NULL,
    token_iv            BYTEA                    NOT NULL,
    provider_account_id VARCHAR(128),
    last_tested_at      TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_backtest_provider_credentials_provider CHECK (provider IN ('OANDA'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_backtest_provider_credentials_user_provider
    ON backtest_provider_credentials (user_id, provider);

ALTER TABLE backtest_runs
    ADD COLUMN IF NOT EXISTS source_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS dataset_id UUID REFERENCES backtest_datasets (id) ON DELETE SET NULL;

UPDATE backtest_runs
SET source_id = provider
WHERE source_id IS NULL;

ALTER TABLE context_snapshots
    ADD COLUMN IF NOT EXISTS backtest_source VARCHAR(16),
    ADD COLUMN IF NOT EXISTS backtest_source_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS backtest_dataset_id UUID,
    ADD COLUMN IF NOT EXISTS backtest_symbol VARCHAR(64),
    ADD COLUMN IF NOT EXISTS backtest_timeframe VARCHAR(16),
    ADD COLUMN IF NOT EXISTS backtest_replay_cursor_time TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_context_snapshots_backtest_source
    ON context_snapshots (user_id, backtest_source, created_at DESC);
