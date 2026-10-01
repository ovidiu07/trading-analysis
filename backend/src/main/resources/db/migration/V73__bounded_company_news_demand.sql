-- Only public company identity/demand timestamps, shared across accounts. No user/watchlist data.
CREATE TABLE news_company_demand (
 identity TEXT PRIMARY KEY,
 last_demand_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX news_company_demand_expiry ON news_company_demand(last_demand_at);
