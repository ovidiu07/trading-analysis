# Backtest Audit (Current Implementation Before Refactor)

## Scope and Method
This audit is based on direct inspection of current code paths in:
- Backend: `BacktestLabController`, `BacktestLabService`, `BacktestCsvService`, `BacktestDatasetService`, `CandleDataService`, `CandleChunkStoreService`, `BacktestController`, `BacktestService`, entities/repositories/migrations.
- Frontend: `SessionPage.tsx`, `BacktestLabWizard.tsx`, `api/backtest.ts`.
- Tests: `BacktestLabServiceTest`, `BacktestCsvServiceTest`, `BacktestLabWizard.test.tsx`.

The items below map to the required audit checklist.

---

## 1) CSV Upload Flow
Current Today/Session backtest flow uses dataset sets:
1. Frontend calls `POST /api/backtest/dataset-sets` (`BacktestLabController.createDatasetSet`).
2. CSV upload calls `POST /api/backtest/dataset-sets/{id}/upload-csv` (`BacktestLabService.uploadCsv`).
3. Service delegates to:
- `BacktestCsvService.upload` (header parse, suggested mapping, upload row storage)
- `BacktestCsvService.ingest` (timestamp/price parse, canonical candles, chunk persistence, dataset upsert)
4. `BacktestLabService.listDatasets` returns dataset file status and session preview.

Legacy backtest endpoints also still exist (`BacktestDataController` + `BacktestService`) but Today/Session chart backtest currently uses `BacktestLabWizard` + lab endpoints.

## 2) Candle Parsing Semantics
`BacktestCsvService.parseTimestamp` supports:
- epoch seconds and milliseconds (10..17 digits, ms threshold at `1_000_000_000_000`)
- ISO offset timestamps
- local datetime formats with timezone override
- local dates (start of day)

All parsed timestamps are normalized to UTC (`ZoneOffset.UTC`).

Candle timestamp semantics in engine/tests: timestamp is treated as candle bar timestamp (open time semantics in fixtures and checks).

Evidence:
- `BacktestCsvServiceTest.ingestFixtureCsvKeepsCandleOpenTimestampAndExactOhlcForKnownBar`
- epoch sec/ms tests in `BacktestCsvServiceTest`

## 3) Data Storage / Indexing by Timeframe
Canonical candles are stored in `candle_chunks` via `CandleChunkStoreService.saveCandles`:
- key dimensions: user, provider, source_id, symbol_canonical, timeframe, chunk_start_utc
- intraday TFs chunked daily; higher TFs chunked monthly
- payload compressed via `CandleChunkCodec`

Dataset metadata is in `backtest_datasets` and linked to `backtest_dataset_sets` (`dataset_set_id`).

## 4) Dataset State Flow (WARN / READY / ERROR)
State is computed by `BacktestLabService.validateDataset` and returned in `BacktestDatasetFileResponse`:
- `READY`: runnable + no warnings
- `WARN`: runnable + warning issues present
- `ERROR`: any fatal issue

Common fatal drivers:
- parse failed (`parsed_ok=false`)
- no candles
- insufficient candles vs min threshold
- missing or invalid min/max range

`WARN` datasets are runnable.

## 5) Current Backtest Pipeline Entry Points
Lab pipeline:
- `POST /api/backtest/dataset-sets/{id}/runs` -> `BacktestLabService.run`
- `run` -> `parseConfig` -> `resolveRunRange` -> `executeRunEngine` -> `persistRunArtifacts` -> `generateAndPersistReport`.
- Results/report:
  - `GET /api/backtest/runs/{runId}/results`
  - `GET /api/backtest/runs/{runId}/report`

Engine core is in `BacktestLabService.simulateTrades` with helper methods for pools/sweeps/displacement/MSS/retrace/entry/exit.

## 6) Current Strategy DTO / Entity / Model
Strategy config is persisted as JSONB:
- entity: `BacktestStrategyConfig.config_json`
- API DTO: `BacktestStrategyConfigUpsertRequest` / `BacktestStrategyConfigResponse`
- parser: `BacktestLabService.parseConfig`

Current config already includes many SMC fields, including timeframe roles, session calendar, pool/sweep/displacement/MSS/retrace settings, execution realism, and optimizer inputs.

## 7) Current Session Handling
Session calendar supports:
- `name`, `timezoneId/zoneId`, local start/end times, enabled flags, pool/eval/entry flags, display order.

Runtime resolution:
- `assignSession` converts UTC candle timestamp to session local timezone (`ZoneId.of`) and handles overnight windows.
- DST behavior is timezone-based and covered by tests (`sessionAssignmentRespectsDstForLondonAndNewYork`).

## 8) Current Pool Detection Logic
Pools are generated at runtime (not persisted as lifecycle entities in lab engine):
- Session levels: ASIA/LONDON/NY highs/lows (`buildSessionLevelRecords` + `buildContextPools`)
- PDH/PDL and PWH/PWL
- EQH/EQL via pivot clustering (`buildEqPools`)

Configured controls include enabled pool types, touch tolerance, min touches, separation, age, rank rule.

## 9) Current Sweep Logic
Sweep detection flow:
- `detectSweep` evaluates active pool candidates
- `trackSweepExcursion` tracks first breach, excursion extreme, depth, reclaim behavior
- `selectSweepCandidate` applies selection rule

The timeline already emits raw sweep-related events:
- `POOL_CREATED`, `POOL_TARGETED`, `SWEEP_FIRST_BREACH`, `SWEEP_EXTREME`, `SWEEP`, `POOL_CONSUMED`.

## 10) Current Displacement Logic
`findDisplacementSignal` supports:
- delay window after sweep
- min body (absolute and vs average)
- directional body
- optional close beyond attacked level
- no-instant-overlap bars
- gap mode: GAP_REQUIRED / GAP_OPTIONAL / NO_GAP_ONLY
- gap definition: THREE_CANDLE_FVG / TWO_CANDLE_GAP

Diagnostics already capture body and gap metrics.

## 11) Current MSS / BOS Logic
MSS is implemented in `findMssSignal` with:
- anchor resolution (`resolveMssAnchor`)
- break check (`isMssBroken`)
- confirm streak (`mssMinConfirmCandles` + window)
- invalidation (`isMssInvalidated`, currently close-back rule implemented)

BOS as a distinct continuation engine is not currently implemented as a separate rule path; timeline currently emits `MSS_BOS` as part of MSS confirmation semantics.

## 12) Current Entry / Fill Logic
Entry:
- `resolveEntry` supports `MARKET_ON_CONFIRM_CLOSE` and `LIMIT_RETRACE_PERCENT`.
- Optional retrace gate with GAP_FILL / IMPULSE_LEG reference and wick/close touch modes.

Execution/fill math:
- spread/slippage modeled via entry/exit cost breakdown helpers.
- fill policy supports `MID` and `BID_ASK_SIM` style adjustments.
- trade evidence includes raw/adjusted/final prices.

## 13) Current Timeline / Report Generation
Per-trade timeline is stored under `evidence_json.timeline` and returned in run results.

Events include (current set):
- pool lifecycle, sweep, displacement/gap, MSS trigger/confirm, retrace, entry/fill, exit.

Report snapshots are persisted in `backtest_run_reports` with markdown + JSON snapshots.

## 14) Today/Session Regenerate / Rerun Button Flow
In `BacktestLabWizard`:
- `Regenerate Backtest` validates dataset + window + config state.
- auto-saves strategy if dirty.
- runs backtest, loads results/report, updates lifecycle state.

Current lifecycle states in UI:
- `idle`, `validating`, `queued`, `running`, `completed`, `failed`.

Action row currently includes:
- Save Config
- Regenerate Backtest
- Generate Diagnostics Report
- Open Diagnostics

## 15) UI Local vs UTC Areas
Backtest lab explicitly labels UTC and formats timestamps through UTC helpers.

Potential ambiguity still exists in surrounding Today/Session non-backtest surfaces, but lab results/timeline/report are UTC-focused.

## 16) Symbol Mismatch Root Cause (GBPUSD header vs EURUSD report)
Cause is real and reproducible:
- `SessionPage` passes `headerSymbol` from Today session context (`activeSymbol || chartSymbol`).
- `BacktestLabWizard` uses persisted dataset set context (`datasetSetId` in localStorage + dataset set instrument) for backtest runs.
- These state machines are independent.

If a stale dataset set is reused across sessions/symbols, header symbol can diverge from dataset/report symbol.

Current mitigation:
- Wizard shows warning alert when `headerSymbol !== dataset/report instrument`.

---

## Current Problems
1. Symbol context split: session header symbol and lab dataset symbol can diverge through persisted dataset set reuse.
2. BOS and MSS are not fully separated as first-class confirmation engines in code path and diagnostics.
3. Swing-label concepts (HH/HL/LH/LL) are not exposed as explicit derived outputs for users.
4. Timeline default view is technically rich but still too raw for beginners.
5. Some strategy concepts are already configurable but grouped in broad sections; clarity can be improved for explainability.

## Recommended Refactor Map
1. Keep canonical-lowest-timeframe architecture (already present), formalize it in docs/UI copy.
2. Split confirmation engine into explicit MSS vs BOS logic with dedicated config and diagnostics.
3. Add explicit derived structure labels (HH/HL/LH/LL) from confirmed swings.
4. Upgrade sweep diagnostics to clear state progression fields.
5. Replace default timeline drawer with storyline-first narrative + collapsible raw diagnostics.
6. Improve symbol mismatch handling with one-click dataset-set reset/switch to current session symbol.
7. Extend regenerate lifecycle with explicit refresh stage when artifacts are being fetched.

---

## File / Class / Function Inventory

### Controllers
- `backend/src/main/java/com/tradevault/controller/BacktestLabController.java`
- `backend/src/main/java/com/tradevault/controller/BacktestDataController.java`
- `backend/src/main/java/com/tradevault/controller/BacktestController.java`

### Core Lab Engine
- `backend/src/main/java/com/tradevault/service/backtest/BacktestLabService.java`
  - Key methods:
    - `run`, `runOptimizer`, `getRunResults`, `getRunReport`
    - `executeRunEngine`, `simulateTrades`
    - `buildContextPools`, `buildEqPools`, `detectSweep`, `trackSweepExcursion`
    - `findDisplacementSignal`, `detectDisplacementGap`
    - `findMssSignal`, `resolveMssAnchor`
    - `resolveRetraceGate`, `resolveEntry`, `resolveExit`
    - `buildTimeline`, `buildNoFillTimeline`
    - `parseConfig`, `validateTimeframeRoles`, `parseSessions`, `assignSession`

### Data and CSV Path
- `backend/src/main/java/com/tradevault/service/backtest/BacktestCsvService.java`
- `backend/src/main/java/com/tradevault/service/backtest/BacktestDatasetService.java`
- `backend/src/main/java/com/tradevault/service/backtest/CandleDataService.java`
- `backend/src/main/java/com/tradevault/service/backtest/CandleChunkStoreService.java`

### Entities
- `BacktestDatasetSet`, `BacktestDataset`, `BacktestStrategyConfig`, `BacktestRun`, `BacktestTrade`, `BacktestRunReport`, `BacktestSetup`

### Frontend
- `frontend/src/pages/SessionPage.tsx` (embeds backtest wizard in session chart area)
- `frontend/src/features/backtest/BacktestLabWizard.tsx`
- `frontend/src/api/backtest.ts`

### Tests
- `backend/src/test/java/com/tradevault/service/backtest/BacktestLabServiceTest.java`
- `backend/src/test/java/com/tradevault/service/backtest/BacktestCsvServiceTest.java`
- `frontend/src/features/backtest/BacktestLabWizard.test.tsx`

