CREATE TABLE IF NOT EXISTS chart_settings (
    settings_key VARCHAR(64) PRIMARY KEY,
    preloaded_indicators_json JSONB NOT NULL DEFAULT '["MASimple@tv-basicstudies","RSI@tv-basicstudies"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
