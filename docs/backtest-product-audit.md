# Backtest Product Audit

## Scope
Audit performed on the current implementation in:
- Frontend: `frontend/src/features/backtest/BacktestLabWizard.tsx`, `frontend/src/pages/SessionPage.tsx`, `frontend/src/api/backtest.ts`, `frontend/src/api/session.ts`
- Backend: `backend/src/main/java/com/tradevault/controller/BacktestLabController.java`, `backend/src/main/java/com/tradevault/service/backtest/BacktestLabService.java`, `backend/src/main/java/com/tradevault/controller/TodaySessionController.java`, `backend/src/main/java/com/tradevault/service/today/TodaySessionService.java`
- Domain/repo/migrations: backtest entities/repositories + `V35`, `V37`, `V38`
- Deterministic CSV fixtures: `backend/src/test/resources/fixtures/backtest/OANDA_EURUSD_*.csv`

## A) Current UX Flow

### Upload CSVs
1. User opens Today -> Session (`/today/session`) and switches chart mode to Backtest.
2. `BacktestLabWizard` step 1 creates/uses a dataset set (`POST /api/backtest/dataset-sets`).
3. CSV upload uses `POST /api/backtest/dataset-sets/{id}/upload-csv` for each file.
4. Wizard refreshes `GET /api/backtest/dataset-sets/{id}/datasets` and shows:
- uploaded files
- status (`READY`/`WARN`/`ERROR`)
- candle counts/range
- session preview cards

### Strategy Builder / Continue / Run
Current behavior after refactor:
- Step 2 defaults to **Quick Backtest** with limited controls.
- Users can switch to **Strategy Studio**.
- `Save Strategy` persists config (`POST /api/backtest/dataset-sets/{id}/strategy-configs`).
- `Continue` opens run setup.
- `Regenerate Backtest` validates current config/window and runs `POST /api/backtest/dataset-sets/{id}/runs`.
- If config is dirty, it is persisted before run.

### Results and Report
- Results are loaded from `GET /api/backtest/runs/{runId}/results`.
- Report snapshot is loaded from `GET /api/backtest/runs/{runId}/report`.
- Step 4 shows:
- summary metrics
- candidate flow summary
- best/worst setup cards
- trade table with storyline drawer
- report markdown
- playbook promote/apply actions

### Optimizer Location
- Optimizer is now exposed in **Strategy Studio -> Optimize** tab.
- Endpoint flow remains:
- `POST /api/backtest/dataset-sets/{id}/optimizer/runs`
- `GET /api/backtest/optimizer/runs/{optimizerRunId}`

### Today/Session Intersection
- Backtest is embedded in `SessionPage` via `BacktestLabWizard`.
- New Today integration action exists:
- `POST /api/sessions/today/playbook/{playbookId}/apply`
- This binds selected playbook into Today session state.

## B) Current Backend Flow

### CSV Ingestion Path
- `BacktestLabController.uploadCsvToSet` -> `BacktestLabService.uploadCsv`
- Delegates to `BacktestCsvService.upload` + `BacktestCsvService.ingest`
- Candles are persisted and fetched through `CandleDataService`/chunk store.
- Dataset row (`BacktestDataset`) is linked to dataset set and updated with:
- `min/max` UTC
- candle count
- parse status/errors

### Dataset Status Lifecycle
Computed from validation issues in `BacktestLabService`:
- `READY`: runnable, no warnings
- `WARN`: runnable with warnings
- `ERROR`: not runnable (fatal validation issues)

### Backtest Run Endpoint/Service Flow
- `POST /api/backtest/dataset-sets/{id}/runs` -> `BacktestLabService.run`
- Flow:
1. Resolve strategy config
2. Parse config JSON
3. Resolve/clamp range
4. Select execution dataset/timeframe
5. Load candles
6. Simulate setup/trade engine
7. Persist setups/trades
8. Optional report generation

### Strategy DTO/Entity Model
- Strategy config persisted as JSON in `BacktestStrategyConfig.configJson`.
- DTOs:
- `BacktestStrategyConfigUpsertRequest`
- `BacktestStrategyConfigResponse`
- Templates now represented by `StrategyTemplate` enum for run/candidate/playbook outputs.

### Result Persistence Model
- Run-level: `BacktestRun`
- Candidate-level: `BacktestSetup` (extended in V38)
- review trail: `BacktestCandidateReview`
- trade-level: `BacktestTrade`
- report-level: `BacktestRunReport`
- playbook-level: `StrategyPlaybook`

### Timeline/Report Generation
- Raw timeline remains under trade evidence (`timeline` events with UTC timestamps).
- Storyline is built in frontend from timeline+evidence.
- Diagnostics report markdown is persisted in `BacktestRunReport`.

### Optimizer Flow
- Variants generated from grid parameters.
- Metrics ranked by expectancy/PF/win-rate/sample-size with drawdown/fill/MAE/MFE.
- Summary now surfaces:
- best win-rate variant
- best expectancy variant
- best balanced variant
- recommended live variant

## C) Current Pain Points (Observed + Root Cause)

### Essential vs Overwhelming Controls
- Essential controls are a small subset (template/timeframes/sweep/confirmation/retrace/entry-risk models).
- Advanced controls were previously always visible as a full parameter wall.
- This has been split into Quick Backtest vs Strategy Studio tabs.

### Duplicated/Advanced-only Information
- Duplicated concepts existed between `setupRule`, `context`, `smc` blocks.
- Some controls (debug fields/intermediate levels/raw toggles) are expert-only and now kept out of quick mode.

### Symbol Mismatch (GBPUSD header vs EURUSD report)
Root cause:
- Today session header symbol comes from Session state.
- Backtest dataset set symbol can be reused from persisted local storage (`session.backtestLab.datasetSetId`).
- These were independent state machines.
Current handling:
- warning banner with one-click reset to current header symbol context.

### UTC vs Local Time Mixing
- Engine and diagnostics are UTC.
- Sessions are interpreted with local/session timezone windows then normalized.
- Trust risk appeared when users compared local chart labels vs UTC event logs.
Current handling:
- explicit UTC labels in results/storyline diagnostics.

### Why Trust Breaks on Chart vs Engine Divergence
- SMC interpretation is partly subjective.
- Previous flow jumped directly to final trades.
- User could not inspect near-miss/expired/rejected candidates.
Refactor direction now implemented:
- candidate-first lifecycle with review states and storyline + diagnostics.

## D) Current File/Class Map

### Controllers
- `backend/src/main/java/com/tradevault/controller/BacktestLabController.java`
- `backend/src/main/java/com/tradevault/controller/TodaySessionController.java`

### Backtest Services
- `backend/src/main/java/com/tradevault/service/backtest/BacktestLabService.java`
- `backend/src/main/java/com/tradevault/service/backtest/BacktestCsvService.java`
- `backend/src/main/java/com/tradevault/service/backtest/CandleDataService.java`

### Today Service
- `backend/src/main/java/com/tradevault/service/today/TodaySessionService.java`

### Entities
- `BacktestDatasetSet`, `BacktestDataset`, `BacktestStrategyConfig`, `BacktestRun`, `BacktestSetup`, `BacktestTrade`, `BacktestRunReport`, `BacktestOptimizerRun`, `BacktestCandidateReview`, `StrategyPlaybook`, `TodaySession`

### DTOs (new/updated)
- `BacktestLabRunResultsResponse`, `BacktestCandidateSetupResponse`, `BacktestCandidateSummaryResponse`, `BacktestCandidateReviewRequest/Response`, `BacktestPlaybookResponse`, `PlaybookValidationSummaryResponse`, `SessionActivePlaybookDto`

### Repositories
- `BacktestSetupRepository`, `BacktestTradeRepository`, `BacktestCandidateReviewRepository`, `StrategyPlaybookRepository`

### Frontend
- `frontend/src/features/backtest/BacktestLabWizard.tsx`
- `frontend/src/features/backtest/BacktestLabWizard.test.tsx`
- `frontend/src/api/backtest.ts`
- `frontend/src/api/session.ts`

## Migration Strategy

### Reuse
- Reuse existing engine simulation and evidence/timeline payloads.
- Reuse optimizer core, move primary surface into Strategy Studio Optimize.
- Reuse persisted strategy JSON model with template overlays.

### Refactor
- Keep run execution stable, move user flow to:
1. Quick Backtest (default)
2. Strategy Studio (Recipe/Rules Map/Candidates/Optimize)
- Introduce candidate-first review and playbook promotion as first-class backend concepts.

### Deprecate / Move Behind Advanced
- Parameter wall exposure in default flow.
- Optimizer controls in primary results path.
- Raw diagnostics as first view (now secondary/collapsible).

### Backward Compatibility
- Existing strategy JSON still loads via normalization.
- Existing trade/report entities still render.
- New fields are additive (V38 migration), not destructive.
