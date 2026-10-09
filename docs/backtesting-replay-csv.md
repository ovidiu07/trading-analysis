# TradingView Replay CSV import and monetary backtesting analytics

Implemented locally on 9 October 2026. Deploy the backend, frontend and Flyway V75 together.

## Import workflow

Open a backtesting workspace, select **Import**, choose the replay CSV, check the instrument and optionally enter the export's IANA timezone. Select **Preview import** to inspect the closed trade count, duplicate count, validation issues and the first five valid trades. **Import N trades** saves the valid trades; rejected pairs remain excluded. Results stay visible until dismissed.

The existing TradeJAudit CSV format remains supported. Replay detection uses `Type`, `Date and time`, and `Trade number` / `Trade #` headers, plus the currency-qualified net PnL column.

The instrument is inferred from both original dated TradingView filenames, such as `Replay_Trading_PEPPERSTONE_GER40F_2026-10-09_0eb11.csv`, and consolidated date-range filenames. Both resolve to `PEPPERSTONE:GER40F`. It is retained even when the workspace is labeled `GER40U2026`. Renamed replay exports need an explicit instrument because the CSV does not contain one; the dialog explains where to enter it when detection fails. A mismatch warning appears in the review; importing does not rename the workspace. The date in the filename is not used as the trade date.

## Pairing and duplicate protection

- Entry and exit rows are paired chronologically within each exported trade number. Trade numbers may restart across the combined replay runs; they are not treated as globally unique identifiers.
- Row order can be reversed. Matching validates direction, quantity and duplicated trade-level monetary values.
- Orphan entries, orphan exits, ambiguous overlapping entries, inconsistent pairs, nonpositive prices/quantities and partial exits are rejected with row-level issues. The supported format represents closed positions with one entry and one exit.
- Trade PnL is taken once from the exit row. Commissions are reported separately and are not subtracted from already-net PnL again.
- Import fingerprints use the instrument, currency, entry/exit timestamps, direction, prices and quantity. Reimporting the same execution into the same workspace skips it, even if the filename or trade number changes. A conflicting net PnL is reported for review.
- A unique database index prevents duplicate execution fingerprints within a workspace.
- CSV files are bounded at 10 MB and 20,000 data rows. UTF-8 BOMs are accepted. Preview reparses the selected file but performs no persistence; the final import revalidates duplicates against current data.

## Preserved trade data

Each replay trade retains entry/exit dates and clock times, prices, quantity, position value, currency, net PnL, trade return percentage, commission, favorable and adverse excursions and percentages, duration in bars, entry and exit signals, reported cumulative values, source filename, source trade number and optional timezone.

Replay trades have source `IMPORT` and scope `REPLAY`. They do not create live broker trades. Execution identity and result are preserved when editing; contextual classification, notes and an explicitly entered R can still be edited. Missing classifications are shown as partial, and absent rule adherence information is not reported as zero violations.

## Analytics

Currency-based metrics include net PnL, winning and losing PnL sums, win rate, expectancy per trade, profit factor, average/largest winner and loser, realized maximum drawdown, losing streaks, commissions, average holding time, duration in bars and favorable/adverse excursions.

The overview supports a performance-unit selector. Each currency is analyzed independently; no FX rate is invented. Coverage explains how many filtered trades contribute to that currency. R metrics stay unavailable for an incomplete R sample and never treat monetary PnL or missing R as zero R.

Equity and drawdown are rebuilt from closed-trade results ordered by exit time. Export cumulative columns are retained for audit, because they reset between replay runs. Charts retain every closed-trade observation and start at zero. These curves are cumulative realized PnL, not account balances or account return percentages.

Breakdowns cover exit date, entry hour, entry weekday, direction, session, instrument, exit reason, source and backtest/replay/live scope. The overview, charts, source comparison and edge analysis follow the active trade filters. Live regression uses the complete workspace and is labeled when filters are active. R-based live/historical regression is unavailable when either sample lacks R.

Timestamps are retained as exported local clock times. The optional timezone is metadata, not a request to shift dates or session labels. Holding time uses the difference between exported clock timestamps, including overnight/weekend gaps. Comparing exports from different clock conventions requires normalizing their times first; DST and account-equity percentages are not inferred. Session, strategy/setup, initial stop, initial risk and planned R:R are absent from this CSV and are not guessed.

English and Romanian labels cover the import, metrics, breakdowns, limitations and trade-detail view. The existing desktop/mobile workspace structure is retained.

## Supplied CSV acceptance values

The exact supplied file is retained as a regression fixture in `backend/src/test/resources/backtesting/tradingview-replay-ger40f.csv`.

| Metric | Expected |
|---|---:|
| Execution rows | 50 |
| Completed trades | 25 |
| Wins / losses / breakevens | 15 / 10 / 0 |
| Win rate | 60% |
| Net PnL | EUR 1,768.40 |
| Winning PnL sum | EUR 2,920.60 |
| Losing PnL sum | EUR 1,152.20 |
| Expectancy | EUR 70.74 per trade |
| Profit factor | 2.53 |
| Realized maximum drawdown | EUR 265.00 |
| Average winner / loser | EUR 194.71 / -115.22 |
| Largest winner / loser | EUR 602.50 / -133.00 |
| Maximum losing streak | 2 |
| Reported commissions | EUR 0.00 |
| Average holding time, export clock | 188 minutes |
| Average duration | 12.32 bars |
| Average favorable / adverse excursion | EUR 159.68 / -79.30 |
| R, initial stop/risk, account return | Unavailable |

These are replay results, not live execution or proof of a persistent trading edge.

## Verification

Focused unit tests cover the exact CSV, restarted trade numbers, reversed ordering, duplicate rows and reimports, BOM, orphan rows, partial exits, inconsistent copies, renamed files, explicit timezone, currency separation, missing/partial R and realized drawdown order. Frontend tests cover matching monetary calculations, filters, legacy R calculations and preview/save/error/duplicate UI states.

`BacktestingReplayFlowIntegrationTest` is opt-in through `REPLAY_TEST_DB_URL` and `REPLAY_TEST_DB_USER`, targeting a disposable PostgreSQL database. It exercises authenticated preview, save, reload, repeated import, real analytics, workspace library, legacy manual R coexistence, anonymous rejection and another user's workspace rejection. No production account or data is involved.

Fresh database validation applied all migrations through V75 and passed application schema validation. A separate transactional migration probe preserved a legacy R row, accepted a monetary row with missing R, and rejected a duplicate execution fingerprint.

A real local frontend/backend browser run checks the actual supplied file through preview/import/reload, duplicate preview, active loss filtering in source comparison, trade details, and desktop/mobile English/Romanian rendering. Screenshots and results are local verification artifacts. Deployment and production import are separate steps.

On 9 October 2026, all 44 focused backend tests and 15 frontend tests passed, together with ESLint, TypeScript and the production build. The real local browser checks passed with no page errors, failed application requests or desktop/mobile page overflow. Detailed counts and verification screenshots are saved under `output/backtesting-replay-csv-2026-10-09/`.
