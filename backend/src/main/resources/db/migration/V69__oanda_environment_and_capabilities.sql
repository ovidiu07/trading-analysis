ALTER TABLE backtest_provider_credentials
    ADD COLUMN IF NOT EXISTS environment VARCHAR(16) NOT NULL DEFAULT 'PRACTICE',
    ADD COLUMN IF NOT EXISTS instrument_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS instrument_capabilities_refreshed_at TIMESTAMPTZ;

ALTER TABLE backtest_provider_credentials
    DROP CONSTRAINT IF EXISTS chk_backtest_provider_credentials_environment;

ALTER TABLE backtest_provider_credentials
    ADD CONSTRAINT chk_backtest_provider_credentials_environment
        CHECK (environment IN ('PRACTICE', 'LIVE'));

ALTER TABLE backtest_provider_credentials
    DROP CONSTRAINT IF EXISTS chk_backtest_provider_credentials_capabilities_array;

ALTER TABLE backtest_provider_credentials
    ADD CONSTRAINT chk_backtest_provider_credentials_capabilities_array
        CHECK (jsonb_typeof(instrument_capabilities) = 'array');
