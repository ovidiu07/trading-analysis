CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    base_currency VARCHAR(10) DEFAULT 'USD',
    timezone VARCHAR(80) DEFAULT 'Europe/Bucharest',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    broker VARCHAR(120),
    account_currency VARCHAR(10),
    starting_balance NUMERIC(18,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE market_type AS ENUM ('STOCK','CFD','FOREX','CRYPTO','FUTURES','OPTIONS','OTHER');
CREATE TYPE direction_type AS ENUM ('LONG','SHORT');
CREATE TYPE status_type AS ENUM ('OPEN','CLOSED');

CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    symbol VARCHAR(50) NOT NULL,
    market market_type NOT NULL,
    direction direction_type NOT NULL,
    status status_type NOT NULL,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    timeframe VARCHAR(20),
    quantity NUMERIC(18,4) NOT NULL,
    entry_price NUMERIC(18,6) NOT NULL,
    exit_price NUMERIC(18,6),
    stop_loss_price NUMERIC(18,6),
    take_profit_price NUMERIC(18,6),
    fees NUMERIC(18,4) DEFAULT 0,
    commission NUMERIC(18,4) DEFAULT 0,
    slippage NUMERIC(18,4) DEFAULT 0,
    pnl_gross NUMERIC(18,4),
    pnl_net NUMERIC(18,4),
    pnl_percent NUMERIC(18,4),
    risk_amount NUMERIC(18,4),
    risk_percent NUMERIC(18,4),
    r_multiple NUMERIC(18,4),
    capital_used NUMERIC(18,4),
    setup VARCHAR(255),
    strategy_tag VARCHAR(120),
    catalyst_tag VARCHAR(120),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE tag_type AS ENUM ('STRATEGY','MISTAKE','EMOTION','SESSION','CUSTOM');

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    type tag_type NOT NULL
);

CREATE TABLE trade_tags (
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, tag_id)
);

CREATE INDEX idx_trades_user_closed_at ON trades(user_id, closed_at);
CREATE INDEX idx_trades_user_symbol ON trades(user_id, symbol);
CREATE INDEX idx_trades_user_strategy ON trades(user_id, strategy_tag);
