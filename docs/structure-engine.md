# Structure Engine

This document describes the deterministic structure engine used by the Today/Session backtest flow.

## Goals

- Keep setup qualification explicit and reproducible.
- Separate continuation (`BOS`) from reversal (`MSS`) confirmation paths.
- Emit enough evidence and timeline detail to explain each accepted or rejected trade.

## Multi-timeframe roles

The strategy keeps separate timeframe roles under `smc`:

- `contextTf`
- `poolTf`
- `confirmationTf`
- `entryTf`
- `executionTf`

Default validation (unless `allowNonHierarchicalTimeframes=true`):

- `contextTf >= poolTf >= confirmationTf >= entryTf`
- `executionTf <= entryTf`

## Structure labeling

Swing detection is controlled by:

- `swingDetectionMethod` (`PIVOT_N`, `FRACTAL`, `SWING_HL`)
- `swingPivotN`
- `minSwingDistancePips`
- `minSwingSeparationBars`
- `structureTier`

From confirmed swings, the engine derives labels:

- Highs: `HH` or `LH`
- Lows: `HL` or `LL`
- Trend: `BULLISH`, `BEARISH`, or `MIXED`

These labels are added to trade evidence:

- `structureHighLabel`
- `structureLowLabel`
- `structureTrend`
- optional prior/latest swing prices

## Confirmation engines

`setupRule.confirmationType` selects confirmation mode:

- `MSS` path
- `BOS` path

### MSS (reversal/transition)

Key controls:

- `mssEnabled`
- `mssAnchorLevel` / `mssAnchorType` alias
- `mssBreakMode` (`CLOSE_ONLY`, `WICK_ALLOWED`)
- `mssMinBreakDistancePips`
- `mssMinConfirmCandles`
- `mssMaxConfirmWindowBars`
- `mssInvalidationRule` (`CLOSE_BACK_THROUGH_LEVEL`, `WICK_BACK_THROUGH_LEVEL`, `ALLOW_ONE_PIERCE`)

Behavior:

- Requires sweep + displacement path before structure break validation.
- Uses configured break/invalidation rules with confirmation streak logic.

### BOS (continuation)

Key controls:

- `bosEnabled`
- `bosAnchorType` (`LAST_CONFIRMED_SWING`, `EXTERNAL_SWING_ONLY`, `INTERNAL_SWING_ALLOWED`)
- `bosBreakMode` (`CLOSE_ONLY`, `WICK_ALLOWED`)
- `bosMinBreakDistancePips`
- `bosHoldBars`
- `bosDirectionRule` (`WITH_TREND_ONLY`, `ANY_DIRECTION`)

Behavior:

- Uses explicit continuation break + hold logic.
- Optional trend alignment gate from derived structure context.

## Pool and sweep lifecycle

Sweep diagnostics now include explicit progression data:

- pool identity and level
- first breach
- sweep extreme
- `durationBars`
- `reclaimConfirmed`
- `confirmationTf`
- `state=SWEEP_CONFIRMED`
- `poolStatus=CONSUMED`

Pool reuse is constrained when `sweepRequiresUnsweptPool=true`.

## Displacement and entry

Displacement remains explicit and configurable through:

- body size, body-vs-average, attacked-level close behavior
- gap mode/definition (`GAP_REQUIRED`, `GAP_OPTIONAL`, `NO_GAP_ONLY`)

Entry supports:

- `MARKET_ON_MSS_CONFIRM` (alias of market-on-confirm flow)
- `LIMIT_RETRACE_PERCENT`
- `LIMIT_FVG_FILL`

Fill transparency is exposed in evidence:

- trigger, raw order price, spread/slippage adjustments, final execution price

## Timeline and diagnostics contract

The engine always emits UTC timestamps (`...Z`) and keeps raw diagnostics events.

MSS mode emits:

- `MSS_TRIGGER`
- `MSS_CONFIRMED`
- `MSS_BOS`

BOS mode emits:

- `BOS_TRIGGER`
- `BOS_CONFIRMED`
- `BOS`

Both preserve pool/sweep/displacement/retrace/entry/exit diagnostics.
