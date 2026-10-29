# Backtesting custom-period export

## Complete strategy-analysis package — 29 October 2026

The **Export data** dialog now defaults to **Entire workspace (all dates)** and **Complete analysis package (ZIP with images)**. A custom period and optional active trade filters remain available. Empty workspaces can export their notes and unlinked evidence. The CSV-only option remains a smaller trade-detail export; choose ZIP for a full review.

### Storage audit and exported coverage

| Stored information | Package location |
| --- | --- |
| Every public backtesting trade field: executions, dates, prices, quantities, currencies, PnL/R, costs, excursions, durations, tags, notes and import provenance | `trades.json`, `trades.csv` |
| ICT setup/quality, HTF trend/structure/location, market condition, liquidity type/side/level, sweep/structure confirmation, displacement, FVG geometry/timing/age/retest/sequence | Trade records; additional ICT breakdowns in `edge-analysis.csv` |
| Workspace description, research objectives, observations, conclusions, what worked/failed, conditions and next testing objective | `workspace.json` |
| Linked strategy rules, rich text, Studio definition, parameters, checklists and versions referenced by the selected trades; supported mentor definitions | `strategies.json` (current rules and historical snapshots explicitly separate) |
| Screenshot captions, categories/tags, timestamps, sort order and original asset metadata | `screenshots.json`, `screenshots.csv`, `attachments.json` |
| Original image/attachment files and login-free signed links | `images/`; asset ID, trade ID, screenshot ID, public URL, expiry and archive path in `attachments.json`; trade image links also in the CSV and JSON trade rows |
| Unlinked workspace screenshots | Included with `WORKSPACE` scope and a null trade ID; never guessed into a trade |
| Saved edge lens definitions, descriptions, timestamps and saved metrics | `saved-edge-lenses.json`; selected-period recalculation in `saved-edge-lenses.csv` |
| Linked live evidence, including excluded links, research classifications and live attachment relationships | `live-evidence.json`, `attachments.json`; separate from simulated trade metrics |
| Workspace analytical snapshot, including source comparison/regression fields | `analytics-snapshot.json`, explicitly marked as all-time |
| Recomputed sample metrics, calendar periods, missing-field coverage, file/count inventory and review instructions | Existing metric CSVs, `data-dictionary.json`, `manifest.json`, `ANALYSIS_GUIDE.md` |

JSON preserves original text, arrays, booleans and numbers without CSV formula escaping. Stable IDs connect trades and screenshots. Excluded research rows remain available. The schema version is 2. All-time snapshot metrics are not presented as period results. Live comparison evidence follows the selected dates only, not other research filters. Workspace notes and unlinked screenshots are workspace-wide context even for a custom period.

### Image access and failure behavior

The backend authorizes the workspace before reading its export context and authorizes each asset before creating a link or streaming its bytes. The export does not make the bucket public or export a login token. Anyone holding a signed object URL can read that object for up to seven days; temporary storage credentials can shorten that lifetime. The UI states this before download. Original files remain usable from the ZIP after the links expire.

`GET /api/backtesting/workspaces/{id}/export-context` refreshes the workspace, all trade rows (without table pagination), screenshots, lenses, analytics and owner-scoped live evidence. `POST /api/assets/{id}/export-link` signs an HTTPS object URL. `GET /api/assets/{id}/export-content` streams authorized bytes without a storage redirect, avoiding browser bucket-CORS dependencies. All responses are private/no-store. Existing storage credentials must permit object signing and retrieval; no migration or new public application route is required.

A failed context, referenced strategy/version, asset signing or binary download blocks the complete archive. Expected screenshot-count mismatches also block it. Attachments are fetched sequentially and deduplicated by asset ID. A 250 MiB binary limit produces an explicit message to select a smaller period; files are never silently truncated. Workspace-wide images and strategy assets still apply to a smaller period.

### Limits established by the audit

The current backtesting model does not store planned SL/TP prices, the full order amendment history, candle/tick/order-book histories or the original CSV file bytes. These cannot be recovered by an export. Imported signal text and all persisted parsed fields are retained. External links embedded in notes remain exact text; their target content is not fetched or guaranteed public. Historical strategy asset references remain in version snapshots; binaries include currently attached assets, not deleted historical files. The Evidence tab now provides a Linked trade selector for each screenshot (including an option to detach it). Linking and category changes preserve its caption, session, timeframe, tags and order. Workspace evidence remains explicitly unlinked where no trade association exists.

### Validation and delivery

Focused frontend tests cover archive contents, exact notes, image relationships/binaries, workspace isolation, unlinked evidence, live exclusions, mentor and historical strategy context, failures, period selection, dialog behavior and translations. Backend tests cover workspace ownership, asset authorization before signing/reading, signed-link lifetime and streaming. TypeScript, targeted ESLint and the frontend production build pass. The PostgreSQL replay integration suite is opt-in and was skipped because no disposable test database was configured. Production storage/public URL accessibility has not been exercised in this session. Both frontend and backend changes need deployment.

The original implementation notes below describe the earlier schema-v1 report and its historical validation.

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

SL/TP hit fields use only an explicit `SL`/`TP` exit signal (including numbered targets and `Stop loss`/`Take profit`) and recorded exit date/time. A win or loss does not establish which order was hit. Planned stop/target prices and order-placement/amendment timestamps are absent from the current trade contract. After the dynamic TradingView import update (Flyway V76), price currency is exported independently from PnL currency. Older rows may have an unspecified price currency. Position-value currency is not separately stored.

CSV files have stable English headers, UTF-8 BOM, comma delimiters, quoted fields, CRLF line endings, ISO dates and decimal-point numbers. Missing values remain blank. Text fields beginning with spreadsheet formula characters are prefixed with an apostrophe; numeric negative values remain numeric. ZIP creation uses the browser-compatible `fflate` package. The UI is available in English and Romanian, with a full-screen mobile dialog.

## Local verification

The focused frontend suite passed 41 tests covering the new export/dialog, existing research/calendar/page behavior and translation-key parity. TypeScript, ESLint for the changed TypeScript files, the production frontend build and `git diff --check` passed.

Browser checks used mocked API trade records derived from the supplied `Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_d9b67.csv`. That file has 50 entry/exit rows representing 25 closed trades, with PnL in USD and prices labeled EUR. The checks exercised a one-day ZIP report with three trades and the full 25-trade standalone CSV, reconciled exported execution/cash fields to the source, verified explicit SL/TP timestamps and missing R, and tested desktop/tablet/mobile English/Romanian light/dark layouts. Evidence is under `output/backtesting-export-2026-10-14/`.

These checks establish local export behavior with fixtures. No authenticated production import, backend persistence change, commit, push or deployment is part of this change.
