# Account Growth Coach

## Purpose

The Account Growth Coach is an account-scoped planning and risk-coaching workspace at `/coach`. It is a journaling and analytics feature, not a return promise or financial-advice product.

The page deliberately separates:

- realised target progress: net P&L from trades closed inside the selected account month;
- current equity context: realised balance plus available floating P&L;
- target completion: realised P&L only;
- open exposure: every trade whose current canonical status is `OPEN`, even if it was opened before the selected month.

## Architecture and data flow

The implementation uses the existing Spring Boot/PostgreSQL/JPA backend, canonical `Account` and `Trade` ownership, React/MUI frontend, Recharts, and EN/RO i18n.

`GrowthCoachService` composes `AnalyticsService.summarize(...)` for the current-month closed-trade analytics already used by Analytics. It does not introduce a second current-month KPI source. The growth-coach service owns the feature-specific calculations that did not previously exist:

- ledger-aware account balances;
- locked month-start snapshots and monthly targets;
- all-current-open-trade quote, floating-P&L, and stop-risk calculations;
- drawdown, daily-loss, concurrent-risk, and futures-contract caps;
- confidence, feasibility, scenario, and bootstrap projection results;
- central scenario selection through `GrowthCoachMessageEngine`.

The account timezone is selected in this order:

1. account/broker timezone;
2. user timezone;
3. `Europe/Bucharest`.

A closed trade belongs to a month by `closedAt` in that timezone. Open exposure is never filtered by month or by exploratory Analytics filters.

## Persistence and migration

Flyway migration `V60__account_growth_coach.sql` adds:

- `account_growth_profiles`: one owned profile per account;
- `monthly_growth_plans`: one immutable-start snapshot and target per account/month;
- `monthly_growth_plan_revisions`: audit history for target changes;
- `account_ledger_events`: auditable deposits, withdrawals, payouts, fees, resets, and adjustments;
- account/month/status/time indexes used by the composed page query.

All tables use `(account_id, user_id)` ownership foreign keys back to the canonical account. Existing accounts and Analytics data are not rewritten.

For an existing account, the first request creates a safe default profile. Initial capital is copied only from the existing account starting balance. If it is absent, capital remains unknown.

The first monthly plan reconstructs:

```text
month start balance =
  configured initial capital
  + non-trade ledger events before month start
  + net P&L from valid trades closed before month start
```

It is stored with `snapshot_source = RECONSTRUCTED` and locked. Later history edits do not silently rewrite it. Target changes create revision rows and set `target_changed_at`.

Rollback should be handled by a forward Flyway migration in deployed environments. The new tables can be dropped without changing legacy trade/account columns, but their audit history should be exported before any destructive rollback.

## Ledger calculation

TradeJAudit's canonical `pnlNet` is treated as already net of trade costs. Fees are not subtracted from it again.

```text
current realised balance =
  initial capital
  + signed non-trade ledger total
  + lifetime closed-trade net P&L

current equity =
  current realised balance
  + available floating P&L
```

`INITIAL_CAPITAL` ledger entries are a fallback source and are not included again in the ledger total. Debit event types are normalized to negative values. Ledger currency must equal account currency; the service does not fabricate FX conversions.

## Open trades and live prices

The existing `QuoteService` is reused. A long position is marked using bid; a short position is marked using ask.

```text
open risk =
  abs(entry - protective stop)
  × remaining quantity
  × contract multiplier

floating P&L (long) =
  (bid - entry) × quantity × multiplier

floating P&L (short) =
  (entry - ask) × quantity × multiplier
```

If a quote, entry, quantity, multiplier, or valid protective stop is unavailable:

- the affected value is `null`, not zero;
- total open risk becomes `UNKNOWN` when any active position has unknown risk;
- confidence is reduced;
- a critical centralized coach message is generated;
- new risk is not presented as safely available.

The current trade model has no separate floating-P&L column. If OANDA is not connected or a symbol is unsupported, current equity is shown as unavailable rather than fabricated.

## Risk engine

The recommended risk amount is the minimum of:

- the user's planned base risk;
- the monthly hard maximum;
- remaining daily allowance divided by remaining planned trades today;
- remaining drawdown buffer divided by historical maximum losing streak plus the configured safety buffer;
- remaining concurrent-risk capacity;
- futures contract capacity.

Trailing drawdown uses the configured high-water mark and trailing amount. Static drawdown uses initial capital less the configured total limit. Challenge deadlines shorten the available trading-day count.

The engine never raises risk because the account is behind target.

## Projections and feasibility

Projection samples are selected in this order:

1. trailing 50 valid R outcomes;
2. trailing 20 valid R outcomes;
3. all valid outcomes.

Expected trades and trading days are shown only when expectancy and recommended risk are positive. Bootstrap projections use 5,000 deterministic simulations by default and model future outcomes from the account's own valid R distribution. Open exposure reduces rule capacity but floating profit is not pre-counted as target completion.

Configuration:

```text
GROWTHCOACH_PROJECTION_MIN_SAMPLE=20
GROWTHCOACH_SIMULATION_COUNT=5000
GROWTHCOACH_LOSING_STREAK_BUFFER=2
```

Probability output is suppressed when capital, open risk, sample size, or expectancy is unreliable.

## API

```text
GET    /api/growth-coach?accountId={uuid}&month=YYYY-MM
GET    /api/growth-coach?month=YYYY-MM
PUT    /api/growth-coach/accounts/{accountId}/profile
PUT    /api/growth-coach/accounts/{accountId}/plans/{monthKey}
PUT    /api/growth-coach/accounts/{accountId}/period-plans/{periodType}/{periodKey}
POST   /api/growth-coach/accounts/{accountId}/ledger
PUT    /api/growth-coach/accounts/{accountId}/ledger/{eventId}
DELETE /api/growth-coach/accounts/{accountId}/ledger/{eventId}
```

The account-less GET returns per-account portfolio cards and intentionally omits a combined risk recommendation.

## Daily, weekly, and monthly operating plans

`account_period_plans` stores independently editable `DAY`, `WEEK`, and `MONTH` plans. Daily and weekly plans support `AUTOMATIC` allocation from the remaining monthly target or a `MANUAL` custom override. The monthly editor exposes both allocation policies together, while the daily and weekly editors retain independent override control. Automatic allocation changes only the planning reference; it never raises risk because performance is behind target.

The selected period controls the edit action, period picker, analytical summary, chart axis, and period status. Current trading permission is calculated separately from the selected period status. A daily lockout can therefore coexist with a weekly loss that remains within its limit or a completed monthly target.

User-facing target completion is floored at zero when realised P&L is negative. The response also exposes distance to breakeven, distance to target, target surplus, loss-limit utilisation, and remaining loss capacity as separate metrics. Current permitted risk, recommended risk after trading resumes, and the theoretical account maximum are distinct fields.

Simple chart mode is the default and shows cumulative realised trading P&L, the selected target, and the selected maximum loss. Today uses trade-close times; week uses weekdays; month uses calendar dates. Balance, equity, planned pace, risk, and event markers remain optional advanced series.

## Message catalogue

`GrowthCoachMessageEngine` is the single deterministic scenario selector. It returns:

- stable scenario keys;
- category, severity, priority, and blocking state;
- translation keys;
- interpolation values;
- recommended action keys.

The React page resolves all text from matching English and Romanian catalogues. Critical rule or unknown-risk messages are ranked first. Target-reached conditions suppress behind-target messages, and no scenario recommends increasing risk to recover.

## Testing

Focused coverage includes:

- target, progress, expectancy, profit factor, break-even rate, required R, expected trades/days, open risk, and drawdown math;
- negative-result completion, breakeven distance, target distance, target surplus, and loss utilisation;
- automatic daily/weekly target derivation, custom overrides, period analytical status, risk-now versus resume risk, and adherence coverage;
- message priority, target-reached suppression, and negative-expectancy behavior;
- close-time month inclusion, prior-month open-trade exposure, unknown-risk handling, and account ownership;
- mobile UI rendering, contextual daily/weekly/monthly editing, all-plan management, simple/advanced chart modes, negative progress, adherence coverage, missing-stop warnings, and active trades;
- EN/RO key parity and production TypeScript/Vite compilation.

## Current model boundaries

- Partial closes and multi-entry positions follow the canonical importer output. The coach does not invent sub-position data that is absent from `Trade`.
- No reliable cross-currency aggregation is attempted. Account-level calculations use the account's canonical currency.
- Correlation warnings are limited to symbol concentration because the repository does not currently contain a reliable instrument-correlation taxonomy.
- Historical equity snapshots before this migration cannot include historical floating P&L; reconstructed month starts therefore use realised ledger history and carry reduced confidence.
