# Optimizer

The optimizer runs deterministic parameter variants against the same backtest engine path used by normal runs.

## API

- `POST /api/backtest/dataset-sets/{id}/optimizer/runs`
- `GET /api/backtest/optimizer/runs/{optimizerRunId}`

## Grid fields

Supported grid dimensions:

- `mssMinConfirmCandles`
- `displacementType`
- `retraceRequired`
- `retraceMinPct`
- `sweepMinDepthPips`
- `confirmationTf` (optional)
- `entryTf` (optional)

`maxVariants` caps execution count after variant generation.

## Variant metrics

Each variant row includes:

- `trades`
- `sampleSize`
- `winRate`
- `profitFactor`
- `expectancyR`
- `avgR`
- `maxDdR`
- `fillRate`
- `avgMaeR`
- `avgMfeR`
- `avgDurationSec`
- `confidenceNote`

## Ranking

Current ranking order:

1. `expectancyR` (desc)
2. `profitFactor` (desc)
3. `winRate` (desc)
4. `sampleSize` (desc)
5. variant index (stable tie-break)

## UI behavior

The Today/Session optimizer UI supports:

- running optimizer from results step
- sorting variants
- viewing parameter payload + metrics
- applying any variant back into current strategy config (`Apply` action)

After applying a variant, save config and use **Regenerate Backtest**.
