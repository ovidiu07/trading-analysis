# Backtest Audit (Current Implementation Before This Refactor)

## Scope
This audit covers the currently shipped Today > Session backtest implementation across:
- Backend lab engine: `backend/src/main/java/com/tradevault/service/backtest/BacktestLabService.java`
- Backend CSV/data path: `BacktestCsvService`, `BacktestDatasetService`, `CandleChunkStoreService`, `CandleDataService`
- Backend run/report APIs: `BacktestLabController`, `BacktestDataController`, `BacktestService`
- Frontend Today/Session and Lab UI: `frontend/src/pages/SessionPage.tsx`, `frontend/src/features/backtest/BacktestLabWizard.tsx`, `frontend/src/api/backtest.ts`

---

## 1) CSV Upload Flow Audit

### Entry points
- Legacy upload/ingest:
  - `POST /api/backtest/csv/upload` -> `BacktestDataController.uploadCsv` -> `BacktestCsvService.upload`
  - `POST /api/backtest/csv/ingest` -> `BacktestDataController.ingestCsv` -> `BacktestCsvService.ingest`
- Dataset-set upload (Today/Session Lab path):
  - `POST /api/backtest/dataset-sets/{id}/upload-csv` -> `BacktestLabController.uploadCsvToSet` -> `BacktestLabService.uploadCsv`
  - This internally calls `BacktestCsvService.upload` + `BacktestCsvService.ingest`.

### Timestamp semantics
`BacktestCsvService.parseTimestamp(...)` accepts:
- Epoch numeric (10..17 digits)
  - `>= 1_000_000_000_000` => milliseconds
  - otherwise => seconds
- ISO offset datetime (`OffsetDateTime.parse`)
- ISO/local datetime (`LocalDateTime` + timezone override/mapping timezone)
- Local date (`LocalDate`) at local start-of-day

All parsed times are normalized to UTC (`ZoneOffset.UTC`) before persistence.

### Candle-time meaning
- Parsed `tsUtc` is treated as candle timestamp and stored as `CanonicalCandle.tsUtc`.
- Engine and tests treat this as candle open time.

### Seconds vs milliseconds
- Explicitly disambiguated by magnitude in `parseTimestamp`.
- Covered by tests:
  - `BacktestCsvServiceTest.ingestParsesEpochSecondsAndPreservesHistoricalYears`
  - `BacktestCsvServiceTest.ingestParsesEpochMillisecondsAndPreservesHistoricalYears`

---

## 2) Candle Storage / Indexing Audit

### Storage model
- Candles are persisted in `candle_chunks` (`CandleChunkStoreService.saveCandles`).
- Payload is binary chunked JSON gzip via `CandleChunkCodec`.
- Chunk granularity:
  - Intraday fine-grain TFs -> daily chunk
  - Higher TFs -> monthly chunk

### Dataset linking
- `backtest_datasets.dataset_set_id` links datasets to a dataset set.
- `BacktestLabService.listDatasets` queries `findByDatasetSet_IdOrderByCreatedAtAsc`.
- Dataset summary fields (`minTimeUtc`, `maxTimeUtc`, `candleCount`) are set on ingest/upload flow.

### WARN / READY / ERROR status computation
- Computed synchronously by `BacktestLabService.validateDataset(...)`:
  - `READY`: runnable + no warnings
  - `WARN`: runnable + warnings present
  - `ERROR`: any fatal validation
- Fatal checks include parse failure, no candles, insufficient candles, bad range.

---

## 3) Dataset Lifecycle Audit

### Why user sees “Selected timeframe dataset is WARN. Wait until it is READY ...”
- Frontend message comes from `BacktestLabWizard.runBlockedReason` when `executionDatasetProcessing` or non-runnable state is detected.
- `WARN` itself is *runnable* (unless fatal errors also exist).

### Who computes status
- Backend: `BacktestLabService.validateDataset` -> `BacktestDatasetFileResponse.status/runnable`.
- Frontend only renders that status and applies local run guards.

### Background finalize step?
- No asynchronous finalize/build worker currently exists for CSV dataset sets.
- Status transitions are immediate based on stored metadata + chunk coverage.
- `BUILDING/PROCESSING` labels are recognized in UI, but current backend path does not enqueue a background parser for dataset-set CSV upload.

---

## 4) Backtest Run Flow Audit

### Controller/service entry points
- Lab run: `POST /api/backtest/dataset-sets/{id}/runs` -> `BacktestLabService.run`
- Results: `GET /api/backtest/runs/{runId}/results` -> `BacktestLabService.getRunResults`
- Report: `GET /api/backtest/runs/{runId}/report` -> `BacktestLabService.getRunReport`

### Strategy DTO/entity
- Entity: `BacktestStrategyConfig` (`config_json` JSONB)
- Upsert request: `BacktestStrategyConfigUpsertRequest`
- Save endpoint: `POST /api/backtest/dataset-sets/{id}/strategy-configs`

### Orchestration
`BacktestLabService.run`:
1. Resolve dataset set + strategy config
2. Parse config (`parseConfig`)
3. Resolve/clamp run range (`resolveRunRange`)
4. Create `BacktestRun` in `RUNNING`
5. Execute engine (`executeRunEngine`)
6. Persist setups/trades (`persistRunArtifacts`)
7. Optionally generate report snapshot (`generateAndPersistReport`)
8. Mark run `COMPLETED` or `FAILED`

---

## 5) Pool Detection Logic Audit

### Current sources
- Context/session/day/week pools: `buildContextPools`
  - Session highs/lows from `buildSessionLevelRecords`
  - Daily/weekly previous highs/lows (PDH/PDL/PWH/PWL)
- EQ pools: `buildEqPools`
  - Pivot clustering with tolerance and separation

### Current configurable parameters used
- `poolTypesEnabled`
- `poolTimeframeForDetection`
- `poolTouchTolerancePips`
- `poolMinTouches`
- `poolMinSeparationBars`
- `poolMinAgeBars`
- `poolRankRule`

### Invalidation lifecycle (current)
- Pools are ephemeral run-time candidates (`LiquidityPoolCandidate` record).
- Active filtering only by age (`resolveActivePools` + `poolMinAgeBars`).
- No explicit persistent lifecycle state (ACTIVE/SWEPT/CONSUMED/INVALID/SUPERSEDED) in backtest engine model.
- Already-swept pools can still be considered again later in the same run because there is no consumed-state registry.

---

## 6) Sweep Detection Logic Audit

### Current behavior
- Sweep detection starts in `detectSweep`.
- For each candidate pool, `trackSweepExcursion` captures:
  - first breach price/time
  - excursion extreme price/time
  - depth
  - end index by reclaim or timeout window
- Candidate winner chosen by `selectSweepCandidate` with configurable rule.

### Current stored data
In `Sweep` record and evidence/timeline:
- `poolId`, `poolType`, `poolLevel`
- `firstBreachPrice`, `firstBreachTime`
- `sweepExtremePrice`, `sweepExtremeTime`
- `depth`

### State machine gap
- Conceptual states are implemented implicitly in flow, but not modeled as explicit persisted states (`POOL_TARGETED`, `FIRST_BREACH`, etc.)

---

## 7) Displacement Logic Audit

### Current checks (`findDisplacementSignal`)
- Delay window from sweep (`displacementMaxDelayBarsAfterSweep`)
- Body absolute min (`displacementMinBodyPips`)
- Body-vs-average multiplier (`displacementMinBodyVsAvgMult`)
- Directional candle requirement
- Optional close beyond attacked level
- Optional no-instant-overlap bars
- Gap mode support via:
  - `displacementType`: `GAP_REQUIRED` / `GAP_OPTIONAL` / `NO_GAP_ONLY`
  - `displacementGapDefinition`: `THREE_CANDLE_FVG` / `TWO_CANDLE_GAP`
  - `displacementGapMinPips`

### Diagnostics currently stored
- `gapDetected`, `gapSizePips`
- `bodyPips`, `avgBodyPips`, `bodyVsAvg`
- `attackedLevel`, displacement candle open/close/high/low

---

## 8) MSS / BOS Logic Audit

### Current behavior (`findMssSignal`)
- Anchor chosen via `resolveMssAnchor`:
  - last pivot swing
  - displacement origin
  - internal structure
- Trigger: first break (`isMssBroken`)
- Confirm: streak of `mssMinConfirmCandles` within `mssMaxConfirmWindowBars`
- Invalidation rule currently implemented:
  - `CLOSE_BACK_THROUGH_LEVEL`

### Output semantics
- Both trigger and confirm timestamps are stored/emitted:
  - `MSS_TRIGGER`
  - `MSS_CONFIRMED`

---

## 9) Entry / Fill / Exit Logic Audit

### Entry and retrace
- Entry models currently implemented in engine:
  - `MARKET_ON_CONFIRM_CLOSE`
  - `LIMIT_RETRACE_PERCENT`
- Optional retrace gate (`resolveRetraceGate`) supports:
  - `retraceRequired`
  - `retraceReference` (`GAP_FILL` / fallback `IMPULSE_LEG`)
  - `retraceMinPct`
  - `retraceMaxWaitBars`
  - `retraceAcceptWickTouch`

### Fill simulation and costs
- Transaction cost model:
  - If `fillPolicy=MID` => no spread/slippage adjustment
  - Else apply `spreadPips + slippagePips` split on entry/exit
- Entry price adjusted by `applyEntryCost`
- Exit price adjusted by `applyExitCost`

### Transparency gap (current)
- Timeline currently shows entry `price` but not full decomposition:
  - trigger price
  - pre-cost fill price
  - spread/slippage adjustments
  - final execution price

---

## 10) Timeline / Report Generation Audit

### Event timeline currently emitted
- `SWEEP`
- `DISPLACEMENT`
- `MSS_TRIGGER`
- `MSS_CONFIRMED`
- `MSS_BOS`
- `RETRACE_TARGET_CALC`
- `RETRACE_OK`
- `ENTRY`
- `EXIT`

### Transport shape
- Backend DTO: `BacktestLabTimelineEventResponse` (`stage`, `timeUtc`, `details`)
- `timeUtc` is emitted as UTC instant (`Z`) in API

### Report snapshot
- Stored in `backtest_run_reports` with JSON snapshots + markdown
- Markdown built by `buildReportMarkdown`

### Visibility gap
- Timeline has rich detail JSON, but not all debug internals are surfaced in report markdown.

---

## 11) Today/Session UI Backtest Flow Audit

### Current flow in Session page
- Backtest mode in `SessionPage` renders `BacktestLabWizard` inside chart panel.
- Legacy replay backtest state still exists in `SessionPage` state/actions, but active chart backtest UX is now Lab wizard.

### Strategy save + run
- In `BacktestLabWizard`:
  - Upload CSVs
  - Save strategy config
  - Run backtest
  - View results/report
  - Run optimizer

### GBPUSD header vs EURUSD report mismatch root cause
- Session header symbol chip comes from Today session symbol context (`activeSymbol` / planner/chart state in `SessionPage`).
- Backtest report instrument comes from dataset-set/lab state (`BacktestLabWizard` instrument/datasets + `BacktestRun.symbol`).
- These are currently independent state machines and are not synchronized or validated against each other.

---

## 12) Timezone Handling Audit

### Backend internals
- Candle/event timestamps are normalized and stored/processed as UTC.
- API payloads use ISO timestamps; timeline DTO uses `Instant` (`Z`).

### Session timezone behavior
- Session assignment uses IANA zone conversion (`ZoneId.of(window.zoneId)` in `assignSession`) and supports overnight windows.
- However `normalizeTimezoneBasis(...)` currently hard-returns `UTC`, so user-configured timezone basis is effectively forced to UTC.

### Frontend display
- Backtest lab timeline uses `formatUtcTimestamp` (UTC ISO rendering).
- Some non-lab Today/Session elements still use local-time browser formatting for unrelated live/session UX.

---

## Current Pain Points

1. No explicit persisted pool lifecycle state (consumed/reuse policy not enforced deterministically).
2. Timeframe roles are not fully explicit as a first-class validated model (`contextTf/poolTf/confirmationTf/entryTf/executionTf`).
3. Canonical-source rule (lowest timeframe as source-of-truth for all derived TFs) is not consistently enforced end-to-end.
4. Session timezone basis is forced to UTC by normalization helper, limiting true IANA session calendar behavior.
5. Today/Session header symbol context and Lab report instrument context can diverge without explicit UX warning/resolution.
6. Entry/fill cost decomposition is not fully transparent in timeline/report.

---

## Refactor Recommendations (Implemented Next)

1. Introduce explicit multi-timeframe role config with order validation and optional override.
2. Enforce canonical dataset selection (lowest available TF) and derive higher TF series from canonical candles.
3. Add session calendar schema in strategy config with editable IANA-zone session definitions and per-session flags.
4. Add deterministic pool lifecycle tracking in-engine (active/swept/consumed/invalid) plus diagnostics events.
5. Extend timeline events and details for full fill math transparency.
6. Add Today/Session **Regenerate Backtest** action state machine and symbol-context reconciliation UX.

---

## File/Class/Function Map

### Backend controllers
- `BacktestLabController` (dataset-set upload/config/run/optimizer/results/report)
- `BacktestDataController` (legacy csv upload/ingest/datasets/candles)

### Backend services
- `BacktestLabService`
  - `run`, `executeRunEngine`, `simulateTrades`
  - `parseConfig`, `chooseExecutionDataset`, `resampleCandles`
  - `buildContextPools`, `buildEqPools`, `detectSweep`, `findDisplacementSignal`, `findMssSignal`, `resolveRetraceGate`, `resolveEntry`, `resolveExit`
  - `buildTimeline`, `buildReportMarkdown`
  - `validateDataset`
- `BacktestCsvService` (CSV parse/upload/ingest)
- `BacktestDatasetService` (dataset upsert/list/summary)
- `CandleChunkStoreService` / `CandleDataService` (chunk persistence/load)

### Backend entities
- `BacktestDatasetSet`, `BacktestDataset`, `BacktestStrategyConfig`, `BacktestRun`, `BacktestSetup`, `BacktestTrade`, `BacktestRunReport`, `BacktestOptimizerRun`

### Frontend
- `SessionPage.tsx` (Today/Session shell, chart mode switch, header symbol context)
- `BacktestLabWizard.tsx` (upload, strategy builder, run, results, report, optimizer)
- `api/backtest.ts` (contracts for lab + legacy endpoints)

### Tests
- Backend:
  - `BacktestCsvServiceTest`
  - `BacktestLabServiceTest`
- Frontend:
  - `BacktestLabWizard.test.tsx`
  - `formatUtc.test.ts`
