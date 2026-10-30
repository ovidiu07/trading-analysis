# Volume profile: ICT checklist upgrade

This version adds an explainable entry-selection workflow to `devtrader-volume-profile.pine`. It remains an indicator: it places no orders, reports no simulated profit, and assigns no win probability. Its rules are research hypotheses, not demonstrated improvements to the strategy's expectancy.

## Internal and session liquidity expansion — local implementation, chart verification pending

The 2026-10-30 multi-source changes below are implemented locally and pass **80 checks**. They have **not** been compiled or loaded in TradingView: desktop control was unavailable during this extension. The last verified live TradingView version remains revision 6 from the earlier step-by-step UI change. A screenshot of the chart does not establish that this new source is installed.

The new default **Reversal sweep reference = Combined liquidity** monitors the following enabled sources concurrently:

| Source | Default | Availability / interpretation |
|---|---|---|
| Previous configured session H/L | On | Completed, observed and aligned profile-session ranges; old unraided levels retained for three elapsed days. |
| Asia range H/L | On | Completed 00:00–08:00 UTC range. |
| London range H/L | On | Completed 08:00–12:00 Europe/London range. |
| New York range H/L | On | Completed 09:30–16:00 America/New_York range. |
| Confirmed swing H/L | On | Chart-timeframe pivots, usable only after their confirmation bar; cleared at the configured trading-session reset. |
| EQH / EQL | On | Two consecutive confirmed pivots within max(2 ticks, 0.05 × ATR at the second pivot), at least three bars apart, with no intervening excursion beyond the outer edge. Uses the higher high / lower low as the pool edge. |
| Daily open | Context only | Calendar midnight in America/New_York, using the first observed chart-bar open after the boundary. Displays above / below / at, price and actual opening-bar time. Optional Reclaim trigger enables one raid from each side per day. |

Session hours/timezones, source switches, equal-level tolerance/separation, lifetimes and daily-open role/timezone are editable in **7A · Liquidity sources & daily open**. These windows are explicit research definitions, not inferred exchange sessions. Internal/external liquidity depends on the dealing range being analyzed; this indicator names source provenance rather than claiming universal classifications. Daily open is a reference, not proof of resting stops.

Each level must be known before its sweep candle. A low raid requires the prior close at/above the level, penetration below it, and a confirmed close back above; highs are symmetric. Default qualifying penetration is one tick. Any penetration consumes the level, even if too shallow for the configured trigger or without a reclaim. Consumed levels cannot trigger later. A candle raiding both sides does not choose a direction. If several same-side levels qualify, the closest to the previous close is selected; exact-price ties favor EQ, named session, prior configured session, swing, then daily open. The checklist records the selected name/price and count of additional swept levels. This is a deterministic selection policy, not a claim that one source is more profitable.

Completed session levels are published when the range closes and monitored outside the entry session too. An overnight raid therefore consumes the level before the next trading window. Incomplete or boundary-straddling ranges are excluded. Coverage is relative to available chart bars, not a guarantee about vendor completeness. The level registry is capped at 80 references. Internal levels expire after 250 actual chart bars by default (and at a configured-session reset); completed-session levels expire after three elapsed 24-hour days. Daily-open references reset at local midnight and remain unavailable if opening history is missing or a chart candle straddles that boundary.

**Location context** replaces the blanket prior-value gate for local sources. With **By liquidity source** selected, a previous configured-session sweep retains the prior-value reclaim rule. A local-session, swing, EQ or daily-open setup requires the planned FVG entry in discount for longs / premium for shorts of the frozen sweep-extreme-to-opposing-structure range. Its midpoint and the entry are printed in the reason. **Prior value for every sweep** restores the strict prior-value rule across sources. Continuation retains its original prior-value acceptance rule.

**Nearest opposing liquidity** is the new target default: choose the closest enabled, unraided opposing high/low beyond the whole FVG confirmation candle. Daily open is excluded from target selection. The engine does not skip a nearby target to improve R; missing targets remain unavailable. The target name and price freeze at formation. **Previous session extreme** retains the previous target model. Both location and target changes are strategy hypotheses requiring comparison with the old configuration; the added sources do not by themselves prove better entries.

The checklist shows the actual sweep source and price, location rule and boundary, target name/price/R, and a separate daily-open context row. Detailed mode also reports range coverage. Source identity is frozen at the structure break and then copied into the candidate, label tooltip, alert detail and historical result so a later sweep cannot relabel an older setup. No extra liquidity lines are drawn by default.

Existing TradingView instances may preserve **Previous session** from the older input. After updating, explicitly select **Combined liquidity**, **By liquidity source**, and **Nearest opposing liquidity** to use the expanded defaults. These changes do not alter the session definitions in other indicators on the layout.

Pending TradingView verification: compile the main script and regenerated QA indicator (15 deterministic lifecycle/liquidity assertions), inspect the named references on 1m and 5m, verify daily-open Context only versus Reclaim trigger, confirm overnight consumption and incomplete-range exclusions in replay, then restore the chosen chart configuration. The local adapter executes production scalar/collection helpers but cannot substitute for the Pine compiler, footprint feed or rendering checks.

## Automatic timeframe presets and chart density

The defaults are now **Auto by timeframe** and **Entry focus**. Effective thresholds change when the chart timeframe changes. Pine requires constant input defaults, so the numeric input boxes cannot themselves show a different default per timeframe: auto-managed inputs are disabled while Auto is selected. The checklist header tooltip lists the effective settings; choose **Manual** to use the numerical inputs instead.

| Chart timeframe | Minimum RVOL | Extreme delta | Stack rows / ratio | Swing strength | Displacement body / prior ATR | FVG expiry |
|---|---:|---:|---:|---:|---:|---:|
| Seconds | 2.0× | 50% | 5 / 400% | 8 | 1.2 | 60 bars |
| 1 minute | 1.6× | 45% | 4 / 400% | 5 | 1.0 | 15 bars |
| Above 1 through 5 minutes | 1.4× | 40% | 3 / 350% | 4 | 0.9 | 6 bars |
| Above 5 through 15 minutes | 1.3× | 35% | 3 / 300% | 3 | 0.8 | 4 bars |
| Above 15 through 60 minutes | 1.2× | 30% | 3 / 300% | 3 | 0.8 | 3 bars |
| Above 1 hour | 1.2× | 30% | 3 / 300% | 3 | 0.8 | 3 bars |

These are conservative engineering presets, **not empirically optimal trading settings**. Daily and higher charts still cannot qualify ICT entries; the existing intraday data gate remains. Session/timezone, setup type, execution mode, entry depth, stop buffer, risk/reward and filter-enable choices are not changed by a timeframe switch.

Auto also varies stack volume share, divergence pivot strength, break/sweep age and minimum FVG size relative to ATR. Native row size uses the chosen instrument-specific base ticks multiplied by 1/1/2/3/4/6 across the six bands, capped at 100,000 ticks. It stays constant within a chart run, as the footprint API requires. The actual row height and thresholds are visible in the header tooltip. Changing row size changes the underlying footprint aggregation, not merely its appearance.

- **Entry focus:** show only qualified ICT labels, retaining eight by default. Do not draw raw absorption/imbalance/divergence markers or per-candle POCs/value areas. Draw the current eligible FVG and its supporting imbalance; hide failed-candidate boxes. Rejection/invalidation reasons remain in the checklist. An eligible confirmed-retest setup can display its FVG while still waiting for the reaction, without an entry label.
- **Context + entries:** add context markers over the last 150 bars. Use a per-direction cooldown of approximately ten minutes, bounded to 2–100 chart bars. Require a new episode of absorption/stack/extreme delta, and prioritize absorption over stacked imbalance over divergence on the same side. Per-candle auction levels are limited to the recent-POC window. Auto retains at most four imbalance zones.
- **Full diagnostics:** restore raw context episodes, all lifecycle labels (up to 80), the manual zone-history limit and full context history. Automatic thresholds still apply unless Parameter mode is also set to Manual.

The context cooldown never blocks the ICT candidate engine. It does affect the corresponding context event alerts; their timings can differ from the earlier version. ICT dynamic alerts default to **Qualified entries**; **All state changes** is optional. Alerts still require the explicit enable switch and a TradingView alert to be created. Auto always confirms events at candle close.

To adopt these settings in an existing TradingView instance, update its code and select Auto by timeframe / Entry focus. Existing saved input values may be retained. The desktop snapshot showed two Devtrader Order Flow instances (one hidden); check that the updated instance is the one being displayed. Other indicators' markers are outside this script's control.

## Starting configuration

1. Use standard intraday candles with **Native Footprint**. TradingView Premium/Ultimate is still required because this script contains a footprint request, even when LTF Estimate is selected.
2. Set the profile session and timezone to the actual auction being studied. For example, a custom daytime session must begin and end on chart-bar boundaries. Use IANA regional timezones for local market sessions so daylight saving changes are handled locally.
3. For a session-based model, select **Session only** reset. Calendar Daily/Weekly/Monthly profiles remain available and are explicitly different from configured-session extremes and calendar-day pressure.
4. Start with **Reversal** and **Limit at FVG** for pre-entry selection. Choose **Confirmed retest** only if the execution plan really waits for a reaction close.
5. The three proposed filters—source-aware location, displacement participation and fresh imbalance overlap—are independently switchable. A separate target-room filter is enabled by default. Defaults are starting hypotheses, not optimized parameters.
6. The participation default is **Recent bars**, excluding the current bar. **Same session time** is optional and needs the configured minimum number of samples from prior sessions. Minimum samples must not exceed the prior-session lookback. It supports minute-aligned intraday timeframes of one minute or longer; other timeframes show insufficient data when this baseline is required.
7. Enable **ICT state-change alerts**, then create a TradingView alert using **Any alert() function call**, if desired. Alerts are off by default. Recreate TradingView alerts after changing code or inputs because alerts use saved script configurations.

The first loaded profile is conservatively incomplete. Later profiles and session ranges require observed chart history across the configured opening boundary; a candle exactly at the opening timestamp is not required. This accommodates market closures. Completeness is relative to the available chart feed: it cannot prove that a vendor omitted no candles. Misaligned session bars and missing flow on bars with positive or unknown chart volume still block qualification. A zero-volume candle does not contaminate the entire profile. Allow enough history for complete profiles, confirmed swings and volume baselines.

## What a candidate means

The detector uses **chart-timeframe** structure, not an inferred higher-timeframe bias. The default pivot strength is three bars on each side; a pivot is used only after confirmation and never on the bar that first confirms it. Pivot centers from previous sessions are not imported into the current session's structure.

### Reversal

- Raid and reclaim an enabled, previously known liquidity reference as defined in the expansion above.
- A candle sweeping both sides does not arbitrarily select a direction.
- On a later bar, close through the opposing structure level that was known when the sweep occurred. The sweep-to-break age is configurable.
- A subsequent confirmed three-candle FVG must have a directional middle candle. Its body must meet the body/prior-ATR and body/range thresholds. The ATR reference precedes that middle candle.
- The structure break must have occurred no later than the FVG's middle candle, within the configured break-to-FVG age.
- When location filtering is enabled, apply the selected source-aware rule: prior-value reclaim or local range discount/premium. Strict prior value can be selected for every source.

### Continuation

- Require confirmed higher highs and higher lows for longs, or lower highs and lower lows for shorts, within the configured session.
- Close through the latest confirmed swing in that direction.
- Apply the same displacement and FVG timing requirements.
- When the location filter is enabled, require the configured number of consecutive confirmed closes above prior VAH for longs or below prior VAL for shorts. These are fixed completed-profile levels, not moving developing boundaries.

In both modes, native data is required for all three FVG candles. Session data gaps, estimated/mixed session flow, misaligned session boundaries, nonstandard charts and profile overflow block qualification. Absorption, session delta and CVD divergence are supporting information, not additional mandatory entry filters.

## Frozen checklist observations

At FVG confirmation the script records:

- Direction, FVG bounds and confirmation bar.
- Planned limit price at the configured depth into the gap, rounded to the instrument's tick.
- Structural stop: the sweep extreme for reversal, or structural swing for continuation, plus a tick buffer. Broken structure is discarded; the stop is not moved to rescue it.
- The selected nearest opposing unraided level, or the previous configured-session extreme in legacy target mode. Neither model discovers every possible ICT liquidity objective.
- Swept reference name/price, location model, frozen boundary and location result.
- Middle candle RVOL, with its selected baseline excluding the current sample.
- Fresh same-direction native imbalance overlap from the middle candle, when required.
- Available R to the fixed target. Missing, wrong-side or already-reached targets do not qualify when the room filter is enabled. R excludes costs and slippage.

Only the largest qualifying contiguous stack in each direction is retained from each footprint candle. A stack must satisfy the row count and minimum share of the candle's volume. This intentionally bounded selection can omit a smaller stack that would otherwise overlap the FVG.

One candidate is tracked at a time. Only the first qualifying displacement FVG associated with a recorded break is assessed; a failed filter is not repaired retroactively using subsequent price action. New candidates do not replace an active candidate, nor overwrite its terminal transition on the same bar. The terminal result appears in **Last result** on later bars, with its age and reason; the main sequence resumes watching the next opportunity.

## Entry timing and lifecycle

| Status | Meaning |
|---|---|
| WAITING | No complete structural candidate yet, or a prequalified setup is waiting for a retest reaction. |
| CONDITIONS MET | All enabled conditions were met at this confirmed assessment. Limit mode: before a later touch. Retest mode: at the reaction close. |
| FILTERED | A structural candidate failed at least one enabled filter. It will not become qualified after a favorable outcome. |
| INSUFFICIENT DATA | Required native data, completed references, baseline or alignment is unavailable. |
| ENTRY TOUCHED | A later bar traded through a prequalified limit reference. This is not a verified fill or a winning trade. |
| INVALIDATED | The structural stop was breached, the FVG closed through its far edge, or the required supporting imbalance invalidated. |
| EXPIRED | The session ended, the bar-age limit elapsed, a supporting zone expired, or the target was reached before entry assessment. |
| REVIEW | OHLC cannot resolve execution order, such as target and retest in the same bar or a gap past the limit. |

The creation bar cannot retest its own FVG. Invalidation takes priority over a same-bar touch; the reason explicitly flags stop/touch ambiguity. A target and retest in the same bar produce REVIEW, not a favorable assumed execution.

In **Confirmed retest** mode, after price touches the FVG, require a close beyond its near edge in the setup direction, a matching candle body and directional normalized delta. The close becomes the entry reference and R is recalculated. A late reaction can fail the R filter even if the original limit reference qualified. The close is not a guaranteed executable price.

Once a touch or confirmed reaction is recorded, the indicator does not manage a trade or calculate its outcome. Historical footprint data may change on reload. Confirming script state at candle close removes within-candle status flicker; it does not guarantee an immutable historical data feed.

## Readability and layout

The `0A · Readability & layout` group controls presentation independently of signal thresholds:

- **Compact** (default): fourteen rows with three columns—step, status and reason. All eight named checks remain visible: liquidity sweep, structure break, displacement/FVG, prior-value location, volume participation, fresh imbalance, target room and entry assessment. **Detailed** adds profile and named-session coverage rows, for sixteen rows total. Daily-open context is shown in both layouts.
- Step statuses distinguish **Passed**, **Waiting**, **Failed** and **Unavailable**. Disabled filters show **Off**; Continuation explicitly marks the sweep **Not required**. A missing reference is never counted as a failed market condition or a pass.
- The sequence is a confirmed-bar snapshot. Before a candidate, it displays the most recent pending direction while both directions remain monitored. Price-structure progress remains visible when volume data is unavailable. Filter values freeze when the FVG is assessed; active entry/stop/target references remain separate from historical outcomes.
- **ASSESSMENT** shows the current blocking reason or next price condition. **Closed-bar data** reports native-data availability separately. This prevents an old rejected candidate from looking like the current setup.
- Checklist text defaults to **normal**, independently of the optional pressure dashboard. Explanations wrap at word boundaries, with the full reason available on hover. No checklist rows force tiny text.
- The data badge uses two lines and has its own font and top/bottom-center position controls.
- Zone text defaults to **Diagnostics only** and requires at least six bars of width. Zone geometry, fading and state calculations still run with hidden text. Pine cannot guarantee a minimum pixel height for price-anchored boxes at every zoom.
- Qualified entry labels use two lines (`LONG/SHORT` and `LIMIT READY/RETEST MET`) with configurable text size and full assessment details on hover. These labels are conditions, not executed orders.
- Profile numbers stay on one line; side-by-side values have a space at the center divider. The minimum width defaults to six bars and scales up for full numbers or normal-size text. Combined sell/buy summaries need twice the base width. Zoom can still affect fit: increase the minimum width or turn values off if necessary.
- Event marker zeros are excluded from the status line. Individually named settings use separate rows to avoid inline alignment warnings.
- If both of this indicator's panels select the same corner, the checklist moves to the opposite vertical corner. Other indicators' tables cannot be detected; choose positions manually to avoid their panels.

Existing TradingView instances retain saved settings. Select **Auto by timeframe + Entry focus** explicitly if an instance previously used Full diagnostics. Changing input defaults does not reset saved chart configurations.

## Chart changes

- Independent compact checklist, with reasons, filter results, entry/stop/target references and R.
- Previous completed profile VAH/VAL, starting from when those references became available. Previous POC remains an existing optional feature.
- Bounded native imbalance zones, marked fresh, tested, invalidated or expired. A retest fades a zone; a close beyond its far edge invalidates it. Zones expire at the session boundary or their age limit. Candidate validity uses the saved zone geometry even after a drawing is evicted by the history cap.
- Recent native delta versus session delta, with same-session coverage checks. These are live context, not frozen entry gates.
- An independent source/quality badge even when the full pressure dashboard is hidden.
- Potential-absorption wording and tighter candle rejection conditions. These remain candle-level hypotheses, not proof of passive liquidity.

Profile aggregation redistributes native row volume proportionally by price overlap when grids differ. This conserves buy/sell totals within capacity, but assumes uniform volume inside an indivisible native row. Estimated LTF rows still use representative prices and remain explicitly approximate. Display buckets now use equal price intervals, retaining empty buckets instead of grouping arbitrary occupied keys across gaps. Coarse display rows still cannot resolve structure finer than their displayed interval.

The existing custom value-area algorithm remains explicit: start at the highest-volume bin (ties prefer the bin nearest the profile mean), add the larger next occupied neighboring bin until at least the requested percentage is included; equal neighbors favor the upper side first. Its overshoot and tie policy can differ from TradingView's built-in value area. Do not expect exact parity across different algorithms, feeds or resolutions. Profile mean remains labeled mean, not VWAP.

## Validation

Run:

```sh
python3 backend/src/main/resources/pine/prod/qa-volume-profile.py \
  --write-harness backend/src/main/resources/pine/prod/qa-volume-profile-lifecycle.pine
git diff --check
```

The local suite executes the **actual extracted lifecycle and rebinning helpers** through a deliberately limited scalar-expression adapter. It also evaluates the production session-anchor expressions against timezone-aware dates and checks critical source wiring. This is not a Pine compiler and does not exercise footprint feeds, chart rendering, full candidate detection or Pine realtime rollback.

At the earlier UI implementation review, **50 local checks passed**, including exact preset-expression evaluation at timeframe boundaries, Manual override restoration, parameter bounds, display/analysis separation, observed session openings across closures, first-period incompleteness, zero-volume handling and workflow status semantics. The current generated Pine harness contains fifteen deterministic lifecycle/liquidity assertions using the production helpers. It has been generated but **not compiled or executed in TradingView**. The main indicator was compiled and visually exercised in TradingView on 2026-10-29 and 2026-10-30; full lifecycle replay/performance verification is still outstanding.

Desktop UI checks on 2026-10-29 used VANTAGE:GER40FT standard candles with the user's existing multi-indicator layout:

- Blue circles visible when the indicator was selected disappeared after clicking blank chart space: these were TradingView selection handles, not additional entry signals.
- Existing instance: Full diagnostics produced dense zone annotations; Entry focus removed that zone text. Increasing the old dashboard font exposed the hard-coded tiny rows.
- Revised instance: compiled and saved in Pine Editor, with the former inline-input warnings absent. The older active instance was hidden to avoid duplicate visuals.
- Compact and Detailed checklist layouts rendered with a consistent font; 1m, 5m and 15m showed the corresponding automatic preset in the badge/header.
- Profile enabled during testing exposed split numeric suffixes in narrow rows. Final single-line text and six-bar width checks were visually verified. Profile visibility was restored to the user's prior off setting.
- Both panels set to Bottom right: checklist moved to Top right and pressure matrix remained Bottom right. Afterwards pressure matrix was hidden and its position restored to Top right; the checklist returned to Bottom right. Final active settings: 1m, Auto by timeframe, Entry focus, Compact, normal checklist font.
- Previous saved TradingView script revision: 4, `Devtrader Order Flow & Volume Profile Upgrade`. Older chart instances remain hidden for comparison.
- The chart reported PARTIAL PROFILE / INSUFFICIENT DATA. This is a data/reference state, not a qualified entry; no filters were weakened to manufacture a signal. Qualified-entry rendering and all lifecycle states still require targeted replay coverage.

Desktop verification on 2026-10-30 for the step-by-step correction:

- Main script compiled and saved as revision **6** of `Devtrader Order Flow & Volume Profile Upgrade`; no new compiler errors appeared.
- GER40FT 1m displayed every named step, its status and a readable reason. Native closed-bar data showed **Ready**; the previous false partial-profile blocker cleared. The waiting sweep references were 25772.30 / 26243.80 at the time of inspection.
- GER40FT 5m selected **AUTO 2–5m** and a 1.4× participation minimum, versus 1.6× on 1m. Detailed layout showed usable prior coverage and observed current chart coverage.
- The historical rejected setup moved into Last result. On 1m its reason was prior-value location; on 5m it was no fresh displacement imbalance overlapping the FVG. These are historical assessments, not current entry instructions.
- A temporary **LTF Estimate** configuration showed **BLOCKED**, with **Unavailable** beside closed-bar data, prior-value location, volume participation, fresh imbalance and entry assessment. Each row explained the missing native requirement; price-structure rows remained visible. Native Footprint was restored after the test.
- Chart testing caught and corrected a header merge that was being removed by table clearing. Compact and Detailed layouts now use the full header width and narrower step columns.
- Final configuration: **1m / Auto by timeframe / Entry focus / Compact / normal checklist text / Native Footprint**. The profile histogram and pressure matrix remain off; older indicator instances remain hidden.
- This verifies compilation, the displayed waiting/data states, reference availability, layout and timeframe/source switching. It does not establish trading performance or visually exercise every qualifying-entry/lifecycle transition.

Before using signals, verify in TradingView:

1. Compile both files; the current harness should display PASS with fifteen checks.
2. Compare 1m and 5m standard charts, session-restricted history, overnight sessions and a DST transition. Partial session bars must not qualify.
3. Confirm that candidate labels appear on FVG confirmation or retest confirmation, never retrospectively at the sweep. Existing CVD pivot dots still use their documented backward offset; they are not entry marks or checklist gates.
4. Verify missing footprint history and estimated/mixed sources produce no qualifying checklist entry. Test warmup for both RVOL baselines.
5. Check visual layout at typical zoom and maximum profile/zone settings. Drawings are bounded and the upgrade adds no new plot-count-consuming calls.
6. Compare live alert timestamps with saved screenshots and a later reload, keeping footprint-source revisions separate from script logic.

## Strategy evaluation

Freeze the underlying ICT rules and execution mode. Record every eligible structural opportunity, including filtered ones, with the contemporaneous filter values. Compare the baseline with each filter individually and then a predefined combination; do not continually tune parameters around the same trades. Report after-cost expectancy in R, drawdown, retained trade count, losses avoided and winners excluded. Validate unchanged rules on a later untouched period and in forward observation.

No performance improvement has been established by this implementation. Automatic HVN/LVN detection, multi-session untouched-POC history, detailed extreme-row absorption analysis, multiple simultaneous candidates and automated performance attribution are outside this first checklist upgrade.
