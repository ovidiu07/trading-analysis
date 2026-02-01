CREATE TABLE trade_import_rows (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    transaction_id TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_trade_import_rows_user_tx ON trade_import_rows(user_id, transaction_id);
