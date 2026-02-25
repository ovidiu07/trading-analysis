# Backtest Engine Audit (Current Pipeline Before Overhaul)

This document audits the current implementation used by Backtest Lab before the SMC sweep/displacement/MSS overhaul.

## Scope and Entry Points
- API controller: `backend/src/main/java/com/tradevault/controller/BacktestLabController.java`
- Engine/service: `backend/src/main/java/com/tradevault/service/backtest/BacktestLabService.java`
- CSV ingest: `backend/src/main/java/com/tradevault/service/backtest/BacktestCsvService.java`
- Candle retrieval/storage: `backend/src/main/java/com/tradevault/service/backtest/CandleDataService.java`, `CandleChunkStoreService.java`, `CandleChunkCodec.java`
- Strategy builder UI: `frontend/src/features/backtest/BacktestLabWizard.tsx`
- Frontend API types: `frontend/src/api/backtest.ts`

## 1) CSV ingestion and timestamp normalization
- Upload + preview parses CSV in `BacktestCsvService.upload`.
- Full ingest is done in `BacktestCsvService.ingest`.
- Timestamp parsing (`parseTimestamp`) supports epoch seconds, epoch milliseconds, ISO timestamp, local datetime formats, and date-only values.
- All parsed times are normalized to UTC `OffsetDateTime` using `.withOffsetSameInstant(ZoneOffset.UTC)`.
- Candle timestamp semantics in the system are candle **open times** (the parsed row timestamp is used directly as `tsUtc` in `CanonicalCandle`).

## 2) Candle storage/query and timeframe alignment
- Persisted in `candle_chunks` via `CandleChunkStoreService.saveCandles`.
- Data is gzip-JSON encoded/decoded by `CandleChunkCodec`.
- `CandleDataService.getCandles` loads candles by user/provider/source/symbol/timeframe/range.
- Backtest engine selects execution dataset via `chooseExecutionDataset`:
  - exact timeframe if available,
  - else lower/equal TF + resample,
  - else fallback to smallest available TF.
- Resampling (`resampleCandles`) buckets by epoch seconds and uses the bucket start as bar timestamp.

## 3) Session segmentation logic
- Session config is parsed by `parseSessions` and defaults from `defaultSessions`.
- Run uses one setup session (`setupRule.session` or request `sessionFilter`), resolved by `resolveSessionWindow`.
- Candle-to-session assignment uses `assignSession` with zone conversion and overnight handling.
- DST is handled implicitly by `ZoneId` conversion.
- Current defaults are broad session windows and currently include `ASIA`, `LONDON`, `NY` (not split into `NY_AM`/`NY_PM`).

## 4) Liquidity pool logic (current)
- There is no explicit persisted pool model in run logic.
- Levels are reduced to a single high/low pair from `resolveLevels`:
  - `SESSION_HL`, `EQH_EQL`, `HTF_SWING` all map to previous setup-session high/low.
  - `PDH_PDL` maps to previous day high/low.
- No configurable EQH/EQL pivot-touch clustering, pool ranking, min touches, min age, or separation bars are implemented yet.

## 5) Sweep detection logic (current)
- Per-candle sweep check in `detectSweep`.
- Sweep is detected on the **first qualifying candle** that breaches level + tolerance and closes back across level.
- Depth is computed from that same candle (not from full excursion after first breach).
- Sweep time stored is current candle timestamp (`candle.timestamp()`).
- This explains mismatches where timeline anchors to an earlier micro-sweep candle instead of later wick extreme.

## 6) Displacement detection (current)
- `findDisplacementIndex` scans up to 20 bars after sweep candle.
- Uses body ratio (`bodyRatio`) vs lookback average and threshold `qualityFilters.displacementMultiplier`.
- Directional check is tied to close moving away from level.
- No explicit min body in pips, max delay config, attacked-level model, or "clean immediate displacement" strictness controls beyond ratio and anti-chop.

## 7) MSS/BOS logic (current)
- Pivot state from `computePivots(left,right)`.
- Confirmation index found by `findConfirmIndex` with close beyond last pivot plus optional buffer.
- `confirmationType` exists in config but current flow uses shared pivot-break mechanics.
- No configurable swing detection method variants (fractals / pivot_n / swing_hl), anchor mode, or displacement-to-MSS strict delay control.

## 8) Entry/Exit and execution realism (current)
- Entry model in `resolveEntry`:
  - `MARKET_ON_CONFIRM_CLOSE`
  - `LIMIT_RETRACE_PERCENT` over displacement candle range with `entryWindowBars`.
- Stop model in `resolveStop`:
  - `LAST_SWING_PLUS_BUFFER` or sweep extreme +/- buffer.
- TP is fixed R (`resolveTakeProfit`).
- Exit in `resolveExit` checks SL/TP per candle (same-bar SL+TP resolves to SL conservatively).
- Spread/slippage is applied as half-cost at entry + exit (`applyEntryCost`/`applyExitCost`) from `context.spreadPips` and `context.slippagePips`.
- No explicit fill policy toggle (MID vs BID/ASK simulation) yet.

## 9) Timeline generation and event output
- Timeline is built in `buildTimeline` / `buildNoFillTimeline` and stored in trade evidence JSON.
- `SWEEP` details currently include only `side`, `level`, `depth`; no separate `poolLevel` vs `sweepExtremePrice` fields.
- Sweep event time currently uses `sweep.sweepTime()` from first qualifying sweep candle.
- Timeline is returned to UI via `toTradeResult` into `BacktestLabTimelineEventResponse`.

## 10) UI rendering and potential confusion
- Strategy UI + results are in `frontend/src/features/backtest/BacktestLabWizard.tsx`.
- Timeline drawer renders raw `JSON.stringify(event.details)`.
- Because sweep details include `level` and `depth` only, users can misread level as the actual swept wick price.
- There is no separate explicit display field for sweep extreme timestamp/price.

## Observed mismatch root cause (Feb 4 case)
- The current sweep model is first-breach candle anchored, not excursion-anchored.
- The engine can emit an earlier breach candle (e.g., `2026-02-04T08:00:00Z`) even when a later candle (`2026-02-04T08:10:00Z`) makes the true sweep extreme.

## Summary of required fix direction
- Promote pool detection to first-class configurable objects.
- Track breach excursion and store both:
  - targeted pool level,
  - true sweep extreme price/time.
- Tighten displacement/MSS sequencing with explicit max-delay and structure anchors.
- Emit clear timeline fields so UI distinguishes pool level from sweep extreme.
