# DEVTRADER-CHART.PINE FORENSIC AUDIT

All line references below point to [devtrader-chart.pine](/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/devtrader-chart.pine:1).

## 1. Executive Diagnosis

Technical explanation: The script does generate setups, but `Det` is counting only qualified sweep wait-states, not executable trades. The main failure is the transition from `qualified sweep` to `validated setup` and then into `entry-ready / entered`. The dashboard then mixes that narrow lifecycle with a much broader HTF / market-structure rendering layer. `Det` increments at 3054-3059 and 3068-3073; `Val` increments only at 3237-3260; entry / live trade / result tracking only exist at 3418-3698; dashboard stats are assembled at 4002-4006.

Trader explanation: This behaves more like a context-and-narrative indicator with a small trade engine attached, not like a fully coherent sweep-to-entry execution model. The chart can legitimately look “SMC active” because HTF bias, CHoCH/BOS/IDM, session boxes, and liquidity labels are working, while the actual trade engine remains inert.

Exact code references: detection 2781-3073; validation 3200-3261; execution arming 3418-3551; entry 3586-3658; resolution 3660-3698; dashboard assembly 3979-4017.

Confidence: High. `Det` is cumulative and non-resetting; `Val`, `Ent`, `W/L/BE` are also cumulative and non-resetting. If the screenshot shows `Det 19 | Val 0 | Ent 0`, then 19 sweep setups were started historically, and none ever passed the code’s validation/entry path.

## 2. Trade Lifecycle Map

1. Liquidity pool creation: `liq_pool` objects are created from swings, sessions, period levels, and HTF levels at 1142-1290. Trader meaning: the script maps potential liquidity venues well. Status: fully implemented.

2. Liquidity aging / state tagging: pools are reclassified as `FRESH`, `TAGGED`, `SWEPT`, `CONSUMED`, with pending sweep state at 1340-1372. Trader meaning: this is the liquidity memory layer, not a trade object. Status: fully implemented.

3. Sweep candidate recording: pending sweep state is stored per pool with `pendingSweepBar`, `pendingSweepExtreme`, `pendingWickRatio` at 2807-2824 and 2956-2962. Trader meaning: the script does track raid windows and multi-bar reclaim attempts. Status: fully implemented.

4. Sweep qualification: `clusterSweepValid` is built at 2868-2885, scored at 2887-2902, then filtered through `f_qualifySweep()` at 1918-1953 and applied at 2972-2995. Trader meaning: this is the real “candidate narrative” filter; it is strict and contextual. Status: fully implemented.

5. Setup detection: `Det` increments only when a new wait-state is started at 3054-3059 or 3068-3073. Trader meaning: “detected” means “qualified sweep candidate now being watched,” not “trade found.” Status: fully implemented, semantically misleading.

6. Reclaim / rejection progression: wait-state rejection is updated by `f_evalRejectionTier()` at 1955-1984 and applied at 3107-3110; failures reset at 3112-3128; timeout resets at 3130-3155. Trader meaning: many candidates die here before any MSS confirmation. Status: fully implemented.

7. Structure reference resolution: post-sweep internal/external refs are resolved at 2220-2250 and seeded at 2983-3004. Trader meaning: this chooses what swing must break after the sweep. Status: fully implemented.

8. Validation: the only code path that increments `Val` is `chartStructureConfirmS/L` at 3234-3260. Trader meaning: CHoCH/BOS/IDM visuals alone do not validate a trade; only this narrow swing-break branch does. Status: partially implemented relative to the broader visual model.

9. Execution arming: after validation, an execution model is armed at 3418-3551 using `FVG`, `OB`, `RECLAIM`, or `CONT`. Trader meaning: this is the entry template selection layer. Status: implemented, but partly inconsistent.

10. Entry trigger: raw entry signals are generated at 3586-3589; blocked signals increment `Blk` at 3590-3595; successful entries increment `Ent` and create the live trade at 3600-3658. Trader meaning: no entry, no stats. Status: fully implemented.

11. Live trade management: stop / target / BE logic runs only on live trades at 3660-3698. Trader meaning: results exist only for fully entered trades. Status: fully implemented, with some exit-accounting gaps.

12. Dashboard render: context rows are built at 3979-4017; stats row is just a formatted view of counters, not an object-level lifecycle table. Trader meaning: snapshot context and cumulative performance are being mixed in one panel. Status: implemented, but conceptually incoherent.

## 3. Data Structures and State Audit

Technical explanation:
- `reaction_zone` at 29-40 is render-only. It is created at 3701-3704, selected at 3719-3791, rendered at 3797-3942. Fields `isMitigated` and `isInvalidated` are dead; nothing mutates or reads them.
- `liq_pool` at 42-68 is the real structural memory object. It is populated at 1142-1290, mutated at 1310-1372 and 2781-3034, consumed by sweep selection at 2781-2995, target/conflict selection at 3305-3416, and rendered at 1384-1491.
- `liq_render_row` at 70-78 is a last-bar render aggregate only, built at 1390-1471 and drawn at 1472-1491.
- Sweep/setup lifecycle is not object-based. It lives in scalar globals `waitS/waitL`, `waitSweepLevel*`, `waitRejectionTier*`, `waitStructureConfirmed*`, `waitExecModel*`, `waitSetupId*` at 1630-1739.
- Active trade state is also scalar, single-position only: `active`, `bull`, `activeEntryPrice`, `activeInitialStop`, `tSL`, `t10`, `activeEntryBar` at 1709-1716.
- Stats are scalar counters only: `setupsDetectedCount`, `setupsValidatedCount`, `entriesTriggeredCount`, `blockedTradesCount`, `winsCount`, `lossesCount`, `breakEvensCount` at 1702-1708.
- Market-structure state is rich and independent: `ms_*` pivots, protected levels, bias, IDM state, event bars, and internal pivot arrays at 1750-1797.

Trader explanation:
- The script has a serious architectural split: liquidity and market structure are object-like and historical; setups and trades are just “current side” flags plus a few counters.
- That means you do not have a historical setup ledger. You have one live long narrative, one live short narrative, one live trade, and some cumulative integers.
- Because of that, many detections can vanish by expiry / failure / opposite-sweep reset without leaving a structured audit trail.

Exact code references:
- Current wait-state reset/start helpers: 1608-1627.
- Setup reset paths with no terminal bookkeeping: 3035-3050, 3112-3155, 3602-3608, 3632-3638.
- Dead/orphaned fields/counters: `tSetups`, `w10`, `l10`, `be10` at 1698-1701; `lastShortValidationKey`, `lastLongValidationKey` at 1738-1739; `bestSweepPivotPrice/Bar/Tier` at 2766-2768 and 2975; `sweepClass` at 2752 and 2927; reaction-zone flags at 38-39.

Assessment:
- `liq_pool`: coherent and heavily used.
- `reaction_zone`: render helper, not lifecycle state.
- Wait-state scalars: functional but too narrow.
- Stats counters: partially wired.
- Historical result state: absent.

## 4. Detection Engine Audit

Technical explanation:
- Liquidity sweep detection is at 2781-2977. Hard gates include external-only mode 2790, close back inside 2879, volume 2876, penetration 2873, depth 2872, reclaim threshold 2874, wick efficiency 2875, retap/news/grind filters 2869-2871, and grade floors 2778-2779.
- Structural sweep qualification is then filtered again in `f_qualifySweep()` at 1918-1953 by swing alignment 1932-1935, structural rank 1937-1940, major-location logic 1941, dealing-range filter 1907-1916 and 1943, and mode-specific minor/major rules 1945-1952.
- Reclaim behavior is re-evaluated after detection by `f_evalRejectionTier()` at 1955-1984 and applied at 3107-3128. This creates `CONFIRMED`, `WEAK`, or `FAILED`.
- Confirmation swing selection is at 2001-2089 and 3200-3219. It requires confirmed untaken pivots, minimum leg ATR, and bar-age conditions.
- Validation is then limited to `chartBreakA/B/C/D` at 3220-3229 and `chartStructureConfirmS/L` at 3234-3260.
- Separate CHoCH/BOS/IDM structure visuals live at 2299-2741 and internal/external shift labels at 3272-3303.
- Execution template selection is at 3418-3551. FVG uses 2091-2106; OB uses 2108-2120; LTF MSS refinement uses 2124-2262 and 3555-3562.
- Target selection is at 3305-3416; stop and risk validity are at 3582-3585.

Trader explanation:
- The model is closer to `liquidity sweep -> reclaim quality -> selected swing break -> execution template -> trigger` than to a looser “sweep then trade bias” model.
- That is realistic in principle, but the implementation is stricter than the chart narrative suggests. It will miss many real ICT-style one-leg raid-and-displace moves because it waits for both a reclaim state and a later chosen swing break, then often waits again for FVG/RECLAIM/OB execution.
- The MS layer is visually rich, but most of it is not accepted as executable validation. A trader can see CHoCH/BOS/IDM logic on chart and assume the trade engine agrees; the code often does not.
- `useMajorMSS` is misleading. It does not control validation or entry creation; it only sets `mssS/mssL` for reaction-zone target bias at 3302-3303 and 3751/3770.
- `OB` execution is effectively dead in default `Balanced` and `Conservative` modes because `RECLAIM` is chosen first whenever `waitSweepLevel*` exists, which it normally does; see 3451-3471 and 3513-3533.

Exact code references:
- Sweep engine: 2781-2977.
- Qualification function: 1918-1953.
- Rejection tiering: 1955-1984, 3107-3128.
- Confirm swing selection: 2001-2089, 3200-3219.
- Actual validation: 3220-3260.
- MS visuals / separate structure engine: 2299-2741, 3272-3303.
- Execution arming: 3418-3551.
- Entry trigger: 3555-3589.
- Target / RR logic: 3305-3416, 3582-3585.

Frequency impact assessment:
- Too strict: external-only sweeps, dealing-range gate, confirmed-pivot / leg-min logic, weak-reclaim validation rules, narrow validation candle shapes.
- Too loose / incoherent: OB selection is simplistic and not causally anchored; FVG/OB selection is not tightly tied to the actual sweep-displacement leg.
- Structurally incomplete: MS confirmations after sweep are visible but do not validate trades.

## 5. Dashboard Audit

Technical explanation:
- `Bias` row comes from HTF and MS context only: `htfBiasText`, `ms_structureBias`, protected-level status at 3984-3995.
- `Liquidity` row comes from current nearest directional liquidity / selected wait sweep level at 3979-3983.
- `Sweep` row comes only from current wait-state variables at 3171-3175 and is rendered at 4013.
- `Structure` row is a mix of `structureStatus` and `msStateText` at 3985-3999 and 4014.
- `Timing` row is snapshot state only: active / setup / exec / watch / core at 4000.
- `Read` row is snapshot guidance based on current wait state and bias at 4001.
- `Stats` row is assembled at 4002-4006:
    - `WR`: `winsCount / (winsCount + lossesCount)` at 4002-4005.
    - `Det`: `setupsDetectedCount` at 4006; increments 3055 and 3069.
    - `Val`: `setupsValidatedCount` at 4006; increments 3247 and 3260 only.
    - `Pend`: `pendingPlans` at 4004; current live `waitSetupIdL/S`, not cumulative.
    - `Ent`: `entriesTriggeredCount` at 4006; increments 3614 and 3644.
    - `Res`: `resolvedTrades = wins + losses + BE` at 4003.
    - `W/L/BE`: `winsCount`, `lossesCount`, `breakEvensCount` at 4006; increments 3678, 3681, 3691.
    - `Blk`: `blockedTradesCount` at 4006; increments only at 3592 and 3595.

Trader explanation:
- The dashboard is not reading one coherent trade ledger. Each row comes from a different semantic layer.
- `Bias`, `Liquidity`, `Structure`, and `Read` can be meaningful even if the trade engine has never validated or entered anything.
- `Det` is setup-candidate creation; `Pend` is current live wait-state count; `Res` is historical trade outcomes. That is a snapshot/cumulative mixture, which is why the row is easy to misread.

Exact code references:
- Dashboard builder: 3969-4017.
- Stats formulas: 4002-4006.
- Counter mutation sites: 3055, 3069, 3247, 3260, 3592, 3595, 3614, 3644, 3678, 3681, 3691.

Direct answers to the priority questions:
- `Det` is counted at 3055 and 3069.
- `Det` increments when a `bearSweep` or `bullSweep` starts a wait-state; that is a qualified sweep narrative, not a trade.
- `Det > 0` with `Val/Pend/Ent/Res = 0` is possible because detections can fail rejection, expire, get cancelled by breakout, or be reset by an opposite sweep before validation, and those failure paths do not increment other counters.
- Yes, the script is detecting candidate narratives more often than executable trades.
- Yes, the dashboard reads different state variables than the chart annotations and different state variables than the trade engine.

## 6. Screenshot-to-Code Correlation

Technical explanation:
- The repeated historical blue rectangles are almost certainly Asia session boxes from 571-587. The reaction-zone engine only has two current boxes (`bLong`, `bShort`) plus current plan boxes at 3836-3846 and 3895-3942, so it cannot create many historical blue setup boxes.
- The visible CHoCH / BOS / IDM reclaim labels come from the market-structure layer at 2614-2617 and 2679-2741, plus internal/external shift labels at 3272-3300.
- The dashboard text in the screenshot maps cleanly to the current-bar snapshot logic:
    - `HTF bull | MS bull intact`: 3984-3995.
    - `Above BSL ...`: 3979-3983.
    - `No validated sweep active`: 3171-3175.
    - `CORE ONLY`: 4000.
    - `Prefer longs...`: 4001.
    - `WR — | Det 19 | Val 0 ...`: 4002-4006.

Trader explanation:
- The screenshot is showing that the indicator can read structure and narrative context, not that it can monetize that context.
- The visible CHoCH/BOS/IDM labels are not proof of validated setups because those visuals come from a separate MS engine.
- The current dashboard message is snapshot-truthful but trading-semantically misleading: it truthfully says there is no live validated sweep right now, but the historical chart art makes the tool look more execution-aware than the stats engine actually is.

Exact code references:
- Asia session boxes: 571-587.
- Historical MS labels: 2614-2617, 2679-2741, 3272-3300.
- Current reaction-zone / plan visuals only: 3719-3942.
- Dashboard snapshot text: 3979-4017.

Confirmed vs inferred:
- Confirmed by code: MS labels and dashboard rows are separate systems.
- Confirmed by code: reaction-zone boxes are current-only.
- Likely inferred from the screenshot: the recurring historical blue rectangles are Asia session boxes, not trade zones.

## 7. Ranked Blockers

Critical blocker: Validation is only `chartStructureConfirm*`, while the chart’s visible MS confirmations live in a separate engine. Technical issue: `Val` increments only at 3247/3260; `msPostSweepStructureConfirmed*` at 3165-3168 does not promote the setup. Trader consequence: visible CHoCH/BOS after sweep still does not become a validated trade. Suppresses: trades and stats.

Critical blocker: There is no persistent setup object, only current wait-state scalars. Technical issue: resets at 3035-3050, 3112-3155, 3602-3608, 3632-3638 erase the active narrative with no terminal-state bookkeeping. Trader consequence: the engine silently forgets why setups died. Suppresses: stats first, then diagnostic ability.

High-impact blocker: Sweep qualification is stacked with too many hard filters before a wait-state even starts. Technical issue: external-only 2790, reclaim/close-inside 2874/2879, volume 2876, depth 2872, dealing-range 1907-1916 and 1943, swing alignment 1932-1935, structural rank 1937-1940. Trader consequence: many visually obvious inducement-led raids never become tracked setups. Suppresses: trades.

High-impact blocker: Confirmation swing selection and validation candle rules are narrow. Technical issue: confirmed untaken pivot selection at 2001-2089, then only break types A/B/C/D at 3220-3229 can validate; weak rejections only allow A or C in non-aggressive modes at 3230-3231. Trader consequence: real sweep->reclaim->shift sequences that break on weaker closes or on a different pivot are ignored. Suppresses: trades and `Val`.

High-impact blocker: `majorSweeps` default true removes internal inducement sweeps entirely. Technical issue: loop filter at 2790, plus `majorSweeps` score floors at 2778-2779. Trader consequence: the script favors external liquidity raids only and misses many internal inducement-to-external runs. Suppresses: trades.

Medium-impact blocker: `useMajorMSS` is mislabeled / effectively unwired for entries. Technical issue: only used at 3302-3303 and later 3751/3770; not used in validation or entry branches. Trader consequence: the user can think they are controlling MSS strictness when they are not. Suppresses: trust and coherence, not directly stats.

Medium-impact blocker: OB execution is effectively dead in default modes. Technical issue: in `Balanced` and `Conservative`, `RECLAIM` is chosen before `OB` whenever `waitSweepLevel*` is present at 3451-3471 and 3513-3533, which is usually always. Trader consequence: advertised execution diversity is not real. Suppresses: some entries and realism.

Medium-impact blocker: Entry blocks count only at the last moment. Technical issue: `Blk` increments only when `rawEntrySignal` already exists and the late HTF/liquidity block fires at 3590-3595. Trader consequence: earlier filtered or expired setups look like “nothing happened.” Suppresses: stats clarity.

Low-impact blocker: Result accounting ignores same-bar exits and exact touches. Technical issue: trade management starts only when `bar_index > activeEntryBar` at 3660, and uses `<` / `>` rather than `<=` / `>=` at 3672-3673. Trader consequence: some wins/losses/BE are missed. Suppresses: stats only.

## 8. Root Cause of Broken / Empty Stats

Technical explanation:
- Main root cause 1: no canonical historical setup/trade object exists. The script tracks only current long/short wait-states plus counters.
- Main root cause 2: `Val` is wired only to `chartStructureConfirm*` at 3237-3260. The broader MS confirmation layer at 3157-3168, 3272-3300, and 3985-3993 is not counted as validation.
- Main root cause 3: failure paths reset setup state without terminal counters. Rejection failure 3112-3128, expiry 3130-3155, continuation breakout cancellation 3035-3050, and opposite-side replacement 3060-3079 all drop the setup without incrementing blocked/resolved/invalid stats.
- Main root cause 4: `Blk` counts only late entry-time hard blocks at 3590-3595. It does not count earlier structural attrition.
- Main root cause 5: result tracking only exists for `active` trades at 3660-3698, so if no entries trigger, W/R stays blank by design.

Trader explanation:
- The stats are not “wrong” because the result engine is missing; they are empty because the code’s trade lifecycle is far narrower than the chart narrative.
- The chart mostly displays context. The stats only count fully promoted, entered, and resolved trades.
- The most misleading part is semantic: “validated” on the dashboard means one very specific swing-break branch, not “the broader SMC story became tradable.”

Exact code references:
- Counter formulas: 4002-4006.
- Validation path: 3237-3260 only.
- Non-counted setup death: 3035-3050, 3112-3155.
- Blocked counts: 3590-3595.
- Result engine: 3660-3698.

Most probable root-cause order:
1. Validation is wired too narrowly.
2. Setup failure / expiry paths are not represented in stats.
3. No setup object history exists.
4. Entry and result counters are downstream and therefore remain zero.
5. Exit edge cases undercount, but that is secondary.

Not the main issue:
- Active trade state lost between bars: no; `active` and trade vars are persistent `var`s.
- Result calculation never called: no; it is called at 3660-3698.
- Trade objects created then discarded: partially true for setups, not for live trades.

## 9. How To Detect More Trades Safely

Technical explanation:
- Safe changes should widen the sweep-to-validation path without turning every CHoCH/BOS label into a trade.
- Aggressive changes can increase frequency fast, but they will start diluting the ICT logic.
- Some changes should be explicitly avoided because they destroy the sweep/reclaim premise.

Trader explanation:
- The safe direction is not “more signals everywhere.” It is “stop losing structurally valid post-sweep narratives before they become executable.”
- The first gains come from reconnecting the MS layer to the trade layer and softening a few hard filters.

Exact code references: sweep qualification 1918-1953 and 2781-2977; validation 3200-3260; timeout 1846-1849 and 3130-3155; entry blocks 3572-3589.

A) SAFE CHANGES
- Promote `msPostSweepStructureConfirmed*` into a real validation path or a secondary validation state. Refs: 3157-3168, 3237-3260. Technical effect: more setups reach `Val`/`Pend` without inventing fake trades. Trader effect: aligns visible post-sweep CHoCH/BOS/protected-level damage with execution logic. Expected impact: moderate trade-count increase, large stats improvement.
- Soften `f_dealingRangeQualified()` from a hard gate to a score penalty, or apply it only to lower-quality/internal sweeps. Refs: 1907-1916, 1943-1948. Technical effect: fewer detections die before tracking. Trader effect: keeps premium/discount logic but stops over-blocking continuation or borderline discount/premium raids. Expected impact: moderate frequency increase.
- Allow weak rejections to validate on `STRONG_CLOSE` / `SEQUENCE`, not just `DISPLACEMENT` / `FVG`. Refs: 3228-3231. Technical effect: more `WEAK` setups can become `Val`. Trader effect: still requires post-sweep evidence, just not one candle archetype. Expected impact: moderate increase, small quality reduction.
- Extend wait windows, especially `MINOR` and `MAJOR` timeouts. Refs: 1846-1849, 3130-3155. Technical effect: fewer setups expire before structure confirmation. Trader effect: closer to real sweep -> base -> shift timing. Expected impact: moderate increase.
- Relax confirmation pivot leg minimum slightly. Refs: 2002-2006, 2056-2089. Technical effect: more pivots become eligible confirmation references. Trader effect: admits more internal repair-and-break sequences without abandoning structure logic. Expected impact: moderate increase.

B) AGGRESSIVE CHANGES
- Allow internal inducement sweeps when `pool.isInducementCandidate` and HTF bias agrees, even with `majorSweeps` otherwise on. Refs: 1315-1317, 2790, 1945-1948. Technical effect: many more detections. Trader effect: catches internal liquidity engineering, but adds noise. Expected impact: large frequency increase.
- Reduce `wickThresh`, `reclaimLvl`, and `sweepMinPenetrationAtr`, or disable `volConfirm`. Refs: 112-119, 2868-2876. Technical effect: more raids pass qualification. Trader effect: more stop-runs and more false positives. Expected impact: large increase, lower quality.
- Move to `Aggressive` confirmation mode. Refs: 1826-1844, 1949-1952, 3230-3231. Technical effect: more minor confirmations, looser structure filters. Trader effect: closer to an aggressive intraday scalp model. Expected impact: large increase, lower win-rate stability.
- Soften or disable HTF / directional liquidity entry blocks. Refs: 568-569, 3572-3579. Technical effect: more entries and more `Ent`. Trader effect: more counter-context trades. Expected impact: moderate to large increase, bigger drawdown/noise risk.

C) CHANGES TO AVOID
- Removing `requireSweepCloseBackInside` as a general default. Refs: 120, 2879. That turns failed breakouts into “sweeps.”
- Removing sweep depth control. Refs: 114, 2872. That turns genuine continuation breaks into fake reversals.
- Treating every MS CHoCH/BOS/IDM label as a validated setup. Refs: 2299-2741, 3272-3300. That would be fake ICT narrative inflation.
- Counting reaction-zone previews or plan boxes as trades. Refs: 3719-3942. Those are render aids, not lifecycle events.

## 10. How To Fix Dashboard / W-R Stats

Technical explanation:
- The code needs one canonical lifecycle object, not more counters.
- Minimal object shape: `id`, `side`, `poolLabel`, `sweepLevel`, `stopAnchor`, `detectedBar`, `validationBar`, `execModel`, `plannedEntry`, `plannedStop`, `plannedTarget`, `entryBar`, `entryPrice`, `exitBar`, `exitReason`, `state`.
- Required states: `DETECTED`, `REJECTION_CONFIRMED`, `VALIDATED`, `EXEC_ARMED`, `ENTRY_READY`, `BLOCKED`, `ENTERED`, `WON`, `LOST`, `BREAKEVEN`, `FAILED_REJECTION`, `EXPIRED`, `CANCELLED_BREAKOUT`, `CANCELLED_OPPOSITE_SWEEP`.
- Counter rules:
    - `Detected`: increment when startWait runs at 3054-3073.
    - `Validated`: increment when structure is promoted to executable; currently 3237-3260, but should also include the approved broader MS confirmation path if you want the dashboard to reflect the chart.
    - `Pending`: count open objects in `VALIDATED` or `EXEC_ARMED`, not raw pre-validation waits.
    - `Entered`: increment when 3613-3615 / 3643-3645 fire.
    - `Resolved`: increment when 3674-3691 resolves to win/loss/BE.
    - `Won/Lost/BE`: increment on the actual exit reason.
    - `Blocked`: increment when an `ENTRY_READY` setup is blocked by HTF/liquidity/conservative MS at 3590-3595.
- `WR` should be computed from the object ledger’s terminal `WON`/`LOST` counts, not from any preview/validation states.

Trader explanation:
- A trader needs the panel to answer: how many real sweep candidates were found, how many became structurally valid, how many were still pending, how many were blocked by context, how many were entered, and how they resolved.
- The current counter design cannot do that because it does not remember terminal failure reasons for non-entered setups.

Exact code locations currently needing rewiring:
- State storage: 1630-1739.
- Detection start: 3054-3073.
- Failure/expiry/cancellation: 3035-3050, 3112-3155.
- Validation: 3237-3260 and 3157-3168.
- Execution arming: 3418-3551.
- Entry / block: 3586-3658.
- Resolution: 3660-3698.
- Dashboard formulas: 4002-4006.

## 11. Programmer Change Priority Order

1. Replace scalar setup bookkeeping with a canonical setup/trade object and history array. Refs: 1630-1739.

2. Wire all setup terminal paths into that object: rejection fail, timeout, breakout cancellation, opposite-sweep replacement, blocked, entered, won/lost/BE. Refs: 3035-3155, 3590-3698.

3. Unify validation semantics. Decide whether `Val` means only `chartStructureConfirm*` or also approved `msPostSweepStructureConfirmed*`. Refs: 3157-3168, 3237-3260.

4. Separate rendering-only structure from execution logic in naming and dashboard text. Refs: 2299-2741, 3272-3300, 3979-4006.

5. Fix misleading controls and dead paths. Rewire or rename `useMajorMSS`; make OB truly reachable or remove it from default-mode claims. Refs: 3302-3303, 3451-3471, 3513-3533.

6. Relax the top 3 trade-frequency bottlenecks safely: dealing-range hard gate, weak-reclaim validation restriction, confirmation swing leg minimum / timeout. Refs: 1907-1916, 2001-2089, 3228-3231, 1846-1849.

7. Repair result accounting edge cases: same-bar exits and exact-touch exits. Refs: 3660-3698.

8. Rewrite the dashboard row semantics so snapshot rows and cumulative rows are clearly separated. Refs: 3979-4017.

## 12. Final Verdict

Technical explanation: The current script is a strong context engine and a weak trade engine. The liquidity map, HTF state, CHoCH/BOS/IDM layer, and dashboard bias narrative are much more mature than the actual setup-validation-entry-result lifecycle. `Det` counts qualified sweep narratives; `Val` counts only a narrow chart swing-break branch; everything else depends on that branch ever firing.

Trader explanation: In live trading terms, this behaves closer to a narrative/SMC map than to a true executable sweep model. The dashboard over-promises execution awareness because the chart shows a lot of structure the trade/stat engine does not accept as a trade. Minimum coherence requires:
- one canonical setup/trade lifecycle object,
- validation rules that match the structure the chart already plots,
- terminal bookkeeping for failed/expired/cancelled setups,
- dashboard rows separated into snapshot context vs cumulative performance.

Minimum safe frequency increase requires:
- reconnecting post-sweep MS confirmation to validation,
- softening the hardest pre-validation filters,
- widening weak-reclaim and timeout behavior,
- allowing selected internal inducement sweeps when HTF context supports them.

As it stands, the indicator is not failing to see structure. It is failing to convert much of that structure into counted, persistent, executable trade state.