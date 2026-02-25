# Strategy Config Reference (HQ Defaults)

This document is the implementation reference for the Backtest Lab strategy schema used by backend parsing and Strategy Builder UI.

## UTC rule

- All timestamps are stored and returned as UTC (`Instant` / ISO-8601 with `Z`).
- `sessionTimezone` is normalized to `UTC` in engine logic.
- UI timeline and results render UTC only.

## Execution Realism

| Field | Default | Constraints | Why / Trade-off |
|---|---:|---|---|
| `context.pipSize` | `0.0001` | `> 0` | Instrument precision for pips. Wrong value corrupts thresholds. |
| `context.spreadPips` | `0.8` | `>= 0` | More realistic fills. Higher spread lowers fill quality. |
| `context.slippagePips` | `0.3` | `>= 0` | Models execution friction. Higher slippage reduces expectancy. |
| `smc.fillPolicy` | `BID_ASK_SIM` | `MID`, `BID_ASK_SIM` | `BID_ASK_SIM` is more realistic than midpoint fills. |
| `context.touchTolerancePips` | `0.5` | `>= 0` | Controls how strict level touches are. Lower = stricter, fewer setups. |

## Pool Definition

| Field | Default | Constraints | Why / Trade-off |
|---|---:|---|---|
| `smc.poolTypesEnabled` | `EQH,EQL,ASIA_H,ASIA_L,LONDON_H,LONDON_L,NY_AM_H,NY_AM_L,PDH,PDL,PWH,PWL` | enum set | Wider set increases candidates/noise. |
| `smc.poolTimeframeForDetection` | `M15` | timeframe enum | Higher TF pools are cleaner but less frequent. |
| `smc.poolTouchTolerancePips` | `1.0` | `>= 0` | Tolerance for equal highs/lows clustering. |
| `smc.poolMinTouches` | `2` | integer `>= 1` | Higher touches improve pool quality but reduce count. |
| `smc.poolMinSeparationBars` | `6` | integer `>= 0` | Prevents counting clustered touches as separate reactions. |
| `smc.poolMinAgeBars` | `12` | integer `>= 0` | Avoids fresh/unformed pools. |
| `smc.poolRankRule` | `MOST_TOUCHES_THEN_RECENCY` | enum | Promotes cleaner pools before recency. |

## Sessions & Killzones

| Field | Default | Constraints | Why / Trade-off |
|---|---:|---|---|
| `smc.sessionsEnabled` | `ASIA,LONDON,NY_AM,NY_PM` | session enum set | Filters where setup context is built. |
| `smc.sessionTimezone` | `UTC` | forced UTC | Removes DST/local drift. |
| `setupRule.session` | `LONDON` | enabled session | Main evaluation context. |
| `smc.sweepSourceSessions` | `ASIA,LONDON,NY_AM` | session enum set | Restricts which session levels can be swept. |
| `smc.evaluationSessionFilter` | `LONDON` | session enum set | Controls where entries are allowed. |
| `smc.requireKillzone` | `true` | boolean | Tightens time-of-day quality. |
| `smc.killzoneWindowsUtc.LONDON` | `07:00-10:00` | UTC hh:mm | Peak London reversal/continuation window. |
| `smc.killzoneWindowsUtc.NY_AM` | `12:30-15:30` | UTC hh:mm | Main NY AM window. |

## Sweep Rules

| Field | Default | Constraints | Why / Trade-off |
|---|---:|---|---|
| `setupRule.sweepType` | `ASIA_H` | pool/session level type | Strategy bias for expected liquidity draw. |
| `smc.sweepMinDepthPips` | `4.0` | `>= 0` | Prevents shallow/weak sweeps. |
| `smc.sweepMaxDurationBars` | `5` | integer `>= 1` | Limits slow grind-through behavior. |
| `smc.sweepRequiresReclaim` | `true` | boolean | Requires rejection/reclaim confirmation. |
| `smc.sweepSelectRule` | `MAX_DEPTH_THEN_BEST_RANKED_POOL` | enum | Picks strongest sweep candidate when multiple exist. |

Recorded diagnostics include `poolLevel`, `firstBreachTime/Price`, `sweepExtremePrice`, and `sweepExtremeTime`.

## Displacement Rules

| Field | Default | Constraints | Why / Trade-off |
|---|---:|---|---|
| `smc.displacementTimeframe` | `M5` | timeframe enum | Lower TF is faster/noisier; higher TF is slower/cleaner. |
| `smc.displacementMaxDelayBarsAfterSweep` | `2` | integer `>= 1` | Keeps displacement tightly coupled to sweep. |
| `smc.displacementMinBodyPips` | `6.0` | `>= 0` | Filters low-impulse candles. |
| `smc.displacementMinBodyVsAvgMult` | `1.8` | `>= 0` | Relative impulse filter against local average. |
| `smc.displacementRequiresCloseBeyondLevel` | `true` | boolean | Avoids wick-only breaks. |
| `smc.displacementNoInstantOverlapBars` | `1` | integer `>= 0` | Rejects immediate full overlap after displacement. |
| `smc.displacementType` | `GAP_OPTIONAL` | `GAP_REQUIRED`, `GAP_OPTIONAL`, `NO_GAP_ONLY` | Controls gap/no-gap strictness. |
| `smc.displacementGapDefinition` | `THREE_CANDLE_FVG` | `THREE_CANDLE_FVG`, `TWO_CANDLE_GAP` | Gap detection variant. |
| `smc.displacementGapMinPips` | `2.0` | `>= 0` | Minimum qualifying gap size. |

Diagnostics include `gapDetected`, `gapSizePips`, `bodyPips`, `avgBodyPips`, `bodyMult`, and `attackedLevel`.

## MSS / Structure

| Field | Default | Constraints | Why / Trade-off |
|---|---:|---|---|
| `smc.mssTf` | `M5` | timeframe enum | MSS confirmation timeframe. |
| `smc.mssRequiresClose` | `true` | boolean | Close-based structure breaks reduce false triggers. |
| `smc.mssMinConfirmCandles` | `3` | integer `>= 1` | Multi-candle confirmation quality filter. |
| `smc.mssMaxConfirmWindowBars` | `8` | integer `>= 1` | Prevents stale confirmations. |
| `smc.mssInvalidationRule` | `CLOSE_BACK_THROUGH_LEVEL` | enum | Defines invalidation after trigger. |
| `smc.mssAnchorLevel` | `LAST_SWING_HIGH_LOW` | enum | Chooses structure level source. |

Engine emits `MSS_TRIGGER` and `MSS_CONFIRMED` timestamps.

## Retrace & Entry

| Field | Default | Constraints | Why / Trade-off |
|---|---:|---|---|
| `smc.retraceRequired` | `true` | boolean | Prevents instant "perfect" entries after displacement. |
| `smc.retraceReference` | `GAP_FILL` | `GAP_FILL`, `IMPULSE_LEG` | Uses gap bounds when available, else impulse fallback. |
| `smc.retraceMinPct` | `50` | `0..100` | Higher = deeper retrace requirement. |
| `smc.retraceMaxWaitBars` | `6` | integer `>= 1` | Timeout for setup validity. |
| `smc.retraceAcceptWickTouch` | `true` | boolean | Wick-touch is looser than close-only touch. |
| `entryModel.type` | `LIMIT_RETRACE_PERCENT` | enum | Default entry model for controlled fills. |
| `entryModel.retracePercent` | `50` | `0..100` | Limit placement within impulse leg. |
| `entryModel.entryWindowBars` | `5` | integer `>= 1` | Limits stale entry attempts. |
| `riskModel.minRR` | `2.0` | `>= 0` | Minimum reward-to-risk filter. |

Timeline emits `RETRACE_TARGET_CALC` and `RETRACE_OK` when retrace gating is active.

## Preset

The "HQ Default Preset" button in Strategy Builder populates these defaults and is designed to reduce trade count while increasing setup quality.
