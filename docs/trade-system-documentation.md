# Trade System Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Trade Data Model](#trade-data-model)
3. [Trade Calculations](#trade-calculations)
4. [Statistics Generation](#statistics-generation)
5. [API Endpoints](#api-endpoints)

## Introduction

This document provides a comprehensive overview of how trades are stored, calculated, and how statistics are generated and exposed in the TradeVault system. The system allows users to track their trades, analyze performance, and gain insights through various metrics and visualizations.

## Trade Data Model

### Database Schema

Trades are stored in a relational database with the following schema:

#### Trades Table
```sql
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
```

#### Related Tables
- **Users**: Stores user authentication and preferences
- **Accounts**: Tracks different trading accounts
- **Tags**: Categorizes trades
- **Trade_Tags**: Junction table for many-to-many relationship between trades and tags

### Key Fields

- **id**: Unique identifier for the trade
- **user_id**: Reference to the user who owns the trade
- **account_id**: Reference to the account used for the trade
- **symbol**: Trading symbol (e.g., AAPL, TSLA)
- **market**: Type of market (STOCK, CFD, FOREX, CRYPTO, FUTURES, OPTIONS, OTHER)
- **direction**: Trade direction (LONG, SHORT)
- **status**: Trade status (OPEN, CLOSED)
- **opened_at**: When the trade was opened
- **closed_at**: When the trade was closed (null for open trades)
- **quantity**: Number of units traded
- **entry_price**: Price at which the trade was entered
- **exit_price**: Price at which the trade was exited (null for open trades)
- **stop_loss_price**: Stop loss price
- **take_profit_price**: Take profit price
- **fees**: Trading fees
- **commission**: Trading commission
- **slippage**: Slippage costs
- **pnl_gross**: Gross profit and loss
- **pnl_net**: Net profit and loss (after fees, commissions, etc.)
- **pnl_percent**: Percentage profit and loss
- **risk_amount**: Amount risked on the trade
- **risk_percent**: Percentage of account risked
- **r_multiple**: Return relative to risk (R-multiple)
- **capital_used**: Capital used for the trade
- **strategy_tag**: Strategy used for the trade
- **catalyst_tag**: Catalyst for the trade
- **notes**: Additional notes

## Trade Calculations

The system automatically calculates various metrics for trades. These calculations are performed in the `calculateMetrics` method of the `TradeService` class.

### Profit and Loss (P&L) Calculations

#### Gross P&L
For LONG trades:
```
pnlGross = (exitPrice - entryPrice) * quantity
```

For SHORT trades:
```
pnlGross = (entryPrice - exitPrice) * quantity
```

#### Net P&L
```
totalCosts = fees + commission + slippage
pnlNet = pnlGross - totalCosts
```

#### P&L Percent
If risk amount is available:
```
pnlPercent = (pnlNet / riskAmount) * 100
```

If capital used is available:
```
pnlPercent = (pnlNet / capitalUsed) * 100
```

### Risk Metrics

#### R-Multiple
If risk amount is available:
```
rMultiple = pnlNet / riskAmount
```

If stop loss price is available:
For LONG trades:
```
riskPerUnit = entryPrice - stopLossPrice
riskValue = riskPerUnit * quantity
rMultiple = pnlNet / riskValue
```

For SHORT trades:
```
riskPerUnit = stopLossPrice - entryPrice
riskValue = riskPerUnit * quantity
rMultiple = pnlNet / riskValue
```

## Statistics Generation

The system generates various statistics and analytics through the `AnalyticsService` class. These statistics are exposed via the `/api/analytics/summary` endpoint.

### Calendar Realized P&L

The Calendar view uses realized (closed) P&L grouped by the trade close date in the user timezone (default `Europe/Bucharest`). Daily aggregates are computed server-side and include only trades with status `CLOSED` so open trades never affect the calendar totals.

### Key Performance Indicators (KPIs)

The following KPIs are calculated:

#### Total P&L
- **Total Net P&L**: Sum of net P&L for all trades
- **Total Gross P&L**: Sum of gross P&L for all trades

#### Win/Loss Metrics
- **Win Rate**: Percentage of winning trades
  ```
  winRate = (numberOfWinningTrades / totalTrades) * 100
  ```
- **Loss Rate**: Percentage of losing trades
  ```
  lossRate = (numberOfLosingTrades / totalTrades) * 100
  ```
- **Average Win**: Average profit of winning trades
  ```
  avgWin = totalProfitOfWinningTrades / numberOfWinningTrades
  ```
- **Average Loss**: Average loss of losing trades
  ```
  avgLoss = totalLossOfLosingTrades / numberOfLosingTrades
  ```

#### Performance Metrics
- **Expectancy**: Average P&L per trade
  ```
  expectancy = totalNetPnL / totalTrades
  ```
- **Profit Factor**: Ratio of gross profit to gross loss
  ```
  profitFactor = grossProfit / grossLoss
  ```
- **Maximum Drawdown**: Largest peak-to-trough decline
  ```
  maxDrawdown = peak - trough
  ```

#### Streak Metrics
- **Maximum Win Streak**: Longest streak of consecutive winning trades
- **Maximum Loss Streak**: Longest streak of consecutive losing trades

### Time Series Data

The system generates two types of time series data:

#### Equity Curve
Shows the cumulative P&L over time. Each point represents:
- **Date**: Date of the trade
- **Value**: Cumulative P&L up to that date

#### Grouped P&L
Shows the P&L grouped by date. Each point represents:
- **Date**: Date of the trade
- **Value**: Total P&L for that date

### Strategy Breakdown

The system provides a breakdown of P&L by strategy:
- **Key**: Strategy tag
- **Value**: Total P&L for that strategy

## API Endpoints

### Trade Endpoints

#### List Trades
- **Endpoint**: `GET /api/trades`
- **Parameters**:
  - `page` (default: 0): Page number
  - `size` (default: 20): Page size
- **Response**: Page of trade responses

#### Search Trades
- **Endpoint**: `GET /api/trades/search`
- **Parameters**:
  - `page` (default: 0): Page number
  - `size` (default: 20): Page size
  - `openedAtFrom`: Filter by opened date (from)
  - `openedAtTo`: Filter by opened date (to)
  - `closedAtFrom`: Filter by closed date (from)
  - `closedAtTo`: Filter by closed date (to)
  - `symbol`: Filter by symbol
  - `direction`: Filter by direction (LONG, SHORT)
- **Response**: Page of trade responses

#### Create Trade
- **Endpoint**: `POST /api/trades`
- **Body**: Trade request
- **Response**: Created trade

#### Update Trade
- **Endpoint**: `PUT /api/trades/{id}`
- **Parameters**:
  - `id`: Trade ID
- **Body**: Trade request
- **Response**: Updated trade

#### Delete Trade
- **Endpoint**: `DELETE /api/trades/{id}`
- **Parameters**:
  - `id`: Trade ID
- **Response**: No content

### Analytics Endpoints

#### Summary
- **Endpoint**: `GET /api/analytics/summary`
- **Parameters**:
  - `from`: Filter by date (from)
  - `to`: Filter by date (to)
- **Response**: Analytics response containing:
  - `kpi`: Key performance indicators
  - `equityCurve`: Equity curve time series
  - `groupedPnl`: P&L grouped by date
  - `breakdown`: P&L by strategy

## Conclusion

The TradeVault system provides a comprehensive solution for storing, calculating, and analyzing trades. The system automatically calculates various metrics for trades and provides detailed analytics through the API. This documentation should help developers understand how the system works and how to use it effectively.
