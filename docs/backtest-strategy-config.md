# Backtest Strategy Config (SMC Overhaul)

This document describes the expanded strategy configuration model used by Backtest Lab after the sweep/displacement/MSS overhaul.

## Storage and Compatibility
- Strategy configs remain stored in `backtest_strategy_configs.config_json` (`jsonb`).
- No schema migration is required for new knobs because they are JSON-backed.
- Parser accepts both camelCase and snake_case for new `smc` fields.
- Legacy fields (`context`, `setupRule`, `entryModel`, `riskModel`, `qualityFilters`) are still supported.

## Config Shape

```json
{
  "name": "SMC Rule Strategy",
  "context": {
    "pipSize": 0.0001,
    "spreadPips": 0.8,
    "slippagePips": 0.2,
    "touchTolerancePips": 0.5,
    "timezoneBasis": "UTC",
    "executionTimeframe": "M5"
  },
  "sessions": [
    { "name": "ASIA", "zoneId": "UTC", "startLocal": "00:00", "endLocal": "07:00" },
    { "name": "LONDON", "zoneId": "UTC", "startLocal": "07:00", "endLocal": "12:00" },
    { "name": "NY_AM", "zoneId": "UTC", "startLocal": "13:00", "endLocal": "17:00" },
    { "name": "NY_PM", "zoneId": "UTC", "startLocal": "17:00", "endLocal": "22:00" }
  ],
  "setupRule": {
    "session": "LONDON",
    "sweepType": "ASIA_H",
    "confirmationType": "MSS",
    "direction": "AUTO_FROM_SWEEP"
  },
  "entryModel": {
    "type": "MARKET_ON_CONFIRM_CLOSE",
    "retracePercent": 50,
    "entryWindowBars": 5
  },
  "riskModel": {
    "stopRule": "SWEEP_EXTREME_PLUS_BUFFER",
    "fixedR": 2.0,
    "minRR": 1.5
  },
  "qualityFilters": {
    "displacementMultiplier": 1.5,
    "bodyLookback": 20,
    "antiChop": true,
    "maxTradesPerSession": 1,
    "maxTradesPerDay": 3,
    "pivotLeft": 2,
    "pivotRight": 2,
    "confirmBreakBufferPips": 0.0
  },
  "smc": {
    "sessionTimezone": "UTC",
    "sessionsEnabled": ["ASIA", "LONDON", "NY_AM", "NY_PM"],
    "sessionTimeRanges": {
      "ASIA": { "start": "00:00", "end": "07:00", "zoneId": "UTC" },
      "LONDON": { "start": "07:00", "end": "12:00", "zoneId": "UTC" },
      "NY_AM": { "start": "13:00", "end": "17:00", "zoneId": "UTC" },
      "NY_PM": { "start": "17:00", "end": "22:00", "zoneId": "UTC" }
    },
    "sweepSourceSessions": ["ASIA", "LONDON", "NY_AM"],
    "evaluationSessionFilter": ["LONDON"],

    "poolTypesEnabled": ["EQH", "EQL", "ASIA_H", "ASIA_L", "LONDON_H", "LONDON_L", "NY_AM_H", "NY_AM_L", "PDH", "PDL", "PWH", "PWL"],
    "poolTimeframeForDetection": "M15",
    "poolTouchTolerancePips": 1.0,
    "poolMinTouches": 2,
    "poolMinSeparationBars": 3,
    "poolMinAgeBars": 2,
    "poolRankRule": "TOUCH_COUNT",

    "sweepMinDepthPips": 2.0,
    "sweepMaxDurationBars": 4,
    "sweepRequiresReclaim": true,
    "sweepRequiresLiquidityType": true,
    "sweepSelectRule": "LARGEST_DEPTH",

    "displacementTimeframe": "M5",
    "displacementMaxDelayBarsAfterSweep": 3,
    "displacementMinBodyPips": 4.0,
    "displacementMinBodyVsAvgMult": 1.5,
    "displacementRequiresCloseBeyondLevel": true,
    "displacementNoInstantOverlap": false,

    "structureTimeframe": "M5",
    "swingDetectionMethod": "PIVOT_N",
    "swingPivotN": 2,
    "mssRequiresClose": true,
    "mssMaxDelayBarsAfterDisplacement": 4,
    "mssAnchorLevel": "LAST_SWING_HIGH_LOW",

    "entryRequiresFvgRetest": false,
    "entryRequiresDiscountPremium": false,

    "fillPolicy": "BID_ASK_SIM",
    "emitDebugFields": true,
    "storeIntermediateLevels": true
  }
}
```

## Timeline Contract (Trade Events)
`SWEEP` event details now include explicit separation between targeted level and true stop-run extreme:
- `poolType`
- `poolLevel`
- `sweepExtremePrice`
- `sweepExtremeTime`
- `firstBreachTime` / `firstBreachPrice` (debug)
- `depth`

`DISPLACEMENT` includes:
- `attackedLevel`
- `bodyPips`
- `bodyVsAvg`

`MSS_BOS` includes:
- `anchorLevel`
- `breakPrice`

## UI Notes
- Strategy Builder now exposes realistic SMC sections for sessions, pool definition, sweep/displacement strictness, structure/MSS, and execution realism.
- Strategy presets can be saved/loaded from local storage in the Backtest Lab wizard.
- Strategy warnings are shown for unrealistic settings (e.g., too-small sweep depth, extreme spread/slippage).
