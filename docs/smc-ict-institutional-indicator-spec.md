# SMC / ICT Institutional Execution Indicator Specification

Greenfield technical specification for building a brand new Pine Script v6 indicator that models institutional SMC/ICT execution without using `strategy(...)`.

This document is intentionally written as an implementation contract, not a refactor memo. A developer or AI agent should be able to build a new indicator from this specification alone.

## 1. Purpose

Build an `indicator(...)` that:

- detects institutional SMC/ICT setups
- models the full execution narrative from liquidity raid to executable order plan
- tracks pending orders, virtual fills, invalidation, expiry, stop, and targets internally
- renders actionable entry plans and execution states on chart
- emits alert-ready output with exact prices and reasons

The indicator must behave like a professional execution-planning engine, even though it remains an indicator and does not place TradingView strategy orders.

## 2. Non-Negotiable Constraints

### 2.1 Indicator-only architecture

The script must remain:

- `indicator(...)`

The script must not be:

- `strategy(...)`

The script must not use:

- `strategy.entry`
- `strategy.exit`
- `strategy.order`
- any Strategy Tester dependency as the primary execution engine

### 2.2 Internal execution modeling

Because this remains an indicator, all execution behavior must be modeled internally:

- order plan creation
- pending order tracking
- virtual fill detection
- stop hit detection
- target hit detection
- expiry
- invalidation
- side cancellation when the opposite side fills first

### 2.3 No dominant-side scoring in execution

Execution must be asynchronous by side.

- long logic is evaluated independently
- short logic is evaluated independently
- both sides may be valid at the same time
- the first side to fill wins
- the opposite side is cancelled immediately after fill

Execution must not depend on:

- adjusted score multipliers
- dominant side selection
- bias-weighted side arbitration

### 2.4 Gate-first execution

The execution engine must be driven by hard gates, not by composite score.

Score may still exist for:

- dashboard confidence
- visual ranking
- debugging
- hold-time guidance

Score must not be the final entry authority.

## 3. Design Principles

1. Use liquidity raid as the engine.
2. Treat reclaim + break + displacement as one structural shift event.
3. Use FVG as the primary entry locator.
4. Use structural invalidation as the stop model.
5. Use liquidity objectives as the target model.
6. Keep the execution lifecycle small and explicit.
7. Keep EMA / HTF trend / OB as context or soft confluence only.
8. Make every block debuggable through deterministic state fields.

## 4. Indicator Scope

The new indicator must cover:

- session context
- liquidity registry
- sweep detection
- structural shift detection
- FVG detection
- optional OB confluence
- premium / discount gating
- mode-specific entry placement
- pending order management
- virtual trade lifecycle
- alerts
- visual execution overlays
- debug diagnostics

The new indicator does not need:

- broker connectivity
- TradingView strategy orders
- portfolio statistics as the primary objective

## 5. Core Trading Model

## 5.1 Hard gates

The following are mandatory for a valid executable setup:

- valid session / killzone
- valid liquidity sweep
- correct premium / discount side
- valid structural shift within freshness window
- fresh post-shift FVG
- valid structural stop
- valid opposing liquidity targets

### Long hard gates

- current context is within allowed session / killzone
- price is in Discount
- sell-side liquidity is swept
- bullish structural shift occurs within `15` bars of sweep
- a fresh bullish FVG exists after the shift
- a structural stop can be computed
- TP1 and TP2 can be computed
- nearest major external target must be within `3R`

### Short hard gates

- current context is within allowed session / killzone
- price is in Premium
- buy-side liquidity is swept
- bearish structural shift occurs within `15` bars of sweep
- a fresh bearish FVG exists after the shift
- a structural stop can be computed
- TP1 and TP2 can be computed
- nearest major external target must be within `3R`

## 5.2 Soft confluences

These may contribute to score or confidence only:

- EMA bias
- HTF trend alignment
- volume strength beyond minimum shift requirement
- OB confluence
- sweep source prestige beyond minimum accepted source
- session-specific narrative tags

## 5.3 Context-only components

These must never block a trade by themselves:

- dominant side score
- dashboard trend summary
- candidate preview
- performance panels

## 6. Default Operating Context

## 6.1 Timezone

Default timezone:

- `America/New_York`

All session logic, Silver Bullet windows, and alert session labeling must resolve through this timezone.

## 6.2 Sessions

Default sessions:

- Asia: `20:00-00:00`
- London: `02:00-11:00`
- New York: `08:00-17:00`
- London / New York overlap: `08:00-11:00`
- Silver Bullet London: `03:00-04:00`
- Silver Bullet AM: `10:00-11:00`

Derived flags:

- `isKillzone = overlap OR SB London OR SB AM`
- `isSilverBullet = SB London OR SB AM`

Minimum session policy:

- setups may only become executable during configured execution windows
- default behavior: only Killzone-qualified setups can arm orders

Configurable override:

- optional broader session execution for testing, but default remains Killzone-only

## 6.3 Market context

### EMA bias

Use:

- `EMA(200)`
- EMA slope over last `10` bars
- buffer = `0.5 * ATR(14)`

Classification:

- Bullish if `close > EMA200 + 0.5*ATR` and slope > 0
- Bearish if `close < EMA200 - 0.5*ATR` and slope < 0
- else Neutral

EMA bias is not a hard gate.

### Premium / Discount

Use dealing range lookback:

- `50` bars

Formula:

- `rangeHigh = highest(high, 50)`
- `rangeLow = lowest(low, 50)`
- `dealingMid = (rangeHigh + rangeLow) / 2`

Classification:

- `Premium` if `close > dealingMid`
- `Discount` if `close < dealingMid`

PD is a hard gate:

- longs only in `Discount`
- shorts only in `Premium`

## 6.4 Volatility and volume

Use:

- `ATR(14)`
- `SMA(volume, 20)`

Shift volume requirement:

- `volume > 1.5 * SMA(volume, 20)`

If volume is unavailable:

- allow fallback operation
- mark volume confirmation as `unknown`
- do not fail the indicator globally

## 7. Liquidity Registry

## 7.1 Tracked liquidity sources

The indicator must build a live registry of available liquidity levels from:

- Previous Day High / Low
- Previous Week High / Low
- HTF Pivot 1
- HTF Pivot 2
- optional HTF Pivot 3
- local structural pivots
- EQH / EQL clusters
- optional round numbers
- completed session highs / lows
- optional developing session highs / lows, flagged as lower-confidence

## 7.2 Default source settings

### HTF pivots

- HTF Pivot 1 timeframe: `60`
- HTF Pivot 2 timeframe: `240`
- HTF Pivot 3 timeframe: `D` disabled by default
- HTF pivot left length: `3`
- HTF pivot right length: `2`

### EQ clusters

- local lookback: `12`
- structural lookback: `32`
- max age: `220` bars
- tolerance: `0.15 * ATR`

### Round numbers

- disabled by default
- if enabled, configurable primary step and optional substep

## 7.3 Source hierarchy

The indicator must assign a tier or rank to each liquidity source.

Recommended default priority order:

1. PWH / PWL
2. PDH / PDL
3. major HTF pivots
4. EQH / EQL clusters
5. completed session highs / lows
6. external pivots
7. round numbers
8. internal pivots
9. developing levels

Suggested numerical priorities:

- `PWH/PWL = 100`
- `PDH/PDL = 80`
- `HTF Pivot 3 = 88`
- `HTF Pivot 2 = 78`
- `HTF Pivot 1 = 68`
- `EQH/EQL = 70`
- `Session = 60`
- `External Pivot = 50`
- `Round Number = 35`
- `Internal Pivot = 25`
- `Developing = 15`

These priorities may be used in target selection and sweep ranking, but not as a replacement for hard setup conditions.

## 8. Sweep Detection Model

## 8.1 Sweep definition

A sweep is valid only if price takes liquidity and closes back inside on the same bar.

### Long-context sweep

This is a sweep of sell-side liquidity:

- target level is below prior price
- `low <= level`
- `close > level`

### Short-context sweep

This is a sweep of buy-side liquidity:

- target level is above prior price
- `high >= level`
- `close < level`

## 8.2 Sweep metadata to capture

Each sweep event must store:

- unique id
- side
- level name
- level price
- source type
- source priority
- external/internal flag
- session / HTF / EQ / round-number flags
- sweep bar index
- sweep depth in price
- sweep depth in ATR
- wick penetration ratio
- rejection strength
- source session label
- quality score
- sweep tier / role
- sweep extreme price
- freshness state
- consumed / active state

## 8.3 Sweep quality

Sweep quality must be scored from `0` to `100`.

Minimum hard gate:

- `quality > 40`

Default grading:

- `A+ >= 75`
- `A >= 60`
- `B >= 40`
- `C >= 20`
- lower = reject / low probability

Quality should consider:

- source prestige
- externality
- sweep depth relative to ATR
- rejection quality
- displacement association
- killzone timing
- freshness decay

## 8.4 Sweep freshness

Maximum accepted sweep age:

- `20` bars

If a sweep has not produced a structural shift within `15` bars:

- the setup is no longer valid

If a sweep remains in the registry beyond the max age:

- mark it stale
- prevent it from generating new setups

## 8.5 Sweep consumption

The indicator must not destroy the precursor sweep reference as soon as a shift occurs.

Required behavior:

- preserve the precursor sweep as the setup anchor until:
  - trade becomes active
  - setup expires
  - setup invalidates

The sweep may be marked as:

- `consumed_for_new_setups = true`

But it must still remain attached to the current setup state.

## 9. Structural Shift Model

## 9.1 Philosophy

Do not model reclaim, MSS, and displacement as separate execution stages.

For this new indicator, they must be merged into one event:

- `SHIFT`

Definition:

- after the raid, price reclaims and breaks the relevant structural level with real intent
- the break must contain displacement or be immediately followed by displacement

## 9.2 Local structure pivots

Use fixed pivot lengths for local structure:

- left = `5`
- right = `2`

Do not vary these by mode.

Rationale:

- `3/1` creates micro-noise MSS
- `7/3` delays the shift too much
- `5/2` is the default institutional compromise

## 9.3 Long structural shift

A bullish shift is valid if all are true:

1. a valid sell-side sweep exists
2. the sweep is not stale
3. price reclaims the relevant reference area after the sweep
4. price breaks above the selected bullish trigger pivot
5. the shift occurs within `15` bars of the sweep
6. a valid displacement bar exists:
   - on the break candle
   - or on the immediate next candle
7. no invalidation event occurs before shift completion

## 9.4 Short structural shift

A bearish shift is valid if all are true:

1. a valid buy-side sweep exists
2. the sweep is not stale
3. price reclaims the relevant reference area after the sweep
4. price breaks below the selected bearish trigger pivot
5. the shift occurs within `15` bars of the sweep
6. a valid displacement bar exists:
   - on the break candle
   - or on the immediate next candle
7. no invalidation event occurs before shift completion

## 9.5 Displacement requirements

Displacement is part of the shift, not a later stage.

Required thresholds:

- directional candle
- body size `>= 0.9 * ATR(14)`
- body dominance `>= 0.8`
- volume `> 1.5 * SMA(20)`

Where:

- `body dominance = abs(close - open) / (high - low)`

If the break occurs without a valid displacement candle:

- classify it as sub-structure noise
- do not arm a setup

## 9.6 Shift invalidation before completion

Before the shift confirms, invalidate the setup if:

- price makes a new extreme beyond the sweep extreme
- the sweep ages out
- the required pivot is no longer structurally relevant
- price grinds without valid shift beyond the `15`-bar window

## 9.7 Shift outputs

The shift engine must return at least:

- `shiftDetected`
- `shiftValid`
- `shiftFailed`
- `shiftReason`
- `shiftBar`
- `shiftBreakLevel`
- `shiftOriginPrice`
- `shiftExtremePrice`
- `shiftPivotBar`
- `shiftAge`
- `shiftHasDisplacement`
- `shiftBodyAtr`
- `shiftBodyDominance`
- `shiftVolumeConfirmed`

## 10. FVG Engine

## 10.1 Detection rules

Use 3-candle FVG logic.

### Bullish FVG

- `low > high[2]`
- `close[1] > high[2]`

### Bearish FVG

- `high < low[2]`
- `close[1] < low[2]`

## 10.2 Zone bounds

For bullish FVG:

- `top = current low`
- `bottom = high[2]`
- `ce = (top + bottom) / 2`

For bearish FVG:

- `top = low[2]`
- `bottom = current high`
- `ce = (top + bottom) / 2`

## 10.3 Freshness and expiry

FVG expiry:

- `25` bars

An FVG is invalid for entry if:

- it predates the shift
- it is mitigated before order creation
- it is older than `25` bars

## 10.4 Mitigation rules

Default mitigation:

- bullish FVG mitigated if `close < bottom`
- bearish FVG mitigated if `close > top`

This is close-based, not wick-based.

## 10.5 FVG grading

Grade only for metadata and visualization.

Suggested grading:

- Grade A:
  - gap size `> 0.5 ATR`
  - and middle candle is displacement-quality
- Grade B:
  - gap size `> 0.3 ATR`
  - or middle candle is displacement-quality
- Grade C:
  - valid but weaker

Hard gate:

- any fresh, post-shift, unmitigated FVG is acceptable

## 11. Order Block Confluence

Order block is optional confluence, not a hard gate.

Suggested definition:

- last opposite candle before the confirmed shift leg

Confluence test:

- bullish OB confluence if price returns into bullish OB zone while setup remains valid
- bearish mirror for shorts

OB may affect:

- confidence
- annotation
- optional target refinement

OB must not be required if a valid post-shift FVG exists.

## 12. Entry Model

## 12.1 Modes

The indicator must support three execution styles:

- `Aggressive`
- `Balanced`
- `Conservative`

Mode differences must affect:

- entry location
- stop basis
- pending expiry

Mode differences must not affect:

- local pivot length
- core sweep definition
- core shift definition

## 12.2 Aggressive

Entry method:

- immediate execution state on shift close

Hard constraint:

- the shift candle must not be extended more than `1 ATR` from the break / pivot reference

Default stop basis:

- below trigger candle low for longs
- above trigger candle high for shorts

Use only if:

- the user explicitly selects Aggressive

## 12.3 Balanced

This is the default mode.

Entry method:

- limit plan at FVG entrance

Definitions:

- long entry = bullish FVG upper boundary
- short entry = bearish FVG lower boundary

Default stop basis:

- structural origin / displacement origin

Pending expiry:

- `12` bars after shift

## 12.4 Conservative

Entry method:

- limit plan at FVG CE

Definitions:

- long entry = bullish FVG CE
- short entry = bearish FVG CE

Default stop basis:

- outside sweep extreme

Pending expiry:

- `10` bars after shift

## 12.5 Entry extension filter

Use extension only to avoid chasing.

Recommended rules:

- Aggressive immediate entry invalid if current price is more than `1 ATR` beyond the structural break area
- Balanced / Conservative do not use the current close as entry; they rely on pending limit prices instead

## 13. Stop Model

## 13.1 Primary structural stop formula

### Long

- `stop = min(sweepExtremeLow, shiftOriginLow) - 2 * syminfo.mintick`

### Short

- `stop = max(sweepExtremeHigh, shiftOriginHigh) + 2 * syminfo.mintick`

## 13.2 Mode-specific preference

- Aggressive:
  - trigger candle / shift candle stop
- Balanced:
  - shift origin stop
- Conservative:
  - sweep extreme stop

If using mode-specific basis, the indicator must still expose:

- `structuralStop`
- `modeStop`

And must clearly declare which one is active.

## 13.3 Invalid stop conditions

Do not create an order plan if:

- stop cannot be computed
- stop is on the wrong side of entry
- stop distance is effectively zero
- target model fails because R is unusable

## 14. Target Model

## 14.1 Philosophy

Targets must be liquidity objectives, not fixed risk multiples.

## 14.2 TP1

Select the first internal opposing liquidity from:

- opposite local `5/2` pivot
- EQH / EQL cluster
- nearest valid internal pool on the opposite side

## 14.3 TP2

Select the first major external opposing liquidity from:

- PDH / PDL
- session high / low
- weekly high / low
- major HTF pivot
- major external pool

## 14.4 Narrative filter

Skip the setup if:

- no major external liquidity target exists within `3R`

Where:

- `R = abs(entry - stop)`

This must be checked before pending order activation.

## 14.5 Target metadata

Store:

- target price
- target type
- target name
- target distance in ATR
- target distance in R

## 15. Execution Lifecycle

## 15.1 Required states

Each side must independently move through:

1. `SCANNING`
2. `RAIDED`
3. `SHIFTED`
4. `PENDING`
5. `ACTIVE`
6. `EXPIRED`
7. `INVALIDATED`

## 15.2 Transition rules

### `SCANNING -> RAIDED`

When:

- a valid sweep occurs

### `RAIDED -> SHIFTED`

When:

- a valid shift occurs within freshness window
- a valid post-shift FVG is available
- PD gate is satisfied

### `SHIFTED -> PENDING`

When:

- mode is Balanced or Conservative
- entry price, stop, and targets are computed
- narrative filter passes

### `SHIFTED -> ACTIVE`

When:

- mode is Aggressive
- immediate execution is allowed
- extension filter passes

### `PENDING -> ACTIVE`

When:

- price trades into the pending entry level
- setup has not expired or invalidated first

### `PENDING -> EXPIRED`

When:

- pending expiry window closes without fill

### `RAIDED / SHIFTED / PENDING -> INVALIDATED`

When:

- new extreme beyond sweep invalidation point
- shift fails
- FVG becomes invalid before fill
- opposite side fills first

## 16. Side Arbitration

## 16.1 No dominant side

The indicator must not compute a single dominant trade side for execution.

Long and short contexts must be independent.

## 16.2 Conflict handling

If both long and short become `PENDING`:

- keep both pending until one fills or invalidates

If one side fills:

- cancel the other side immediately
- record cancellation reason:
  - `Opposite side filled first`

If both sides are only in pre-pending states:

- allow both to coexist
- do not suppress one because its score is lower

## 17. Internal Data Model

The implementation should define explicit types for:

## 17.1 Liquidity level

Fields:

- `id`
- `name`
- `price`
- `sourceType`
- `priority`
- `isExternal`
- `isSSL`
- `isHTF`
- `isSession`
- `isCluster`
- `createdBar`

## 17.2 Sweep event

Fields:

- `id`
- `side`
- `levelId`
- `levelName`
- `levelPrice`
- `sourceType`
- `sourcePriority`
- `qualityScore`
- `grade`
- `sweepBar`
- `sweepDepth`
- `sweepDepthAtr`
- `wickPenetrationRatio`
- `rejectionStrength`
- `sweepExtreme`
- `isConsumedForNewSetups`
- `isAttachedToSetup`
- `isActionable`
- `sessionName`

## 17.3 Shift event

Fields:

- `id`
- `side`
- `sweepId`
- `triggerPivotPrice`
- `triggerPivotBar`
- `shiftBar`
- `breakLevel`
- `originPrice`
- `extremePrice`
- `bodyAtr`
- `bodyDominance`
- `volumeConfirmed`
- `isValid`
- `isFresh`
- `reason`

## 17.4 FVG zone

Fields:

- `id`
- `side`
- `top`
- `bottom`
- `ce`
- `grade`
- `createdBar`
- `isMitigated`
- `isPostShift`
- `expiryBar`

## 17.5 Pending order

Fields:

- `id`
- `side`
- `mode`
- `modelName`
- `state`
- `entryType`
- `entryPrice`
- `stopPrice`
- `tp1Price`
- `tp2Price`
- `tp1Name`
- `tp2Name`
- `createdBar`
- `expiryBar`
- `filledBar`
- `cancelReason`
- `sweepId`
- `shiftId`
- `fvgId`

## 17.6 Virtual trade

Fields:

- `id`
- `side`
- `mode`
- `entryPrice`
- `stopPrice`
- `tp1Price`
- `tp2Price`
- `entryBar`
- `tp1Hit`
- `tp2Hit`
- `stopHit`
- `closeReason`
- `isActive`

## 18. Visualization Contract

The indicator must visually expose:

- liquidity levels
- latest actionable sweep markers
- shift marker
- FVG zones
- optional OB zone
- pending order zone
- active trade zone
- stop line / box
- TP1 line / box
- TP2 line / box
- lifecycle label
- reason / invalidation label in debug mode

### Minimum visual states

- `RAIDED`
- `SHIFTED`
- `PENDING`
- `ACTIVE`
- `EXPIRED`
- `INVALIDATED`

### Visual consistency requirement

The visuals shown for pending / active setup must use the exact same:

- entry price
- stop price
- target prices

as the internal execution model.

No separate candidate-preview risk model is allowed.

## 19. Alert Contract

The indicator must support alert-ready conditions for:

- `LONG_SHIFT_VALID`
- `SHORT_SHIFT_VALID`
- `LONG_PENDING_CREATED`
- `SHORT_PENDING_CREATED`
- `LONG_FILLED`
- `SHORT_FILLED`
- `LONG_INVALIDATED`
- `SHORT_INVALIDATED`
- `LONG_EXPIRED`
- `SHORT_EXPIRED`
- `LONG_TP1`
- `SHORT_TP1`
- `LONG_TP2`
- `SHORT_TP2`
- `LONG_STOP`
- `SHORT_STOP`

### Alert payload

Use JSON-like message content with:

- `symbol`
- `timeframe`
- `side`
- `mode`
- `state`
- `entry`
- `stop`
- `tp1`
- `tp2`
- `session`
- `pdStatus`
- `sweepSource`
- `sweepQuality`
- `shiftBar`
- `fvgTop`
- `fvgBottom`
- `fvgCe`
- `reason`

## 20. Debug Contract

When debug mode is enabled, the indicator must expose:

- active sweep id / quality / age
- selected sweep source and level
- shift validation pass/fail and reason
- FVG freshness and mitigation state
- chosen entry price and why
- chosen stop basis and why
- chosen TP1 / TP2 and why
- pending expiry countdown
- invalidation reason
- opposite-side cancellation reason
- “skip due to no major target within 3R”

## 21. Recommended Input Contract

### General

- mode: `Aggressive`, `Balanced`, `Conservative`
- debug mode toggle
- visualization toggles

### Session

- timezone
- killzone-only toggle
- London window
- New York window
- overlap window
- Silver Bullet windows

### Liquidity

- enable PDH/PDL
- enable PWH/PWL
- enable HTF Pivot 1
- enable HTF Pivot 2
- enable HTF Pivot 3
- enable EQH/EQL
- enable round numbers

### Structure

- pivot left length, default `5`
- pivot right length, default `2`
- max sweep age, default `20`
- max shift bars after sweep, default `15`

### FVG

- enable FVG
- FVG timeframe
- FVG expiry, default `25`
- mitigation mode

### Targets

- require external target within `3R`
- target ranking mode

## 22. Recommended Module Layout

If built modularly, the new indicator should be split into:

- `smc_ict_indicator_v2.pine`
- `smc_v2_core_types.pine`
- `smc_v2_session_engine.pine`
- `smc_v2_liquidity_engine.pine`
- `smc_v2_sweep_engine.pine`
- `smc_v2_shift_engine.pine`
- `smc_v2_fvg_engine.pine`
- `smc_v2_entry_planner.pine`
- `smc_v2_virtual_execution.pine`
- `smc_v2_rendering.pine`
- `smc_v2_alerts.pine`

This split is recommended, not mandatory.

## 23. Acceptance Criteria

The new indicator is complete only when all are true:

1. It remains an `indicator`.
2. It never depends on `strategy.*` APIs.
3. It evaluates long and short sides independently.
4. It does not use dominant-side scoring for execution.
5. It uses fixed `5/2` pivots for local structure.
6. It uses a max sweep age of `20` bars.
7. It requires shift completion within `15` bars of the sweep.
8. It requires displacement body `>= 0.9 ATR`.
9. It requires body dominance `>= 0.8`.
10. It requires volume `> 1.5 * SMA(20)` when volume is available.
11. It uses FVG as the primary entry locator.
12. Balanced mode uses FVG entrance.
13. Conservative mode uses FVG CE.
14. Stops are structural.
15. Targets are liquidity-based.
16. Setups with no major target within `3R` are skipped.
17. Pending orders are stored as explicit order plans.
18. First fill cancels the opposite side.
19. The precursor sweep remains attached to the setup until completion, expiry, or invalidation.
20. Alert payloads include exact execution prices and reasons.

## 24. Non-Goals

This specification does not require:

- broker execution
- TradingView Strategy Tester compatibility
- optimization engine
- automatic portfolio sizing
- multi-symbol scanning inside one script

## 25. Delivery Requirement

Any implementation based on this spec must ship with:

- the indicator source
- a short implementation note mapping code modules to this spec
- at least one debug mode
- alert conditions for all execution states
- visual confirmation that the internal order plan and chart rendering use the same prices
