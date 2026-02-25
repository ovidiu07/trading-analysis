# Optimizer / Variant Runner

The optimizer executes deterministic strategy variants over a fixed backtest range and ranks results by quality metrics.

## Scope

Grid dimensions supported:

- `mssMinConfirmCandles` (`2..5` typical)
- `displacementType` (`GAP_REQUIRED`, `GAP_OPTIONAL`, `NO_GAP_ONLY`)
- `retraceRequired` (`true/false`)
- `retraceMinPct` (e.g. `0, 50, 62`)
- `sweepMinDepthPips` (e.g. `3..6`)

Default hard cap: `100` variants per run (`maxVariants`).

## Backend API

- `POST /api/backtest/dataset-sets/{id}/optimizer/runs`
  - Starts optimizer run and persists ranked variants.
- `GET /api/backtest/optimizer/runs/{optimizerRunId}`
  - Reads persisted run and variant results.

Request DTOs:

- `BacktestOptimizerRunRequest`
- `BacktestOptimizerGridRequest`

Response DTOs:

- `BacktestOptimizerRunResponse`
- `BacktestOptimizerVariantResultResponse`

Persistence:

- Migration: `V37__backtest_optimizer_runs.sql`
- Table: `backtest_optimizer_runs`
- Entity: `BacktestOptimizerRun`

## Determinism

Optimizer variants are generated in stable order from the input grid and executed with the same engine path as normal runs.

Deterministic guarantees tested:

- same input grid -> same ordered variant set
- same fixtures/range -> stable metrics aggregation

## Metrics

Each variant output includes:

- `trades`
- `sampleSize`
- `winRate`
- `profitFactor`
- `expectancyR`
- `avgR`
- `maxDdR`
- `fillRate`

UI supports sorting by `expectancyR`, `winRate`, `profitFactor`, and `avgR`.

## Ranking Guidance

Practical sequence for narrowing candidates:

1. Filter out low sample size variants.
2. Compare `profitFactor` and `expectancyR` first.
3. Use `maxDdR` and `fillRate` as stability constraints.
4. Validate top-ranked variants on out-of-sample ranges.

## UI Notes

Strategy Builder adds an "Optimizer" section in Run Results:

- max variants input
- variant dimensions (lists/ranges)
- run button
- ranked results table with sortable columns

All timestamps in optimizer metadata are UTC (`...Z`).
