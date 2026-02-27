# Strategy Config Reference

This is the current deterministic strategy schema used by `BacktestLabService.parseConfig(...)` and the Today/Session Backtest Strategy Builder.

## Time policy

- Engine internals store UTC instants.
- API returns ISO UTC timestamps (`...Z`).
- Session definitions are local-time + IANA timezone and are converted to UTC at evaluation time (DST-safe).

## Top-level structure

- `name`
- `context`
- `sessions`
- `setupRule`
- `entryModel`
- `riskModel`
- `qualityFilters`
- `smc`

## Timeframe roles (`smc`)

- `contextTf`
- `poolTf`
- `confirmationTf`
- `entryTf`
- `executionTf`
- `allowNonHierarchicalTimeframes`

Default hierarchy (when override is false):

- `contextTf >= poolTf >= confirmationTf >= entryTf`
- `executionTf <= entryTf`

## Session calendar (`sessions` + `smc.sessionCalendar`)

Each session row supports:

- `name`
- `zoneId` / `timezoneId` (IANA)
- `startLocal` / `localStartTime`
- `endLocal` / `localEndTime`
- `enabled`
- `canGeneratePools`
- `canFilterEvaluation`
- `canFilterEntry`
- `displayOrder`

Cross-session controls:

- `smc.sweepSourceSessions`
- `smc.evaluationSessionFilter`
- `smc.entrySessions`
- `smc.requireCrossSessionSweep`
- `smc.requireSameSessionForSweepAndEntry`

## Pool / sweep controls (`smc`)

- `poolTypesEnabled`
- `poolTimeframeForDetection` (alias `poolTf` supported)
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

## Displacement / MSS / retrace (`smc`)

- `displacementTimeframe`
- `displacementMaxDelayBarsAfterSweep`
- `displacementMinBodyPips`
- `displacementMinBodyVsAvgMult`
- `displacementRequiresCloseBeyondLevel`
- `displacementNoInstantOverlapBars`
- `displacementType`
- `displacementGapDefinition`
- `displacementGapMinPips`
- `mssTf` / `structureTimeframe`
- `swingDetectionMethod`
- `swingPivotN`
- `mssRequiresClose`
- `mssMinConfirmCandles`
- `mssMaxConfirmWindowBars`
- `mssInvalidationRule`
- `mssAnchorLevel`
- `retraceRequired`
- `retraceReference`
- `retraceMinPct`
- `retraceMaxWaitBars`
- `retraceAcceptWickTouch`

## Entry / risk / execution

- `entryModel.type`
- `entryModel.retracePercent`
- `entryModel.entryWindowBars`
- `riskModel.stopRule`
- `riskModel.fixedR`
- `riskModel.minRR`
- `context.pipSize`
- `context.spreadPips`
- `context.slippagePips`
- `context.touchTolerancePips`
- `smc.fillPolicy`

## Diagnostics fields emitted per trade

Evidence and timeline now include:

- pool lifecycle markers (`POOL_CREATED`, `POOL_TARGETED`, `POOL_CONSUMED`)
- sweep progression (`SWEEP_FIRST_BREACH`, `SWEEP_EXTREME`, `SWEEP`)
- displacement/gap markers (`DISPLACEMENT_FOUND`, `GAP_FOUND`)
- structure markers (`MSS_TRIGGER`, `MSS_CONFIRMED`, `MSS_BOS`)
- retrace markers (`RETRACE_TARGET_CALC`, `RETRACE_OK`)
- fill transparency (`entryTriggerPrice`, raw/spread/slippage/final execution prices)
- entry/exit markers (`ENTRY`, `ENTRY_FILLED`, `EXIT`)
