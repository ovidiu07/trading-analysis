ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS external_account_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS broker_server VARCHAR(160),
    ADD COLUMN IF NOT EXISTS broker_timezone VARCHAR(80);

CREATE TABLE trade_import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(32) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    file_size BIGINT NOT NULL,
    parser_version VARCHAR(32) NOT NULL,
    external_account_id VARCHAR(128),
    account_name VARCHAR(255),
    account_currency VARCHAR(16),
    broker VARCHAR(255),
    broker_server VARCHAR(160),
    account_type VARCHAR(40),
    accounting_mode VARCHAR(40),
    report_generated_at_original VARCHAR(64),
    source_timezone VARCHAR(80),
    target_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL,
    positions_found INTEGER NOT NULL DEFAULT 0,
    orders_found INTEGER NOT NULL DEFAULT 0,
    deals_found INTEGER NOT NULL DEFAULT 0,
    trades_ready INTEGER NOT NULL DEFAULT 0,
    created_trades INTEGER NOT NULL DEFAULT 0,
    updated_trades INTEGER NOT NULL DEFAULT 0,
    duplicates INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    parsed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE instrument_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    broker VARCHAR(255),
    broker_server VARCHAR(160),
    external_symbol VARCHAR(80) NOT NULL,
    internal_symbol VARCHAR(80) NOT NULL,
    market VARCHAR(32) NOT NULL,
    trade_currency VARCHAR(16) NOT NULL,
    tick_size NUMERIC(24,10),
    tick_value NUMERIC(24,10),
    point_value NUMERIC(24,10),
    contract_multiplier NUMERIC(24,10),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_instrument_alias_scope
    ON instrument_aliases (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
                           COALESCE(LOWER(broker), ''), COALESCE(LOWER(broker_server), ''),
                           LOWER(external_symbol));

ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS external_account_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS external_position_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS source_broker VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_broker_server VARCHAR(160),
    ADD COLUMN IF NOT EXISTS source_timezone VARCHAR(80),
    ADD COLUMN IF NOT EXISTS account_currency VARCHAR(16),
    ADD COLUMN IF NOT EXISTS broker_reported_pnl_currency VARCHAR(16),
    ADD COLUMN IF NOT EXISTS broker_reported_gross_pnl NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS broker_reported_net_pnl NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS calculated_gross_pnl NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS calculated_net_pnl NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS pnl_reconciliation_difference NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS initial_stop_loss_price NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS initial_take_profit_price NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS final_stop_loss_price NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS final_take_profit_price NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS entry_order_type VARCHAR(80),
    ADD COLUMN IF NOT EXISTS exit_reason VARCHAR(80),
    ADD COLUMN IF NOT EXISTS requested_entry_price NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS requested_exit_price NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS entry_slippage_points NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS exit_slippage_points NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS swap NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS broker_fees NUMERIC(24,8),
    ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES trade_import_batches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS import_status VARCHAR(32),
    ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_synchronized_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX uq_mt5_trade_external_position
    ON trades (source, COALESCE(LOWER(source_broker_server), ''), external_account_id, external_position_id)
    WHERE source = 'MT5_HTML' AND external_position_id IS NOT NULL;

CREATE INDEX idx_trades_source_status ON trades (user_id, source, import_status);
CREATE INDEX idx_trade_import_batches_user_created ON trade_import_batches (user_id, created_at DESC);

CREATE TABLE imported_trade_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    import_batch_id UUID NOT NULL REFERENCES trade_import_batches(id) ON DELETE CASCADE,
    source VARCHAR(32) NOT NULL,
    broker_server VARCHAR(160),
    external_account_id VARCHAR(128) NOT NULL,
    external_deal_id VARCHAR(128) NOT NULL,
    external_order_id VARCHAR(128),
    external_position_id VARCHAR(128),
    symbol VARCHAR(80),
    execution_direction VARCHAR(32),
    entry_exit_classification VARCHAR(32),
    quantity NUMERIC(24,10),
    price NUMERIC(24,10),
    executed_at TIMESTAMP WITH TIME ZONE,
    original_broker_timestamp VARCHAR(64),
    commission NUMERIC(24,8),
    fee NUMERIC(24,8),
    cost NUMERIC(24,8),
    swap NUMERIC(24,8),
    profit NUMERIC(24,8),
    balance_after NUMERIC(24,8),
    currency VARCHAR(16),
    comment TEXT,
    raw_source_data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX uq_imported_execution_external
    ON imported_trade_executions (source, COALESCE(LOWER(broker_server), ''), external_account_id, external_deal_id);
CREATE INDEX idx_imported_execution_trade ON imported_trade_executions (trade_id, executed_at);

CREATE TABLE imported_trade_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    import_batch_id UUID NOT NULL REFERENCES trade_import_batches(id) ON DELETE CASCADE,
    source VARCHAR(32) NOT NULL,
    broker_server VARCHAR(160),
    external_account_id VARCHAR(128) NOT NULL,
    external_order_id VARCHAR(128) NOT NULL,
    external_position_id VARCHAR(128),
    symbol VARCHAR(80),
    order_type VARCHAR(80),
    requested_quantity NUMERIC(24,10),
    filled_quantity NUMERIC(24,10),
    requested_price NUMERIC(24,10),
    stop_loss NUMERIC(24,10),
    take_profit NUMERIC(24,10),
    state VARCHAR(48),
    opened_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    original_opened_at VARCHAR(64),
    original_completed_at VARCHAR(64),
    comment TEXT,
    raw_source_data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX uq_imported_order_external
    ON imported_trade_orders (source, COALESCE(LOWER(broker_server), ''), external_account_id, external_order_id);
CREATE INDEX idx_imported_order_batch ON imported_trade_orders (import_batch_id);
