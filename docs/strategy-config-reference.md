# Strategy Config Reference

Reference for the Today/Session backtest strategy schema parsed by `BacktestLabService.parseConfig(...)`.

## Time and timestamp policy

- Engine storage uses UTC timestamps.
- API returns ISO UTC strings with `Z`.
- Session windows are local-time + IANA timezone and are resolved to UTC during evaluation.

## Top-level shape

- `name`
- `context`
- `sessions`
- `setupRule`
- `entryModel`
- `riskModel`
- `qualityFilters`
- `smc`

## `context`

- `instrument`
- `timezone`
- `pipSize`
- `spreadPips`
- `slippagePips`
- `touchTolerancePips`

## `setupRule`

- `mode`
- `sessionName`
- `liquiditySweepRequired`
- `direction` (`AUTO_FROM_SWEEP`, `LONG`, `SHORT`)
- `confirmationType` (`MSS`, `BOS`)

## `entryModel`

- `type`
  - `MARKET_ON_MSS_CONFIRM` (alias-compatible with previous market-on-confirm naming)
  - `LIMIT_RETRACE_PERCENT`
  - `LIMIT_FVG_FILL`
- `retracePercent`
- `entryWindowBars`

## `riskModel`

- `stopRule`
- `fixedR`
- `minRR`

## `smc` timeframe roles

- `contextTf`
- `poolTf`
- `confirmationTf`
- `entryTf`
- `executionTf`
- `allowNonHierarchicalTimeframes`

Default validation (when non-hierarchical override is disabled):

- `contextTf >= poolTf >= confirmationTf >= entryTf`
- `executionTf <= entryTf`

## `sessions` / `smc.sessionCalendar`

Each session row:

- `name`
- `timezoneId` / `zoneId`
- `localStartTime` / `startLocal`
- `localEndTime` / `endLocal`
- `enabled`
- `canGeneratePools`
- `canFilterEvaluation`
- `canFilterEntry`
- `displayOrder`

Cross-session controls:

- `sweepSourceSessions`
- `evaluationSessionFilter`
- `entrySessions`
- `requireCrossSessionSweep`
- `requireSameSessionForSweepAndEntry`

## Liquidity pools and sweep controls

- `poolTypesEnabled`
- `poolTimeframeForDetection`
- `poolTouchTolerancePips`
- `poolMinTouches`
- `poolMinSeparationBars`
- `poolMinAgeBars`
- `poolRankRule`
- `sweepMinDepthPips`
- `sweepMaxDurationBars`
- `sweepRequiresReclaim`
- `sweepRequiresLiquidityType`
- `sweepSelectRule`
- `sweepRequiresUnsweptPool`

## Displacement controls

- `displacementTimeframe`
- `displacementMaxDelayBarsAfterSweep`
- `displacementMinBodyPips`
- `displacementMinBodyVsAvgMult`
- `displacementRequiresCloseBeyondLevel`
- `displacementNoInstantOverlapBars`
- `displacementType` (`GAP_REQUIRED`, `GAP_OPTIONAL`, `NO_GAP_ONLY`)
- `displacementGapDefinition` (`THREE_CANDLE_FVG`, `TWO_CANDLE_GAP`)
- `displacementGapMinPips`

## Structure engine controls

Swing/structure:

- `swingDetectionMethod`
- `swingPivotN`
- `minSwingDistancePips`
- `minSwingSeparationBars`
- `structureTier`

BOS:

- `bosEnabled`
- `bosAnchorType`
- `bosBreakMode`
- `bosMinBreakDistancePips`
- `bosHoldBars`
- `bosDirectionRule`

MSS:

- `mssEnabled`
- `mssBreakMode`
- `mssRequiresClose`
- `mssRequiresLiquiditySweep`
- `mssRequiresDisplacement`
- `mssMinConfirmCandles`
- `mssMaxConfirmWindowBars`
- `mssInvalidationRule`
- `mssMinBreakDistancePips`
- `mssAnchorLevel` / `mssAnchorType`
- `mssStructureTier`

Retrace:

- `retraceRequired`
- `retraceReference`
- `retraceMinPct`
- `retraceMaxWaitBars`
- `retraceAcceptWickTouch`

## Execution realism

- `fillPolicy` (`MID`, `BID_ASK_SIM`)
- `executionTf` + spread/slippage from `context`
- touch and fill tolerances via `context.touchTolerancePips` and sweep/retrace settings

## Diagnostics emitted per trade

Evidence includes:

- confirmation metadata (`confirmationType`, `setupFamily`)
- structure labels/trend
- pool + sweep prices/timestamps
- displacement metrics
- MSS/BOS anchor and break levels
- entry transparency fields:
  - `entryTriggerPrice`
  - `entryRawOrderPrice`
  - `entrySpreadAdjustmentPrice`
  - `entrySlippageAdjustmentPrice`
  - `entryFinalExecutionPrice`

Timeline includes UTC stages for:

- pool lifecycle
- sweep progression
- displacement/gap
- MSS or BOS confirmation
- retrace gates
- entry/fill
- exit
