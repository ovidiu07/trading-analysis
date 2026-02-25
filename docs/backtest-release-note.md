# Backtest Engine Overhaul Release Note

## What changed
- Reworked SMC setup detection to track sweep excursions against explicit liquidity pools.
- Timeline now separates `poolLevel` from true sweep wick data (`sweepExtremePrice`, `sweepExtremeTime`).
- Added configurable session-aware pool sources (ASIA/LONDON/NY_AM/NY_PM, PDH/PDL, PWH/PWL, EQH/EQL).
- Added stricter displacement + MSS controls (max delays, body thresholds, anchor rules, overlap checks).
- Added entry realism knobs (market vs retrace-limit, entry windows, optional FVG/discount filters).
- Added execution realism knobs (`pipSize`, spread, slippage, fill policy).
- Added diagnostics toggles to emit intermediate levels for debugging.

## UI and API notes
- Strategy Builder now exposes SMC sections for sessions, pools, sweep, displacement, structure/MSS, entry, execution, and diagnostics.
- Strategy presets can be saved/loaded in the wizard.
- SWEEP timeline rendering now displays both pool level and sweep extreme price/time.

## How to use the new config
1. In Strategy Builder, start from a template and open the SMC sections.
2. Choose `evaluationSessionFilter` (where setups are allowed) and `sweepSourceSessions` (which session levels can be swept).
3. Enable pool types in `poolTypesEnabled` and set touch/depth strictness.
4. Tighten displacement and MSS delays to keep setups immediate after the sweep.
5. Select entry model (`MARKET_ON_CONFIRM_CLOSE` or `LIMIT_RETRACE_PERCENT`) and set realistic spread/slippage.
6. Enable diagnostics (`emitDebugFields`, `storeIntermediateLevels`) to inspect pool selection and sweep excursion details in timeline evidence.

## Validation coverage added
- CSV fixture test verifies candle-open timestamp mapping and exact OHLC at `2026-02-04T08:10:00Z`.
- Sweep excursion test verifies SWEEP event timestamp/price aligns to the true excursion extreme (`1.183800` at `2026-02-04T08:10:00Z`).
- Integration test verifies event ordering and delay constraints: `SWEEP <= DISPLACEMENT <= MSS <= ENTRY`.
- UI test verifies SWEEP details expose and render `poolLevel` and `sweepExtremePrice`.
