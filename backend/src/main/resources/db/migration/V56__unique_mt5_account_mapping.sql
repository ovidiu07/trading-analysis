CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_mt5_external_mapping
    ON accounts (
        user_id,
        LOWER(external_account_id),
        COALESCE(LOWER(broker_server), '')
    )
    WHERE external_account_id IS NOT NULL;

ALTER TABLE imported_trade_executions
    ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE imported_trade_executions execution
SET user_id = batch.user_id
FROM trade_import_batches batch
WHERE execution.import_batch_id = batch.id
  AND execution.user_id IS NULL;

ALTER TABLE imported_trade_executions
    ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE imported_trade_executions
    ADD CONSTRAINT fk_imported_trade_executions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE imported_trade_orders
    ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE imported_trade_orders imported_order
SET user_id = batch.user_id
FROM trade_import_batches batch
WHERE imported_order.import_batch_id = batch.id
  AND imported_order.user_id IS NULL;

ALTER TABLE imported_trade_orders
    ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE imported_trade_orders
    ADD CONSTRAINT fk_imported_trade_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS uq_mt5_trade_external_position;
CREATE UNIQUE INDEX uq_mt5_trade_external_position
    ON trades (user_id, source, COALESCE(LOWER(source_broker_server), ''), external_account_id, external_position_id)
    WHERE source = 'MT5_HTML' AND external_position_id IS NOT NULL;

DROP INDEX IF EXISTS uq_imported_execution_external;
CREATE UNIQUE INDEX uq_imported_execution_external
    ON imported_trade_executions (
        user_id,
        source,
        COALESCE(LOWER(broker_server), ''),
        external_account_id,
        external_deal_id
    );

DROP INDEX IF EXISTS uq_imported_order_external;
CREATE UNIQUE INDEX uq_imported_order_external
    ON imported_trade_orders (
        user_id,
        source,
        COALESCE(LOWER(broker_server), ''),
        external_account_id,
        external_order_id
    );
