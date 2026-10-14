# Backtesting custom-period export

Implemented locally on 14 October 2026. The export uses the existing owned-workspace APIs; it needs a frontend deployment and no database migration or new backend endpoint.

Open a Backtesting workspace and select **Export data** in the workspace header. Choose inclusive start/end dates, entry-date or recorded-exit-date selection, and either the complete ZIP report or a trades-only CSV. The dialog defaults to the workspace's trade dates, or its active date bounds. Other active workspace filters apply only when their checkbox is selected. Selection uses the stored calendar dates without timezone conversion. Exit-date selection omits trades without an exit date.

The detail export includes every matching backtest/replay trade from the selected workspace across all table pages. Live sources and live scopes are excluded. Trades excluded from analytics remain in the detail CSV with their inclusion flag and exclusion reason; overview and analysis files use included trades only. Empty and invalid selections cannot be downloaded. Failed lens/screenshot requests block the complete report with a retry action; the standalone trade CSV remains available.

## Complete report

| File | Contents |
| --- | --- |
| `trades.csv` | One row per trade; every available trade API field, combined and separate entry/exit timestamps, explicit SL/TP hit dates/times, execution prices/size, cash/R results, source cumulative values, commissions, excursions, duration, strategy/setup, gap classification, tags, notes and import provenance. |
| `overview.csv` | Selected-period metrics in R and separately for each cash currency, including sample size/coverage, outcome counts, win rate, expectancy, profit factor, drawdown and losing streaks. |
| `edge-analysis.csv` | Recomputed session, direction, weekday, source, setup, entry timeframe, gap type and tag groups, with expectancy differences against the export sample. Tags and dimensions can overlap. |
| `periods.csv` | Daily, Monday–Sunday weekly and monthly metrics using the existing Calendar convention: exit date, otherwise entry date. Contains only trades in the export sample; boundary periods can be partial. |
| `saved-edge-lenses.csv` | Saved definitions and selected-period recalculated results, respecting saved entry-date bounds as well as export selection. Unsupported filter definitions are flagged instead of receiving guessed metrics. |
| `screenshots.csv` | Metadata for screenshots linked to exported trades. Image binaries and expiring signed URLs are omitted. |
| `workspace.json` | Workspace notes and strategy context, export settings, included/excluded counts and missing-data coverage. Workspace statistics are explicitly identified as an all-time snapshot; period metrics belong to `overview.csv`. |
| `README.txt` | Definitions, units, period conventions and missing-data limitations. |

The report recalculates metrics from the chosen sample using `computeResearchMetrics`, rather than copying lifetime analytics. Planned R:R and realized R remain distinct. R totals, expectancy and drawdown stay unavailable unless the complete analyzed sample has R. Cash metrics use known net PnL separately per currency with sample coverage and no FX conversion. Unknown cash/currency and timezone counts appear in the metadata. Commissions are not subtracted from already-net PnL again. Count bands describe sample size without asserting edge validation.

SL/TP hit fields use only an explicit `SL`/`TP` exit signal (including numbered targets and `Stop loss`/`Take profit`) and recorded exit date/time. A win or loss does not establish which order was hit. Planned stop/target prices and order-placement/amendment timestamps are absent from the current trade contract. Price and position-value quote currency are also not separately stored; the PnL currency does not identify them.

CSV files have stable English headers, UTF-8 BOM, comma delimiters, quoted fields, CRLF line endings, ISO dates and decimal-point numbers. Missing values remain blank. Text fields beginning with spreadsheet formula characters are prefixed with an apostrophe; numeric negative values remain numeric. ZIP creation uses the browser-compatible `fflate` package. The UI is available in English and Romanian, with a full-screen mobile dialog.

## Local verification

The focused frontend suite passed 41 tests covering the new export/dialog, existing research/calendar/page behavior and translation-key parity. TypeScript, ESLint for the changed TypeScript files, the production frontend build and `git diff --check` passed.

Browser checks used mocked API trade records derived from the supplied `Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_d9b67.csv`. That file has 50 entry/exit rows representing 25 closed trades, with PnL in USD and prices labeled EUR. The checks exercised a one-day ZIP report with three trades and the full 25-trade standalone CSV, reconciled exported execution/cash fields to the source, verified explicit SL/TP timestamps and missing R, and tested desktop/tablet/mobile English/Romanian light/dark layouts. Evidence is under `output/backtesting-export-2026-10-14/`.

These checks establish local export behavior with fixtures. No authenticated production import, backend persistence change, commit, push or deployment is part of this change.
