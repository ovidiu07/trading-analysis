# Backtesting calendar — 11 October 2026

Implemented in the local checkout at `/Users/ovidiu/Documents/trading-analysis`.

## Using the feature

Open **Backtesting**, select a workspace, then choose **Calendar** from the workspace tabs (the section selector on phones).

- Starts at the latest backtest/replay trade's result month. Previous/next, month input, and Latest trade provide navigation.
- Uses the main Calendar's Monday-first layout, profit/loss colors, rounded day tiles, and compact day rows.
- Days show trade counts, the selected R/currency result, and data coverage. Selecting a day opens its trades, R/cash values, entry/exit information, setups, planned R:R, and notes. Imported trades can open the existing Replay details dialog.
- Monthly summary shows R, cash in the selected currency, completed trades, and win rate.
- Each week shows trade count, win rate, R, cash, and metric coverage. Phones use cards so R and cash remain visible together. Selecting a week opens its trades.
- Best weeks/months rank up to five periods by the selected R/currency result. Selecting a ranking opens that period's trades and moves the calendar to it.
- Search, date, source, result, direction, session, and classification filters are inherited from the workspace.

## Calculation rules

- Only trades belonging to the selected workspace, included in analytics, and outside LIVE scope/source enter this calendar.
- Results use `exitDate` when present; otherwise the recorded `date`. Dates remain local date strings from the data; there is no timezone conversion. Existing workspace date filters continue to filter the recorded trade date.
- Calendar weeks run Monday–Sunday. Weekly summaries at month boundaries include only the visible month's dates. Rankings aggregate complete calendar week/month ranges across the filtered sample, which can contain partially tested periods.
- R totals are unavailable for a period if any of its trades lacks R. Empty periods show unavailable, and known zero remains zero. Rankings omit periods without the selected metric.
- Cash is grouped by currency and sums known `netPnl` values. Coverage is displayed explicitly; no currency conversion or inferred risk/R is performed. Commissions are not subtracted a second time.
- Request failures show a retryable error; they do not render an empty-success calendar.

## Validation

- Full frontend suite: **81 files passed; 416 tests passed, 10 skipped**.
- After final mobile and trade-card refinements: **20 focused tests passed** across calendar aggregation, calendar interactions, BacktestingPage integration, and translation parity.
- TypeScript check and ESLint passed for implementation files.
- Production build passed (`npm run build` initially; TypeScript plus Vite production build after the final refinements). Vite still reports its existing large-chunk warning.
- `git diff --check` passed.
- Browser checks: **1440px English/dark, 768px English/light, 390px Romanian/light, 375px English/dark**. All had no document/body horizontal overflow, five weekly summaries, working day drilldown, and no page runtime errors. The final mobile cards and dialogs were rendered and inspected.

Browser API responses were mocked from the repository's 25-trade GER40 replay CSV fixture. These checks prove local rendering/interactions, not backend authentication, persistence, deployment, or live execution. No new API or database migration was needed: the calendar uses the existing authorized workspace trade endpoint. The fixture is used only in the QA script, not application code.

The normal build refreshed dates in generated public SEO files; those unrelated generated changes were restored. Pre-existing environment changes and untracked Python/tests files were preserved.

## Artifacts

- [Desktop calendar](desktop-en-dark.png)
- [Desktop day details](desktop-en-dark-day.png)
- [Tablet calendar](tablet-en-light.png)
- [Romanian mobile calendar](mobile-ro-light.png)
- [Romanian mobile weekly cards](mobile-ro-light-weekly.png)
- [Romanian mobile day details](mobile-ro-light-day.png)
- [English mobile calendar](mobile-en-dark.png)
- [Machine-readable browser results](browser-checks.json)
- [Reproducible browser QA script](browser-qa.mjs)

To reproduce the browser checks, start Vite on `127.0.0.1:5174` with `VITE_API_URL=/api`, then run the QA script with Node. The script uses the bundled Playwright runtime and installed Chrome in isolated contexts.
