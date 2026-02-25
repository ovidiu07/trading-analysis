# Backtest Engine Audit (Current State Before Requested HQ Changes)

This audit documents the implementation state *before* applying the requested realistic SMC sequencing, UTC-only rendering hardening, and optimizer workflow.

## Scope and entry points
- Controller: `backend/src/main/java/com/tradevault/controller/BacktestLabController.java`
- Core engine: `backend/src/main/java/com/tradevault/service/backtest/BacktestLabService.java`
- CSV parsing/ingest: `backend/src/main/java/com/tradevault/service/backtest/BacktestCsvService.java`
- Candle load/storage: `backend/src/main/java/com/tradevault/service/backtest/CandleDataService.java`, `CandleChunkStoreService.java`, `CandleChunkCodec.java`
- Strategy UI: `frontend/src/features/backtest/BacktestLabWizard.tsx`
- Frontend contracts: `frontend/src/api/backtest.ts`
- Existing test coverage: `backend/src/test/java/com/tradevault/service/backtest/BacktestCsvServiceTest.java`, `BacktestLabServiceTest.java`, `frontend/src/features/backtest/BacktestLabWizard.test.tsx`

## 1) CSV parsing and timestamp normalization
- Upload preview path: `BacktestCsvService.upload(...)`
- Ingest path: `BacktestCsvService.ingest(...)`
- Parser flow: `parseCsv(...) -> parseRow(...) -> parseTimestamp(...)`
- `parseTimestamp(...)` supports:
  - epoch seconds/milliseconds
  - ISO offset timestamp
  - local datetime formats (with optional timezone override)
  - ISO local date (interpreted at start of day)
- Timestamps are normalized to UTC (`ZoneOffset.UTC`) during parse.
- Candle semantics are candle open-time semantics; parsed row timestamp is persisted as `CanonicalCandle.tsUtc`.
- Deterministic fixture already validated in tests:
  - `BacktestCsvServiceTest.ingestFixtureCsvKeepsCandleOpenTimestampAndExactOhlcForKnownBar`
  - expected M5 candle `2026-02-04T08:10:00Z` OHLC `1.18314 / 1.18380 / 1.18300 / 1.18350`.

## 2) Candle storage/query and timeframe alignment
- Persisted in `candle_chunks` through `CandleChunkStoreService.saveCandles(...)`.
- Query path: `CandleDataService.getCandles(...)`.
- Dataset selection logic: `BacktestLabService.chooseExecutionDataset(...)`.
  - exact timeframe -> preferred
  - otherwise highest <= requested timeframe, then resample
  - fallback to smallest available timeframe
- Resampling path: `BacktestLabService.resampleCandles(...)` (bucket by epoch seconds to target timeframe boundary).
- Output candles sorted ascending by UTC timestamp before simulation.

## 3) Session segmentation (UTC/DST behavior)
- Session parse: `BacktestLabService.parseSessions(...)`
- Defaults: `defaultSessions(...)` currently ASIA/LONDON/NY_AM/NY_PM windows in UTC.
- Session assignment: `assignSession(...)` converts by `ZoneId.of(session.zoneId)`, supports overnight windows.
- DST handling is implicit via `ZoneId` conversion.
- Run-level filter:
  - setup/fallback session via `resolveSessionWindow(...)`
  - evaluation session set via `resolveEvaluationSessions(...)`

## 4) Liquidity pool detection and ranking
- Pool build pipeline:
  - context/session/day/week pools: `buildContextPools(...)`
  - EQH/EQL clusters: `buildEqPools(...)`
  - activation filter (age): `resolveActivePools(...)`
- Config fields currently consumed:
  - `poolTypesEnabled`, `poolTimeframeForDetection`, `poolTouchTolerancePips`, `poolMinTouches`, `poolMinSeparationBars`, `poolMinAgeBars`, `poolRankRule`
- Ranking behavior:
  - score computed in `computePoolRankScore(...)`
  - candidate selection in `selectSweepCandidate(...)`
- Gap identified:
  - current rank options do not yet include requested `"MOST_TOUCHES_THEN_RECENCY"` label.
  - min-separation default currently 3, min-age 2, while HQ target defaults are stricter.

## 5) Sweep detection (first breach vs excursion)
- Entry method: `detectSweep(...)`
- Excursion tracking: `trackSweepExcursion(...)`
  - tracks `firstBreachTime/Price`
  - tracks true extreme `sweepExtremeTime/Price`
  - optional reclaim close requirement (`sweepRequiresReclaim`)
  - enforces min depth and max duration
- Current stored fields include:
  - pool level/type/id
  - first breach
  - sweep extreme + time
  - depth
- Candidate selection rules currently implemented:
  - default depth-first / rank tie-break
  - `NEWEST_SESSION_LEVEL`
  - `HIGHEST_RANKED_POOL`
- Gap identified:
  - requested rule label `"MAX_DEPTH_THEN_BEST_RANKED_POOL"` is not implemented as named option.

## 6) Displacement detection (gap/no-gap strictness)
- Method: `findDisplacementSignal(...)`
- Current checks:
  - occurs after sweep end within `displacementMaxDelayBarsAfterSweep`
  - min absolute body (pips)
  - body vs average multiplier
  - directional close (bullish/bearish body)
  - optional close beyond attacked level
  - optional no instant overlap check
- Diagnostics currently emitted:
  - `displacementBodyPips`, `displacementRatio`, `attackedLevel`
- Gaps identified:
  - no `displacementType` mode (`GAP_REQUIRED` / `GAP_OPTIONAL` / `NO_GAP_ONLY`)
  - no explicit gap/FVG definition mode (`THREE_CANDLE_FVG`, `TWO_CANDLE_GAP`)
  - no `gapSizePips` diagnostics fields yet.

## 7) MSS/BOS/CHOCH structure confirmation
- Method: `findMssSignal(...)`
- Anchor resolution: `resolveMssAnchor(...)` with modes:
  - last pivot (default)
  - displacement origin
  - internal structure
- Current behavior:
  - triggers immediately on break beyond anchor (close/high/low depending config)
  - no multi-candle post-trigger confirmation streak
  - no separate trigger time vs confirm time fields
- Gaps identified:
  - missing `mss_min_confirm_candles` and `mss_max_confirm_window_bars` semantics
  - missing invalidation rule handling (`CLOSE_BACK_THROUGH_LEVEL`) over confirm window.

## 8) Entry/exit simulation realism (retrace, fills, spread/slippage)
- Entry method: `resolveEntry(...)`
  - `MARKET_ON_CONFIRM_CLOSE`
  - `LIMIT_RETRACE_PERCENT` using impulse range and `entryWindowBars`
- Stops/TP:
  - `resolveStop(...)`, `resolveTakeProfit(...)`, fixed-R model
- Exit simulation:
  - `resolveExit(...)` candle-by-candle no-lookahead
  - conservative same-bar SL/TP conflict resolves to SL
- Costs:
  - `applyEntryCost(...)`, `applyExitCost(...)`
  - costs disabled under `fillPolicy=MID`, otherwise spread+slippage is applied
- Gaps identified:
  - no explicit post-displacement retrace gate (`retrace_required`, reference type, timeout).

## 9) Timeline/report output and time semantics
- Timeline emitters:
  - `buildTimeline(...)`
  - `buildNoFillTimeline(...)`
  - serialized via `timelineNode(...)`
- Timeline parse/DTO map:
  - `toTradeResult(...)` + `parseOffset(...)`
  - DTO `BacktestLabTimelineEventResponse.timeUtc` currently `OffsetDateTime`
- Times are persisted/returned in UTC offset, but not strictly typed as `Instant`.
- Report markdown includes event times via `buildReportMarkdown(...)`.
- Gap identified:
  - API emits UTC values, but frontend currently re-renders with local timezone conversion.

## 10) Strategy Builder UI fields/defaults/hints validation
- Main component: `BacktestLabWizard.tsx`
- Current state:
  - exposes many SMC parameters but as flat sections
  - includes basic warnings but not full helper/hint taxonomy for every field
  - timeline timestamps use `new Date(...).toLocaleString()` (local timezone conversion)
  - timezone selector still offers non-UTC options
- Gaps identified against requested HQ UX:
  - missing grouped HQ sections requested (Sessions/Killzones, Pool Definition, Sweep, Displacement, MSS, Retrace, Execution, Optimizer)
  - missing per-field helper + why-it-matters + trade-off hint model
  - missing dedicated “HQ Default preset” control with all requested values
  - missing optimizer UI and persisted variant result table.

## Additional audit notes
- CSV fixtures are already present in repo at:
  - `backend/src/test/resources/fixtures/backtest/OANDA_EURUSD_5_89c7a.csv`
  - `backend/src/test/resources/fixtures/backtest/OANDA_EURUSD_15_598b2.csv`
  - `backend/src/test/resources/fixtures/backtest/OANDA_EURUSD_60_18989.csv`
- Existing tests already cover:
  - fixture candle parse correctness
  - sweep extreme anchoring for Feb 4 scenario
  - basic sweep->displacement->MSS ordering
- Missing tests for requested scope:
  - displacement gap definitions/modes
  - multi-candle MSS confirmation rules
  - retrace gating + timeout behavior
  - UTC-only timeline rendering on frontend
  - optimizer deterministic variant ranking/aggregation.
