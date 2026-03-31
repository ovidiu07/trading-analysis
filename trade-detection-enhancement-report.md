# Trade Detection Strictness Report

Scope: identify the exact files and lines that currently make trade detection too restrictive in the Pine stack, and point to the safest places to loosen the system without redesigning orchestration.

## 1. Actual Trade Creation Gate

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`

### Lines
- 2452-2479
- 2522-2527
- 2675

### Why this matters
No trade exists unless `ea.evaluate_entry_authority(...)` returns `EA_TRIGGERABLE`, then `canActivateTrade` is true, then `ea.can_promote_to_active(...)` passes.

### Current logic
- Entry authority is evaluated for long/short at lines 2452-2479.
- Immediate activation only happens if:
  - `isSignalB` and `eaLong == EA_TRIGGERABLE` and `epLong == EP_IMMEDIATE`
  - or `isSignalS` and `eaShort == EA_TRIGGERABLE` and `epShort == EP_IMMEDIATE`
- Delayed activation only happens if:
  - pending activated
  - and entry authority is still `EA_TRIGGERABLE`
  - and path is `EP_RETRACE`
- Trade creation is finally blocked unless that survives to line 2675.

### Enhancement target
This is not the place to loosen thresholds first. It is the final gate. Improve the upstream pass-rate first in the files below.

## 2. MSS Definition Is Very Strict Before Any Library Logic Runs

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`

### Lines
- 680-683

### Why this matters
`mssBull` and `mssBear` are stricter than a simple structure break.

### Current logic
- Bull:
  - `ta.crossover(close, lastPHi)`
  - `and isDispBull`
  - `and not na(prevPLo)`
  - `and low[1] < prevPLo`
- Bear:
  - `ta.crossunder(close, lastPLo)`
  - `and isDispBear`
  - `and not na(prevPHi)`
  - `and high[1] > prevPHi`

### Enhancement target
If zero trades exist on all timeframes, this is one of the first places to inspect.

### Lowest-risk enhancement options
- Relax the prior-bar sweep requirement:
  - `low[1] < prevPLo`
  - `high[1] > prevPHi`
- Relax the displacement requirement:
  - `isDispBull`
  - `isDispBear`

### Risk
High behavioral impact. This changes base structure detection before all downstream filters.

## 3. Strategy Gate Is Hardened and Can Kill Otherwise Valid MSS Signals

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_signal_gate_engine.pine`

### Lines
- 112-160
- 173-200

### Why this matters
Even if MSS exists, ICT/SB can reject it before the system becomes tradable.

### ICT gate details
At lines 112-160:
- Sweep freshness must be tight:
  - actionable and age `<= 25`
  - or consumed precursor and age `<= 15`
- Sequence is hard-blocked if:
  - age `> 50`
  - or age `< 0`
- Only certain sweep roles are accepted:
  - HTF raid
  - session raid
  - external target
- Inducement-only requires all of:
  - `mssDisp >= 1.75`
  - `qualityScore >= 65`
  - `age <= 15`
- Internal pivot exception only passes in Aggressive with:
  - `sourceType == SRC_PIVOT_INT`
  - `qualityScore >= 78`

### Silver Bullet gate details
At lines 173-200:
- Sweep must be actionable or in-SB and inside strict lookback.
- Preferred narratives are limited to:
  - session raid
  - HTF raid
  - premium external target
- Premium external requires:
  - `qualityScore >= 70`
  - `age <= 10`

### Enhancement target
This is a high-value place to loosen trade frequency without touching the indicator orchestration.

### Best candidates
- ICT freshness windows:
  - line 115
  - line 116
- ICT inducement thresholds:
  - line 136
- ICT internal exception threshold:
  - line 137
- Silver Bullet premium external threshold:
  - line 190

### Risk
Medium. This changes signal eligibility, but it is still localized to strategy gating.

## 4. Mode Qualification Is Probably the Main Strictness Source

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_pending_trade_state.pine`

### Lines
- 246-309

### Why this matters
This is where the strategy says whether the setup is good enough for the selected mode.

### Aggressive
Lines 266-276:
- Standard activation requires:
  - `lifecycle >= LC_ENTRY_TRIGGERED`
  - `hasMss`
  - `reclaimPass`
- Promo activation requires:
  - `lifecycle >= LC_DISPLACEMENT_CONFIRMED`
  - `reclaimPass`
  - `dispPass_`
  - `not dispFailed_`

### Balanced
Lines 278-288:
- Ideal activation requires:
  - `lifecycle >= LC_ENTRY_ARMED`
  - `reclaimPass`
  - `mssQualPass`
  - `not isExtended`
  - `dispPass_`
  - `not dispFailed_`
- Bridge activation requires:
  - `lifecycle >= LC_DISPLACEMENT_CONFIRMED`
  - `< LC_ENTRY_ARMED`
  - `reclaimStr >= 40`
  - `mssQualPass`
  - `bridgePass`
  - `not isExtended`
  - `dispPass_`
  - `not dispFailed_`

### Conservative
Lines 290-304:
- Ideal activation requires all of:
  - `lifecycle >= LC_ENTRY_ARMED`
  - `reclaimPass`
  - `reclaimStr >= 50`
  - `mssQualStrong`
  - `not isExtended`
  - `seqOk`
  - `mssTrigSig >= 2`
  - `dispStrong_`
  - `not dispFailed_`

### Enhancement target
If you want more trades without redesign, this is one of the safest and most effective places.

### Best candidates
- Balanced bridge reclaim threshold:
  - line 280, `reclaimStr >= 40.0`
- Balanced dependency on both MSS and displacement quality:
  - lines 279-288
- Conservative reclaim threshold:
  - line 291, `reclaimStr >= 50.0`
- Conservative trigger significance:
  - lines 291-294, `mssTrigSig >= 2`
- Conservative displacement strength requirement:
  - lines 291-294

### Risk
Medium-low if loosened one threshold at a time.

## 5. Pending Activation and Structural Freshness Are Tight

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_pending_trade_state.pine`

### Lines
- 203-243
- 312-371

### Why this matters
Balanced and Conservative often rely on pending activation, and pending expires or invalidates quickly.

### Structural freshness details
Lines 203-243:
- Pending age max:
  - Aggressive: 5 bars
  - Balanced: 5 bars
  - Conservative: 4 bars
- MSS freshness:
  - Conservative: 15 bars
  - Balanced: 25 bars
  - Aggressive: 35 bars
- FVG freshness:
  - Conservative: 12 bars
  - Balanced: 20 bars
  - Aggressive: 30 bars
- Any of these hard-fail freshness:
  - degraded
  - extended
  - MSS failed
  - displacement failed

### Pending activation details
Lines 317-369:
- Pending is invalidated if:
  - reclaim failed
  - MSS failed
  - MSS stale
  - displacement failed
  - displacement stale
  - pending window expired
  - setup expired or degraded
  - pending not structurally fresh
  - extended
- Balanced pending requires:
  - `currentLifecycle >= LC_DISPLACEMENT_CONFIRMED`
  - `reclaimPass`
  - `mssQualPass`
  - `bridgePass_`
  - `dispPass_`
- Conservative pending requires:
  - `currentLifecycle >= LC_DISPLACEMENT_CONFIRMED`
  - `reclaimStrong`
  - `mssQualStrong`
  - `bridgeStrong_`
  - `dispPass_`
  - `seqOk` or `dispStrength >= 1.5`

### Enhancement target
This is a high-priority enhancement point for `Balanced`.

### Best candidates
- Structural freshness age windows:
  - lines 208, 215, 222
- Balanced pending quality gate:
  - lines 353-360
- Conservative pending sequence gate:
  - line 364

### Risk
Low to medium depending on whether you only widen windows or also relax quality checks.

## 6. Lifecycle Mode Policy Forces Balanced/Conservative Into Retrace Workflow

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_lifecycle_mode.pine`

### Lines
- 99-125

### Why this matters
This file defines the mode-level policy before authority logic.

### Current policy
- Candidate lifecycle:
  - Aggressive: `LC_MSS_CONFIRMED`
  - Balanced: `LC_DISPLACEMENT_CONFIRMED`
  - Conservative: `LC_ENTRY_ARMED`
- Activation lifecycle:
  - Aggressive: `LC_ENTRY_ARMED`
  - Balanced: `LC_ENTRY_ARMED`
  - Conservative: `LC_ENTRY_TRIGGERED`
- Direct signal activation:
  - only Aggressive
- Pending activation bars:
  - Aggressive: 2
  - Balanced: 5
  - Conservative: 7

### Enhancement target
If `Balanced` is producing zero trades, this file is a major reason.

### Best candidates
- Balanced candidate lifecycle:
  - line 100
- Direct signal activation policy:
  - line 108-109
- Pending window length:
  - line 124-125

### Risk
Medium-high if you allow direct activation outside Aggressive. Low if you only widen the pending window.

## 7. Reclaim Thresholds Are Moderate, but Still Block Activation

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`

### Lines
- 14-127
- 130-138

### Why this matters
Reclaim feeds both mode qualification and entry authority.

### Current thresholds
- Reclaim valid:
  - score `>= 35`
- Reclaim strong:
  - score `>= 60`
- Mode pass:
  - Aggressive: detected and score `>= 15`
  - Balanced: valid or score `>= 35`
  - Conservative: strong or score `>= 55`

### Enhancement target
Good candidate if the dashboard shows reclaim repeatedly blocking.

### Best candidates
- Valid threshold:
  - line 91
- Strong threshold:
  - line 92
- Conservative pass threshold:
  - line 135

### Risk
Medium-low.

## 8. MSS Quality and Freshness Thresholds Are Important Bottlenecks

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`

### Lines
- 231-324
- 328-339
- 366-389

### Why this matters
Mode qualification and entry authority both depend on MSS being valid, fresh, and strong enough.

### Current thresholds
- MSS freshness:
  - Aggressive: 35 bars
  - Balanced: 25 bars
  - Conservative: 18 bars
- MSS valid:
  - `score >= 35`
  - `trigSig >= 1`
- MSS strong:
  - `score >= 60`
  - `trigSig >= 2`
  - `bodyConf`
- Mode pass:
  - Aggressive: detected and score `>= 20`
  - Balanced: valid and `trigSig >= 1` and score `>= 35`
  - Conservative: valid and `trigSig >= 2` and score `>= 50`

### Enhancement target
This is a top-3 area to enhance if MSS is frequently present but not promoted.

### Best candidates
- Freshness thresholds:
  - line 278
- Valid/strong thresholds:
  - lines 308-310
- Mode pass thresholds:
  - lines 331-339
- Standalone quality fallback thresholds:
  - lines 373-385

### Risk
Medium.

## 9. Extension Filter Is Aggressive for Balanced and Conservative

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`

### Lines
- 344-362

### Why this matters
This blocks setups before entry authority promotes them.

### Current thresholds
- Max ATR extension:
  - Aggressive: 1.5 ATR
  - Balanced: 1.0 ATR
  - Conservative: 0.7 ATR
- Max bars since MSS:
  - Aggressive: 15
  - Balanced: 12
  - Conservative: 8

### Enhancement target
This is one of the cleanest places to increase trade count in `Balanced`.

### Best candidates
- line 352
- line 358

### Risk
Low to medium.

## 10. Displacement Quality and Bridge Logic Are Also Strict

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`

### Lines
- 399-598
- 602-615
- 619-640

### Why this matters
Balanced and Conservative require displacement quality, not just displacement presence.

### Current thresholds
- Candidate displacement bar must have `rangeAtr >= 0.4`
  - line 462
- FVG only helps if:
  - after MSS
  - fresh within 25 bars
  - not mitigated
- Displacement valid:
  - `score >= 30`
- Displacement strong:
  - `score >= 60`
  - `bodyDom >= 0.6`
  - `rangeAtr >= 0.8`
- Displacement freshness:
  - Aggressive: 30
  - Balanced: 22
  - Conservative: 15
- Mode pass:
  - Aggressive: detected and score `>= 15`
  - Balanced: valid and score `>= 30`
  - Conservative: strong or score `>= 50`
- Bridge legacy fallback minimum MSS displacement:
  - Aggressive: 0.5
  - Balanced: 1.0
  - Conservative: 1.5

### Enhancement target
High-value if the system often reaches MSS but stalls at displacement.

### Best candidates
- line 462
- lines 541-545
- lines 567-569
- lines 612-614
- line 630

### Risk
Medium.

## 11. Main Indicator Promotion Logic Adds Another Restrictive Layer

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`

### Lines
- 2357-2385

### Why this matters
Even after a signal exists, lifecycle promotion is mode-aware and displacement-aware.

### Current logic
- Aggressive can promote to `LC_ENTRY_TRIGGERED` only if:
  - reclaim proxy
  - swept
  - MSS exists
  - `dispPass`
  - not displacement failed
  - not expired
  - not degraded
- Balanced and Conservative only promote to `LC_DISPLACEMENT_CONFIRMED` through the signal path.

### Enhancement target
This is a secondary place to improve after the libraries.

### Best candidates
- lines 2359-2360
- lines 2369-2370
- lines 2374-2375
- lines 2383-2384

### Risk
Medium-high because it changes orchestration behavior in the indicator.

## 12. Trade Count on Dashboard Is Close-Based, Not Entry-Based

### Files
- `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`
- `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_pending_trade_state.pine`

### Lines
- `version1-improving-dev.pine`: 2737-2738, 3881-3885
- `tv_pending_trade_state.pine`: 374-381

### Why this matters
`mainStats.totalTrades` increments only when the trade closes, not when it opens.

### Note
This does not explain zero trades across long history if no trades ever close, but it can make the dashboard read as zero while a trade is still active.

## 13. Existing Debug Output Already Tells You Which Gate Is Failing

### File
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`

### Lines
- 3511-3513
- 3621-3627
- 3740-3768
- 3775-3783
- 3791-3826

### What to watch
- `dominantModeBlockReason`
- ICT and SB gate details
- reclaim stage and score
- MSS stage, score, trigger significance, reason
- displacement stage, score, reason
- freshness reason
- rejection cause
- entry authority reason and block category

### Practical use
Before changing thresholds, run the dashboard in `Debug` mode and note the most common repeated blocker. That tells you which single threshold family to loosen first.

## 14. Recommended Enhancement Order

### Safest first
1. `tv_structure_engine.pine`
   - extension thresholds at 352 and 358
   - displacement freshness and score thresholds at 541-545 and 612-614
2. `tv_pending_trade_state.pine`
   - pending freshness windows at 208, 215, 222
   - Balanced activation thresholds at 279-288
3. `tv_signal_gate_engine.pine`
   - ICT freshness and inducement thresholds at 115-137

### Change later
4. `tv_lifecycle_mode.pine`
   - direct activation policy at 108-109
   - pending window at 124-125
5. `version1-improving-dev.pine`
   - raw MSS definition at 682-683
   - promotion logic at 2357-2385

## 15. Best Single-File Targets If You Want More Trades With Minimal Redesign

### Best first file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_pending_trade_state.pine`

Reason:
- it controls mode activation and pending conversion
- it is strict enough to cause zero trades
- it is safer to relax than changing raw MSS detection

### Best second file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`

Reason:
- it controls extension, MSS quality, and displacement quality
- these are common blockers for `Balanced`

### Best third file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_signal_gate_engine.pine`

Reason:
- it can reject otherwise valid setups very early
- the thresholds are explicit and easy to tune
