# LuxAlgo Execution Conformance Refactor Spec

Technical refactor spec for aligning the current Pine implementation with the LuxAlgo quant review while keeping the script as an `indicator(...)` and converting the current setup-readiness / pseudo-trade engine into a real limit-based SMC/ICT indicator execution model.

## Status

- Scope: Pine indicator architecture and execution logic
- Primary source: `backend/src/main/resources/pine/prod/version1-improving-dev.pine`
- Related libraries:
  - `backend/src/main/resources/pine/prod/tv_structure_engine.pine`
  - `backend/src/main/resources/pine/prod/tv_pending_trade_state.pine`
  - `backend/src/main/resources/pine/prod/tv_entry_authority.pine`
  - `backend/src/main/resources/pine/prod/tv_lifecycle_mode.pine`
  - `backend/src/main/resources/pine/prod/tv_signal_gate_engine.pine`
  - `backend/src/main/resources/pine/prod/tv_liquidity_engine.pine`
  - `backend/src/main/resources/pine/prod/tv_core_types.pine`

## Why this refactor exists

The current implementation is not aligned with institutional SMC/ICT execution. The main failures are:

- trade creation is market-on-close instead of limit-centric
- stops are ATR-derived instead of structural invalidation
- targets are fixed `1R/2R` instead of liquidity objectives
- reclaim, MSS, and displacement are modeled as separate gating stages, which creates state bloat and suppresses valid trades
- dominant-side scoring still influences execution decisions
- pending state stores signals, not actual orders

The result is a system that is good at describing setup maturity but poor at producing real tradable executions.

## Refactor objectives

1. Keep the script as a TradingView indicator while making its execution model much more real.
2. Make execution gate-first rather than score-first.
3. Use a limit-centric entry model.
4. Use structural stops.
5. Use liquidity-based targets.
6. Collapse the current multi-stage state machine into a simpler execution lifecycle.
7. Remove dominant-side scoring from execution.
8. Preserve narrative and dashboard scoring only as diagnostics.

## Hard gates vs soft confluences

### Hard gates

These must be required for a setup to become executable:

- Session / killzone participation
- Valid liquidity sweep
- Shift confirmation
  - Lux definition: reclaim + MSS + displacement combined
- Premium / Discount alignment
  - longs only in Discount
  - shorts only in Premium
- Freshness
  - sweep must remain relevant
  - shift must occur fast
- Fresh FVG available for entry placement
- Valid structural stop
- Valid liquidity targets

### Soft confluences

These should influence confidence, hold time, or target quality, but must not block entry by themselves:

- EMA bias
- HTF trend dashboard context
- Volume as secondary confirmation
- Order block confluence
- Additional score / confidence messaging

### Remove from execution logic

- dominant-side adjusted scoring
- score-based side selection
- candidate preview risk logic
- fixed `1R/2R` target model

## Current implementation problems that must be fixed first

### Sweep consumption bug

The sweep engine currently consumes sweeps before downstream stage evaluation can reliably use them.

- File: `backend/src/main/resources/pine/prod/version1-improving-dev.pine`
- Functions / blocks:
  - `summarize_active_sweeps_compat(...)`
  - `update_sweep_engine(...)`

Current behavior:

- sweeps are marked consumed on MSS
- the summary helper ignores consumed sweeps
- downstream reclaim / lifecycle / mode / entry logic loses the sweep precursor that triggered the move

Impact:

- setup context drops out right when it should transition from raid to shift
- signal gates may still see the sweep while lifecycle and entry logic do not

Required fix:

- do not remove the precursor sweep from stage resolution
- preserve the active precursor sweep until setup expiry or invalidation
- alternatively, explicitly attach the precursor sweep reference to the setup state

## Target execution model

### Long setup

1. Price sweeps valid sell-side liquidity.
2. The sweep occurs during killzone / valid session context.
3. Price is in Discount relative to the dealing range.
4. Within 15 bars, a bullish structural shift occurs:
   - reclaim of the broken level
   - bullish break
   - displacement embedded in the shift candle or immediate follow-through candle
5. A fresh bullish FVG is present.
6. A pending long order is placed at:
   - Aggressive: market on shift close if not extended
   - Balanced: bullish FVG entrance
   - Conservative: bullish FVG mean threshold
7. Stop is placed structurally below the relevant invalidation point.
8. TP1 and TP2 are selected from opposing liquidity.
9. If no major target exists within 3R, the trade is skipped.

### Short setup

1. Price sweeps valid buy-side liquidity.
2. The sweep occurs during killzone / valid session context.
3. Price is in Premium relative to the dealing range.
4. Within 15 bars, a bearish structural shift occurs:
   - reclaim of the broken level
   - bearish break
   - displacement embedded in the shift candle or immediate follow-through candle
5. A fresh bearish FVG is present.
6. A pending short order is placed at:
   - Aggressive: market on shift close if not extended
   - Balanced: bearish FVG entrance
   - Conservative: bearish FVG mean threshold
7. Stop is placed structurally above the relevant invalidation point.
8. TP1 and TP2 are selected from opposing liquidity.
9. If no major target exists within 3R, the trade is skipped.

## New lifecycle model

Replace the current lifecycle with the following:

1. `SCANNING`
2. `RAIDED`
3. `SHIFTED`
4. `PENDING`
5. `ACTIVE`
6. `EXPIRED`
7. `INVALIDATED`

### Meanings

- `SCANNING`: valid liquidity identified, waiting for raid
- `RAIDED`: sweep confirmed, waiting for shift
- `SHIFTED`: structural shift validated and entry zone calculated
- `PENDING`: limit order active, waiting for fill
- `ACTIVE`: live trade
- `EXPIRED`: timing window elapsed
- `INVALIDATED`: structure failed

### What to remove

The following states are legacy complexity and should be retired from execution:

- `LC_RECLAIM_VISIBLE`
- `LC_MSS_CONFIRMED`
- `LC_DISPLACEMENT_CONFIRMED`
- `LC_ENTRY_ARMED`
- `LC_ENTRY_TRIGGERED`
- `LC_DESYNC`

These can survive only as debug-only diagnostics if needed.

## Threshold changes

| Component | Current | New | Required change |
|---|---:|---:|---|
| EMA bias gap | `0.3 * ATR` | `0.5 * ATR` | reduce bias flip-flopping |
| Volume threshold | `1.2 * SMA(20)` | `1.5 * SMA(20)` | make displacement volume meaningful |
| Local pivot lengths | `3/1`, `5/2`, `7/3` by mode | fixed `5/2` | avoid micro-noise MSS |
| Sweep max age | `30 / 50 / 70` | fixed `20` | stale raids should die quickly |
| Shift freshness | split across MSS/displacement stages | fixed `15` bars | shift must happen fast |
| Pending window Balanced | `7` | `12` | allow return to FVG |
| Pending window Conservative | `8` | `10` | resolve freshness contradiction |
| Pending freshness Balanced | `7` | `12` | align with pending window |
| Pending freshness Conservative | `5` | `10` | align with pending window |
| FVG expiry | `40 / 60 / 100` | fixed `25` | FVG loses meaning after delivery |
| Raw displacement body | mode-based, min starts at `0.6 * ATR` | fixed `0.9 * ATR` | require institutional intent |
| Shift candle body dominance | scoring-based | `>= 0.8` of candle range | merge displacement into shift |
| Aggressive extension limit | mode-specific broad filter | `<= 1 ATR` beyond pivot for market entry | avoid chasing confirmation close |

## File-by-file implementation plan

## 1. `version1-improving-dev.pine`

### A. Keep the script as an indicator

Keep:

- `indicator(...)`

Do not convert to:

- `strategy(...)`

Reason:

- indicator architecture is a hard constraint
- the refactor must produce a real indicator-side execution model, not Strategy Tester orders
- setup quality, pending orders, fills, invalidations, and targets must be modeled internally and emitted through visuals, state, and alerts

### B. Freeze structure detection thresholds

Current blocks:

- displacement primitives
- local pivot lengths
- raw MSS conditions

Required changes:

- set local pivot lengths to fixed `left=5`, `right=2`
- stop using mode to alter MSS significance
- set displacement body to `>= 0.9 ATR`
- require shift candle body dominance `>= 0.8`
- require volume `> 1.5 * SMA(20)`

### C. Keep session and PD as hard gates

Current values exist:

- `isKillzone`
- `isSilverBullet`
- `pdStatus`

Required changes:

- block long entries unless `pdStatus == "Discount"`
- block short entries unless `pdStatus == "Premium"`
- block all execution outside valid session windows

### D. Make `eval_side(...)` dashboard-only

Current function:

- `eval_side(...)`

Problem:

- mixes narrative scoring with effective setup authority

Required changes:

- keep it for UI only
- remove all score influence on execution
- remove score-based side selection

### E. Remove dominant-side execution

Current fields / logic:

- `adjScoreLong`
- `adjScoreShort`
- `pickLong`
- dominant-side gate and activation logic

Required changes:

- long and short must be evaluated independently
- if both sides are pending, first fill wins
- opposite side must be cancelled on first valid fill

### F. Replace sweep progression logic

Current functions:

- `update_sweep_engine(...)`
- `summarize_active_sweeps_compat(...)`

Required changes:

- do not hide precursor sweeps from downstream shift logic
- preserve the sweep reference used to build the setup
- reduce sweep max age to `20`
- keep quality `> 40` as a hard minimum

### G. Replace signal booleans with setup-to-order transition

Current signal flow:

- `sig2022B`
- `sig2022S`
- `sigSBB`
- `sigSBS`

Problem:

- signal booleans are still close-of-confirmation triggers, not order plans

Required changes:

- keep model labels only as metadata
- order creation must depend on hard gates plus shift validation plus FVG locator
- the resulting action should be `build_pending_order(...)`

### H. Replace pending signal storage with pending order storage

Current state:

- `_pendingLong*`
- `_pendingShort*`

Problem:

- stores signal bar metadata, not executable order definitions

Required changes:

- replace with a `PendingOrder` UDT
- store:
  - side
  - model label
  - setup lifecycle
  - entry price
  - stop price
  - tp1 price
  - tp2 price
  - expiry bar
  - sweep level
  - sweep extreme
  - shift origin
  - FVG top
  - FVG bottom
  - FVG CE
  - liquidity target ids / names

### I. Replace trade creation block

Current block:

- market entry at `close`
- stop at previous bar extreme plus/minus `0.5 ATR`
- TP1 `1R`
- TP2 `2R`

Required changes:

- Aggressive:
  - immediate execution state on shift close only if not extended `> 1 ATR`
- Balanced:
  - pending limit plan at FVG entrance
- Conservative:
  - pending limit plan at FVG CE
- Stops:
  - long: `min(sweepLow, shiftOriginLow) - 2 ticks`
  - short: `max(sweepHigh, shiftOriginHigh) + 2 ticks`
- Targets:
  - TP1 = first internal opposing liquidity
  - TP2 = first major external liquidity
- Skip trade if no major target exists within `3R`
- When the indicator cannot place real orders, it must still:
  - store the order plan
  - detect virtual fill
  - detect invalidation / expiry
  - render entry / stop / targets consistently
  - emit alert-ready output with exact prices

### J. Remove candidate preview from execution path

Current block:

- `update_candidate_preview(...)`

Required changes:

- preview may remain visual-only
- it must not model risk differently from actual execution
- remove projected ATR risk preview if it stays misleading

## 2. `tv_structure_engine.pine`

### Replace the current multi-stage architecture

Current exported functions:

- `evaluate_reclaim_stage(...)`
- `reclaim_mode_pass(...)`
- `evaluate_mss_stage(...)`
- `mss_mode_pass(...)`
- `compute_extension_block(...)`
- `evaluate_displacement_stage(...)`
- `displacement_mode_pass(...)`
- `evaluate_displacement_bridge(...)`

Problem:

- Lux specification does not want reclaim, MSS, and displacement as separate activation stages
- this creates state-hell and suppresses otherwise valid setups

### New target API

Introduce:

- `evaluate_shift_stage(...)`
- `shift_is_fresh(...)`
- `shift_entry_extension_ok(...)`

`evaluate_shift_stage(...)` should return:

- `detected`
- `valid`
- `strong`
- `fresh`
- `failed`
- `score`
- `reason`
- `shiftBar`
- `breakLevel`
- `originPrice`
- `extremePrice`
- `fvgRequired`
- `fvgAvailable`

### New shift rules

- sweep must exist
- shift must occur within `15` bars of the sweep
- reclaim of pivot after sweep is part of the shift, not a separate phase
- displacement must occur on the shift candle or immediate follow-through candle
- required displacement:
  - body `>= 0.9 ATR`
  - body dominance `>= 0.8`
  - volume `> 1.5 * SMA20`

### What to delete from execution

- reclaim score bands as execution gates
- mode-dependent MSS thresholds
- displacement bridge fallback
- separate extension gating based on old lifecycle

## 3. `tv_pending_trade_state.pine`

### Replace pending-signal logic with pending-order logic

Current exported functions:

- `pending_is_structurally_fresh(...)`
- `evaluate_mode_execution(...)`
- `evaluate_pending_activation(...)`
- opportunity-state helpers

Problem:

- current module decides whether stored signals can still become trades
- Lux model needs actual limit-order lifecycle management inside an indicator

### New responsibilities

- validate pending order freshness
- invalidate pending order when:
  - expiry bar exceeded
  - FVG invalidated
  - shift invalidated
  - price extends beyond acceptable chase rule
  - opposite side fills first
- determine whether a pending order is:
  - live
  - filled
  - expired
  - invalidated

### Required changes

- remove reclaim scoring from pending logic
- remove bridge logic from pending logic
- remove score-based opportunity classification from execution
- keep opportunity-state only for UI if still needed

## 4. `tv_entry_authority.pine`

### Simplify the authority model

Current authority model is too granular for the target system.

Current states include:

- `EA_STRUCT_VALID`
- `EA_READY`
- `EA_ARMED`
- `EA_PENDING_RETRACE`
- `EA_PENDING_CONFIRMATION`
- `EA_BLOCKED`
- `EA_LATE`

### New target model

Replace with something closer to:

- `EA_NONE`
- `EA_SHIFT_VALID`
- `EA_PENDING_LIMIT`
- `EA_TRIGGERABLE`
- `EA_ACTIVE`
- `EA_EXPIRED`
- `EA_INVALIDATED`

### Required changes

- authority should no longer evaluate reclaim as a separate block
- authority should not depend on dominant side
- authority should classify whether the side can:
  - build an order plan
  - activate a pending limit plan
  - fill virtually inside the indicator model
  - remain valid

### Activation rule

- Aggressive: direct trigger only when shift candle is not extended
- Balanced / Conservative: triggerable only through limit entry fill

## 5. `tv_lifecycle_mode.pine`

### Replace the lifecycle and mode policy

Current mode policy changes both detection and execution behavior.

Required change:

- structure detection must be fixed across modes
- execution mode should only change:
  - entry location
  - stop basis
  - pending expiry

### New mode rules

- `Aggressive`
  - market on shift close if not extended
  - stop below trigger / origin depending on final implementation choice
  - shorter pending relevance
- `Balanced`
  - default mode
  - limit at FVG entrance
  - stop at structural origin
  - pending window `12`
- `Conservative`
  - limit at FVG mean threshold
  - stop outside sweep extreme
  - pending window `10`

## 6. `tv_signal_gate_engine.pine`

### Simplify gate logic

Current gate engine is over-specialized and exception-heavy.

Current issues:

- role scoring is too influential
- inducement exceptions are too complex
- aggressive-only internal exceptions distort execution logic

### New gate behavior

- hard gate:
  - fresh sweep
  - quality `> 40`
  - valid source class
  - session compliance
- soft metadata:
  - role
  - confidence
  - narrative label

### Keep

- source / role labeling for diagnostics

### Remove from execution

- internal exception pathway
- trader-score role weighting as a trade gate
- model-specific override behaviors that bypass the new shift model

## 7. `tv_liquidity_engine.pine`

### Keep the registry and hierarchy engine

Keep:

- source typing
- quality grading
- hierarchy selection

### Add target-selection helpers

Introduce a new helper:

- `select_trade_targets(...)`

This should return:

- nearest internal opposing liquidity
- nearest major external opposing liquidity
- target names / metadata
- whether a valid major target exists within `3R`

### Target rules

- TP1:
  - opposite 5-bar pivot
  - or EQH/EQL if it is the first internal objective
- TP2:
  - PDH/PDL
  - session high/low
  - major HTF pool

## 8. `tv_core_types.pine`

### Add a proper pending order type

Add:

- `PendingOrder`

Recommended fields:

- `modelName`
- `isLong`
- `entryType`
- `entryPrice`
- `stopPrice`
- `tp1Price`
- `tp2Price`
- `createdBar`
- `expiryBar`
- `isActive`
- `isFilled`
- `isExpired`
- `isInvalidated`
- `sweepLevel`
- `sweepExtreme`
- `shiftBreakLevel`
- `shiftOrigin`
- `fvgTop`
- `fvgBottom`
- `fvgCe`
- `tp1Label`
- `tp2Label`

### Simplify exported lifecycle constants

Execution constants should match the new lifecycle model.

## Mapping from current logic to target logic

| Current component | Target outcome |
|---|---|
| `eval_side(...)` | UI / diagnostics only |
| `determine_lifecycle(...)` | replace with simplified execution lifecycle resolver |
| `evaluate_reclaim_stage(...)` | remove as standalone execution stage |
| `evaluate_mss_stage(...)` | merge into `evaluate_shift_stage(...)` |
| `evaluate_displacement_stage(...)` | merge into `evaluate_shift_stage(...)` |
| `evaluate_displacement_bridge(...)` | delete from execution |
| dominant side `pickLong` | remove from execution |
| `_pendingLong*`, `_pendingShort*` | replace with `PendingOrder` state |
| `T.Trade.new(close, ATR stop, 1R/2R)` | replace with indicator-side execution plan + structural stop + liquidity targets |

## Acceptance criteria

The refactor is complete when all of the following are true:

1. The root Pine file remains an `indicator`.
2. Long and short sides are evaluated independently.
3. No execution branch uses dominant-side score selection.
4. Reclaim is no longer a standalone execution gate.
5. MSS and displacement are merged into one shift validator.
6. Balanced mode places a pending limit plan at the FVG entrance.
7. Conservative mode places a pending limit plan at the FVG CE.
8. Stops are structural, not ATR-based.
9. Targets are liquidity-based, not fixed `1R/2R`.
10. Pending logic stores real orders, not signal metadata.
11. The precursor sweep remains available through shift resolution.
12. If both sides are pending, the first fill wins and the other side is cancelled.
13. A setup with no major target within `3R` is skipped.

## Implementation order

1. Fix sweep precursor persistence.
2. Freeze detection thresholds to Lux values.
3. Replace reclaim/MSS/displacement with unified shift validation.
4. Simplify lifecycle and authority.
5. Introduce `PendingOrder`.
6. Replace pseudo-trade activation with internal order-plan activation and virtual fills.
7. Replace ATR stops and fixed-R targets.
8. Remove dominant-side scoring from all execution branches.
9. Reduce UI score logic to reporting only.

## Instrumentation required during refactor

Before declaring the refactor complete, log or label at least the following:

- selected sweep id / level / age / quality
- shift detection result and reason
- entry locator selected
- stop basis used
- TP1 and TP2 source levels
- pending order expiry reason
- opposite-side cancellation reason
- “skip due to no major target within 3R”

## Recommended default configuration after refactor

- mode: `Balanced`
- pivot length: `5 / 2`
- sweep max age: `20`
- shift freshness: `15`
- FVG expiry: `25`
- volume threshold: `1.5 * SMA(20)`
- EMA bias gap: `0.5 * ATR`
- pending window Balanced: `12`
- pending window Conservative: `10`

## Non-goals

This refactor does not require:

- removing dashboards
- removing debug output
- removing sweep quality scoring for analytics
- removing Silver Bullet labeling

Those can remain as observational layers, as long as they no longer control execution outside the new hard-gate model.
