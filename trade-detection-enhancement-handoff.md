# Trade Detection Enhancement Handoff Pack

Purpose: this report is meant to be copied into another AI agent. Each section contains:
- the exact source file
- the exact current code block
- a ready-to-paste prompt targeted to that block

General instruction to reuse with every prompt:

```text
Preserve current behavior as closely as possible. Make small, safe changes only. Do not redesign orchestration, do not move persistent state out of the indicator, and do not add new features. The goal is only to modestly increase trade frequency by reducing unnecessary strictness.
```

## 1. Raw MSS Trigger Definition

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`

### Exact code
```pine
// BOS (continuation) vs MSS (reversal)
bool bosBull = ta.crossover(close, lastPHi) and isDispBull
bool bosBear = ta.crossunder(close, lastPLo) and isDispBear
bool mssBull = ta.crossover(close, lastPHi) and isDispBull and not na(prevPLo) and low[1] < prevPLo
bool mssBear = ta.crossunder(close, lastPLo) and isDispBear and not na(prevPHi) and high[1] > prevPHi
```

### Prompt for another AI
```text
You are enhancing the raw MSS trigger definitions in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`.

Use this exact code block as the source of truth:

```pine
// BOS (continuation) vs MSS (reversal)
bool bosBull = ta.crossover(close, lastPHi) and isDispBull
bool bosBear = ta.crossunder(close, lastPLo) and isDispBear
bool mssBull = ta.crossover(close, lastPHi) and isDispBull and not na(prevPLo) and low[1] < prevPLo
bool mssBear = ta.crossunder(close, lastPLo) and isDispBear and not na(prevPHi) and high[1] > prevPHi
```

Task:
- make MSS detection modestly less strict
- preserve the BOS logic
- keep MSS directionality and reversal intent intact
- do not redesign downstream lifecycle logic

Preferred enhancement order:
1. soften the prior-bar sweep requirement first
2. only if needed, soften the displacement requirement second

Do not touch any code outside this specific block unless required for compile correctness.
Return the modified code block and a one-paragraph rationale.
```

## 2. Strategy Signal Wiring In Main

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`

### Exact code
```pine
[ictGateLong, ictGateLongInfo, ictGateLongRole, ictGateLongConfidence, ictHasValidExternalLong] = sg.ict_liquidity_gate(true, lastMssBullBar, lastMssBullDispStrength, activeSweeps, sensitivityMode)

[ictGateShort, ictGateShortInfo, ictGateShortRole, ictGateShortConfidence, ictHasValidExternalShort] = sg.ict_liquidity_gate(false, lastMssBearBar, lastMssBearDispStrength, activeSweeps, sensitivityMode)

[sbGateLong, sbGateLongInfo, sbHasSessionSweepLong] = sg.silver_bullet_liquidity_gate(true, activeSweeps)

[sbGateShort, sbGateShortInfo, sbHasSessionSweepShort] = sg.silver_bullet_liquidity_gate(false, activeSweeps)

bool continuationLiquidityLong = sweptSSL and (bestSweepSrcSSL == SRC_PIVOT_INT or bestSweepExtSSL or bestSweepSrcSSL == SRC_EQH_EQL or bestSweepSrcSSL == SRC_ROUND_NUM or is_htf_liquidity_source(bestSweepSrcSSL))
bool continuationLiquidityShort = sweptBSL and (bestSweepSrcBSL == SRC_PIVOT_INT or bestSweepExtBSL or bestSweepSrcBSL == SRC_EQH_EQL or bestSweepSrcBSL == SRC_ROUND_NUM or is_htf_liquidity_source(bestSweepSrcBSL))

bool sig2022B = mssBull and ictGateLong and enableICT2022
bool sig2022S = mssBear and ictGateShort and enableICT2022
bool inSB = sbLon.isActive or sbAm.isActive
bool sigSBB = inSB and bullFvgAligned and sbGateLong and enableSilverBullet
bool sigSBS = inSB and bearFvgAligned and sbGateShort and enableSilverBullet
```

### Prompt for another AI
```text
You are reviewing the strategy signal wiring in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`.

Use this exact code block:

```pine
[ictGateLong, ictGateLongInfo, ictGateLongRole, ictGateLongConfidence, ictHasValidExternalLong] = sg.ict_liquidity_gate(true, lastMssBullBar, lastMssBullDispStrength, activeSweeps, sensitivityMode)

[ictGateShort, ictGateShortInfo, ictGateShortRole, ictGateShortConfidence, ictHasValidExternalShort] = sg.ict_liquidity_gate(false, lastMssBearBar, lastMssBearDispStrength, activeSweeps, sensitivityMode)

[sbGateLong, sbGateLongInfo, sbHasSessionSweepLong] = sg.silver_bullet_liquidity_gate(true, activeSweeps)

[sbGateShort, sbGateShortInfo, sbHasSessionSweepShort] = sg.silver_bullet_liquidity_gate(false, activeSweeps)

bool continuationLiquidityLong = sweptSSL and (bestSweepSrcSSL == SRC_PIVOT_INT or bestSweepExtSSL or bestSweepSrcSSL == SRC_EQH_EQL or bestSweepSrcSSL == SRC_ROUND_NUM or is_htf_liquidity_source(bestSweepSrcSSL))
bool continuationLiquidityShort = sweptBSL and (bestSweepSrcBSL == SRC_PIVOT_INT or bestSweepExtBSL or bestSweepSrcBSL == SRC_EQH_EQL or bestSweepSrcBSL == SRC_ROUND_NUM or is_htf_liquidity_source(bestSweepSrcBSL))

bool sig2022B = mssBull and ictGateLong and enableICT2022
bool sig2022S = mssBear and ictGateShort and enableICT2022
bool inSB = sbLon.isActive or sbAm.isActive
bool sigSBB = inSB and bullFvgAligned and sbGateLong and enableSilverBullet
bool sigSBS = inSB and bearFvgAligned and sbGateShort and enableSilverBullet
```

Task:
- do not change the overall `ICT OR SB` signal composition unless you find a concrete bug
- use this block mainly as context for how the library gates feed signals
- if you change anything here, keep it minimal and explain exactly why

Preferred outcome:
- leave this block unchanged
- instead tune the libraries that produce `ictGate*` and `sbGate*`

Return either:
- "no change recommended here" with rationale
- or a minimal patch if you find a true bug
```

## 3. Signal Promotion After Signal Detection

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`

### Exact code
```pine
// --- Signal Lifecycle Promotion (Chapter 1+2+5: Mode-Aware + Displacement-Truth) ---
// Signal promotion is now gated by sensitivity mode policy AND formal displacement truth.
// Aggressive: may promote from MSS_CONFIRMED+ to ENTRY_TRIGGERED if reclaim+displacement pass
// Balanced: signal may at most confirm displacement; cannot promote to ENTRY_TRIGGERED directly
// Conservative: signal cannot bypass entry-armed requirements
if isSignalB and liveSetup.lifecycleLong >= LC_MSS_CONFIRMED and liveSetup.lifecycleLong < LC_ENTRY_TRIGGERED
    // Chapter 5: AGG now requires formal displacement pass instead of raw mssDisp threshold
    bool canPromoteAggL = sensitivityMode == "Aggressive" and reclaimProxyLong and sweptSSL and not na(lastMssBullBar) and dispPassL and not dispFailedL2 and not expiredL and not degradedL
    if canPromoteAggL
        liveSetup.lifecycleLong := LC_ENTRY_TRIGGERED
        liveSetup.lifecycleNameLong := lm.lifecycle_name(LC_ENTRY_TRIGGERED)
        liveSetup.lifecycleCanActivateLong := true
        modeActL := true
        modeBlockL := ""
        liveSetup.longMeetsModeActivation := true
        liveSetup.longModeBlockReason := ""
    // Chapter 5: Balanced/Conservative promote to DISPLACEMENT_CONFIRMED only with formal displacement validity
    else if sensitivityMode != "Aggressive" and modeCandL and liveSetup.lifecycleLong < LC_DISPLACEMENT_CONFIRMED and dispValidL2 and not dispFailedL2
        liveSetup.lifecycleLong := LC_DISPLACEMENT_CONFIRMED
        liveSetup.lifecycleNameLong := lm.lifecycle_name(LC_DISPLACEMENT_CONFIRMED)

if isSignalS and liveSetup.lifecycleShort >= LC_MSS_CONFIRMED and liveSetup.lifecycleShort < LC_ENTRY_TRIGGERED
    bool canPromoteAggS = sensitivityMode == "Aggressive" and reclaimProxyShort and sweptBSL and not na(lastMssBearBar) and dispPassS and not dispFailedS2 and not expiredS and not degradedS
    if canPromoteAggS
        liveSetup.lifecycleShort := LC_ENTRY_TRIGGERED
        liveSetup.lifecycleNameShort := lm.lifecycle_name(LC_ENTRY_TRIGGERED)
        liveSetup.lifecycleCanActivateShort := true
        modeActS := true
        modeBlockS := ""
        liveSetup.shortMeetsModeActivation := true
        liveSetup.shortModeBlockReason := ""
    else if sensitivityMode != "Aggressive" and modeCandS and liveSetup.lifecycleShort < LC_DISPLACEMENT_CONFIRMED and dispValidS2 and not dispFailedS2
        liveSetup.lifecycleShort := LC_DISPLACEMENT_CONFIRMED
        liveSetup.lifecycleNameShort := lm.lifecycle_name(LC_DISPLACEMENT_CONFIRMED)
```

### Prompt for another AI
```text
You are enhancing signal-promotion strictness in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`.

Use this exact code block:

```pine
// --- Signal Lifecycle Promotion (Chapter 1+2+5: Mode-Aware + Displacement-Truth) ---
// Signal promotion is now gated by sensitivity mode policy AND formal displacement truth.
// Aggressive: may promote from MSS_CONFIRMED+ to ENTRY_TRIGGERED if reclaim+displacement pass
// Balanced: signal may at most confirm displacement; cannot promote to ENTRY_TRIGGERED directly
// Conservative: signal cannot bypass entry-armed requirements
if isSignalB and liveSetup.lifecycleLong >= LC_MSS_CONFIRMED and liveSetup.lifecycleLong < LC_ENTRY_TRIGGERED
    // Chapter 5: AGG now requires formal displacement pass instead of raw mssDisp threshold
    bool canPromoteAggL = sensitivityMode == "Aggressive" and reclaimProxyLong and sweptSSL and not na(lastMssBullBar) and dispPassL and not dispFailedL2 and not expiredL and not degradedL
    if canPromoteAggL
        liveSetup.lifecycleLong := LC_ENTRY_TRIGGERED
        liveSetup.lifecycleNameLong := lm.lifecycle_name(LC_ENTRY_TRIGGERED)
        liveSetup.lifecycleCanActivateLong := true
        modeActL := true
        modeBlockL := ""
        liveSetup.longMeetsModeActivation := true
        liveSetup.longModeBlockReason := ""
    // Chapter 5: Balanced/Conservative promote to DISPLACEMENT_CONFIRMED only with formal displacement validity
    else if sensitivityMode != "Aggressive" and modeCandL and liveSetup.lifecycleLong < LC_DISPLACEMENT_CONFIRMED and dispValidL2 and not dispFailedL2
        liveSetup.lifecycleLong := LC_DISPLACEMENT_CONFIRMED
        liveSetup.lifecycleNameLong := lm.lifecycle_name(LC_DISPLACEMENT_CONFIRMED)

if isSignalS and liveSetup.lifecycleShort >= LC_MSS_CONFIRMED and liveSetup.lifecycleShort < LC_ENTRY_TRIGGERED
    bool canPromoteAggS = sensitivityMode == "Aggressive" and reclaimProxyShort and sweptBSL and not na(lastMssBearBar) and dispPassS and not dispFailedS2 and not expiredS and not degradedS
    if canPromoteAggS
        liveSetup.lifecycleShort := LC_ENTRY_TRIGGERED
        liveSetup.lifecycleNameShort := lm.lifecycle_name(LC_ENTRY_TRIGGERED)
        liveSetup.lifecycleCanActivateShort := true
        modeActS := true
        modeBlockS := ""
        liveSetup.shortMeetsModeActivation := true
        liveSetup.shortModeBlockReason := ""
    else if sensitivityMode != "Aggressive" and modeCandS and liveSetup.lifecycleShort < LC_DISPLACEMENT_CONFIRMED and dispValidS2 and not dispFailedS2
        liveSetup.lifecycleShort := LC_DISPLACEMENT_CONFIRMED
        liveSetup.lifecycleNameShort := lm.lifecycle_name(LC_DISPLACEMENT_CONFIRMED)
```

Task:
- keep the mode architecture intact
- if trade frequency is still too low after tuning libraries, make this block slightly less strict
- prefer loosening Balanced promotion before changing Conservative
- do not let non-Aggressive modes jump straight to `LC_ENTRY_TRIGGERED` unless absolutely necessary

Preferred enhancement ideas:
- allow Balanced progression with slightly weaker displacement evidence
- reduce dependence on every single negative flag in the promotion condition

Return the modified block and explain the behavioral impact in 3-5 sentences.
```

## 4. Entry Authority Invocation Context

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`

### Exact code
```pine
[eaLong, epLong, ebLong, eaReasonL, eaStructValidL] = ea.evaluate_entry_authority(
     liveSetup.lifecycleLong, seqOkL, sweptSSL,
     mssValidL2, mssFailedL2, mssFreshL2,
     rclFailedL2, rclPassL,
     dispValidL2, dispFailedL2, dispFreshL2,
     expiredL, degradedL,
     sensitivityMode, modeCandL, modeActL, modeBlockL,
     lm.mode_allows_direct_signal_activation(sensitivityMode),
     gateLongBlocked, gateLongReason,
     extBlockL, pendFreshL,
     isSignalB, isConflicted,
     _pendingLongActive, pendingActivatedLong, pendingExpiredL,
     not na(activeTrade))

// Short side entry authority
[eaShort, epShort, ebShort, eaReasonS, eaStructValidS] = ea.evaluate_entry_authority(
     liveSetup.lifecycleShort, seqOkS, sweptBSL,
     mssValidS2, mssFailedS2, mssFreshS2,
     rclFailedS2, rclPassS,
     dispValidS2, dispFailedS2, dispFreshS2,
     expiredS, degradedS,
     sensitivityMode, modeCandS, modeActS, modeBlockS,
     lm.mode_allows_direct_signal_activation(sensitivityMode),
     gateShortBlocked, gateShortReason,
     extBlockS, pendFreshS,
     isSignalS, isConflicted,
     _pendingShortActive, pendingActivatedShort, pendingExpiredS,
     not na(activeTrade))
```

### Prompt for another AI
```text
You are reviewing the entry-authority call site in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`.

Use this exact code block:

```pine
[eaLong, epLong, ebLong, eaReasonL, eaStructValidL] = ea.evaluate_entry_authority(
     liveSetup.lifecycleLong, seqOkL, sweptSSL,
     mssValidL2, mssFailedL2, mssFreshL2,
     rclFailedL2, rclPassL,
     dispValidL2, dispFailedL2, dispFreshL2,
     expiredL, degradedL,
     sensitivityMode, modeCandL, modeActL, modeBlockL,
     lm.mode_allows_direct_signal_activation(sensitivityMode),
     gateLongBlocked, gateLongReason,
     extBlockL, pendFreshL,
     isSignalB, isConflicted,
     _pendingLongActive, pendingActivatedLong, pendingExpiredL,
     not na(activeTrade))

// Short side entry authority
[eaShort, epShort, ebShort, eaReasonS, eaStructValidS] = ea.evaluate_entry_authority(
     liveSetup.lifecycleShort, seqOkS, sweptBSL,
     mssValidS2, mssFailedS2, mssFreshS2,
     rclFailedS2, rclPassS,
     dispValidS2, dispFailedS2, dispFreshS2,
     expiredS, degradedS,
     sensitivityMode, modeCandS, modeActS, modeBlockS,
     lm.mode_allows_direct_signal_activation(sensitivityMode),
     gateShortBlocked, gateShortReason,
     extBlockS, pendFreshS,
     isSignalS, isConflicted,
     _pendingShortActive, pendingActivatedShort, pendingExpiredS,
     not na(activeTrade))
```

Task:
- treat this block as context, not the primary place to loosen thresholds
- only change this call site if the authority library signature or argument wiring is wrong
- otherwise keep this unchanged and tune the libraries that feed its inputs

Return either:
- "no change recommended here" with rationale
- or a minimal patch if you detect a wiring problem
```

## 5. ICT Liquidity Gate

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_signal_gate_engine.pine`

### Exact code
```pine
export ict_liquidity_gate(bool isLong, int mssBar, float mssDisp, T.LiqSweep[] sweeps, string sensMode) =>
    bool ok = false
    bool hasValidExternal = false
    string detail = "No qualifying liquidity sweep"
    int acceptedRole = ROLE_NONE
    float bestTraderScore = -1.0
    float confidence = 0.0

    int rejectionReason = REJECT_NONE
    bool sawAny = false

    if array.size(sweeps) > 0
        for i = 0 to array.size(sweeps) - 1
            T.LiqSweep s = array.get(sweeps, i)
            if s.isSSL != isLong
                continue

            sawAny := true

            // 1. Strict Freshness Logic
            // A professional trader requires the raid to be fresh relative to the MSS.
            int age = not na(mssBar) ? (mssBar - s.sweepBar) : (bar_index - s.sweepBar)
            bool isLiveFresh = s.isActionable and age <= 25 // Tightened from broad sequence tolerance
            bool isConsumedPrecursor = s.isConsumed and age <= 15

            if not isLiveFresh and not isConsumedPrecursor
                rejectionReason := s.isConsumed ? REJECT_CONSUMED : REJECT_STALE
                continue

            // 2. Sequence Hard Gating
            if age > 50 or age < 0
                rejectionReason := REJECT_SEQUENCE
                continue

            // 3. Role Evaluation
            int role = get_sweep_role(s)
            float traderScore = calculate_trader_score(s, role, mssBar, mssDisp)

            // 4. Hardened Inducement & Role Logic
            bool isAggressive = sensMode == "Aggressive"
            bool structurallyStrong = role == ROLE_HTF_RAID or role == ROLE_SESSION_RAID or role == ROLE_EXTERNAL_TARGET

            // Inducement must be exceptionally fresh, high quality, and high displacement to pass alone.
            bool inducementValid = role == ROLE_INDUCEMENT and mssDisp >= 1.75 and s.qualityScore >= 65.0 and age <= 15
            bool internalException = isAggressive and s.sourceType == SRC_PIVOT_INT and s.qualityScore >= 78.0

            if not structurallyStrong and not inducementValid and not internalException
                rejectionReason := role == ROLE_INDUCEMENT ? REJECT_INDUCEMENT_LOW : REJECT_INTERNAL_ONLY
                continue

            // 5. Candidate Selection
            if traderScore > bestTraderScore
                ok := true
                bestTraderScore := traderScore
                acceptedRole := role
                confidence := math.min(100.0, traderScore)
                hasValidExternal := structurallyStrong

                string roleTag = role == ROLE_INDUCEMENT ? "Inducement Only" : role_label(role)
                detail := s.levelName + " (" + roleTag + ")"

    if not ok and detail == "No qualifying liquidity sweep"
        detail := not sawAny ? "No liquidity detected" :
                  rejectionReason == REJECT_CONSUMED ? "Precursor already spent/consumed" :
                  rejectionReason == REJECT_STALE ? "Liquidity raid too old/stale" :
                  rejectionReason == REJECT_SEQUENCE ? "Sweep out of sequence" :
                  rejectionReason == REJECT_INDUCEMENT_LOW ? "Inducement lacks quality/displacement" :
                  rejectionReason == REJECT_INTERNAL_ONLY ? "Need high-impact structural raid" : detail

    [ok, detail, acceptedRole, confidence, hasValidExternal]
```

### Prompt for another AI
```text
You are enhancing the ICT liquidity gate in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_signal_gate_engine.pine`.

Use this exact code block:

```pine
export ict_liquidity_gate(bool isLong, int mssBar, float mssDisp, T.LiqSweep[] sweeps, string sensMode) =>
    bool ok = false
    bool hasValidExternal = false
    string detail = "No qualifying liquidity sweep"
    int acceptedRole = ROLE_NONE
    float bestTraderScore = -1.0
    float confidence = 0.0

    int rejectionReason = REJECT_NONE
    bool sawAny = false

    if array.size(sweeps) > 0
        for i = 0 to array.size(sweeps) - 1
            T.LiqSweep s = array.get(sweeps, i)
            if s.isSSL != isLong
                continue

            sawAny := true

            // 1. Strict Freshness Logic
            // A professional trader requires the raid to be fresh relative to the MSS.
            int age = not na(mssBar) ? (mssBar - s.sweepBar) : (bar_index - s.sweepBar)
            bool isLiveFresh = s.isActionable and age <= 25 // Tightened from broad sequence tolerance
            bool isConsumedPrecursor = s.isConsumed and age <= 15

            if not isLiveFresh and not isConsumedPrecursor
                rejectionReason := s.isConsumed ? REJECT_CONSUMED : REJECT_STALE
                continue

            // 2. Sequence Hard Gating
            if age > 50 or age < 0
                rejectionReason := REJECT_SEQUENCE
                continue

            // 3. Role Evaluation
            int role = get_sweep_role(s)
            float traderScore = calculate_trader_score(s, role, mssBar, mssDisp)

            // 4. Hardened Inducement & Role Logic
            bool isAggressive = sensMode == "Aggressive"
            bool structurallyStrong = role == ROLE_HTF_RAID or role == ROLE_SESSION_RAID or role == ROLE_EXTERNAL_TARGET

            // Inducement must be exceptionally fresh, high quality, and high displacement to pass alone.
            bool inducementValid = role == ROLE_INDUCEMENT and mssDisp >= 1.75 and s.qualityScore >= 65.0 and age <= 15
            bool internalException = isAggressive and s.sourceType == SRC_PIVOT_INT and s.qualityScore >= 78.0

            if not structurallyStrong and not inducementValid and not internalException
                rejectionReason := role == ROLE_INDUCEMENT ? REJECT_INDUCEMENT_LOW : REJECT_INTERNAL_ONLY
                continue

            // 5. Candidate Selection
            if traderScore > bestTraderScore
                ok := true
                bestTraderScore := traderScore
                acceptedRole := role
                confidence := math.min(100.0, traderScore)
                hasValidExternal := structurallyStrong

                string roleTag = role == ROLE_INDUCEMENT ? "Inducement Only" : role_label(role)
                detail := s.levelName + " (" + roleTag + ")"

    if not ok and detail == "No qualifying liquidity sweep"
        detail := not sawAny ? "No liquidity detected" :
                  rejectionReason == REJECT_CONSUMED ? "Precursor already spent/consumed" :
                  rejectionReason == REJECT_STALE ? "Liquidity raid too old/stale" :
                  rejectionReason == REJECT_SEQUENCE ? "Sweep out of sequence" :
                  rejectionReason == REJECT_INDUCEMENT_LOW ? "Inducement lacks quality/displacement" :
                  rejectionReason == REJECT_INTERNAL_ONLY ? "Need high-impact structural raid" : detail

    [ok, detail, acceptedRole, confidence, hasValidExternal]
```

Task:
- modestly increase pass rate for valid ICT setups
- keep role hierarchy intact
- preserve the idea that structural raids are preferred over weak internal noise

Preferred enhancement order:
1. widen freshness windows slightly
2. soften inducement requirements slightly
3. soften the aggressive internal exception threshold slightly

Avoid:
- removing role filtering entirely
- allowing stale or out-of-sequence sweeps through broadly

Return the modified block and briefly list the exact threshold changes.
```

## 6. Silver Bullet Liquidity Gate

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_signal_gate_engine.pine`

### Exact code
```pine
export silver_bullet_liquidity_gate(bool isLong, T.LiqSweep[] sweeps) =>
    bool ok = false
    bool isSessionFresh = false
    string detail = "No SB narrative liquidity"
    float bestScore = -1.0

    // SB is high-intensity; we tighten the lookback to keep it session-specific.
    int sbStrictLookback = math.max(1, int(math.round(1200.0 / timeframe.in_seconds(timeframe.period))))

    if array.size(sweeps) > 0
        for i = 0 to array.size(sweeps) - 1
            T.LiqSweep s = array.get(sweeps, i)
            int age = bar_index - s.sweepBar

            if s.isSSL != isLong or (not s.isActionable and not s.inSilverBullet) or age > sbStrictLookback
                continue

            int role = get_sweep_role(s)

            // SB Narrative Priorities:
            // 1. True Session/HTF Raids (Primary)
            // 2. High-Quality, Extremely Fresh External Targets (Secondary)
            bool isSessionNarrative = role == ROLE_SESSION_RAID or role == ROLE_HTF_RAID
            bool isPremiumExternal = role == ROLE_EXTERNAL_TARGET and s.qualityScore >= 70.0 and age <= 10

            if isSessionNarrative or isPremiumExternal
                float score = s.qualityScore + (isSessionNarrative ? 35.0 : 0.0)
                if score > bestScore
                    ok := true
                    bestScore := score
                    isSessionFresh := isSessionNarrative
                    detail := s.levelName + (isSessionNarrative ? " (Session Narrative)" : " (Premium Structural)")
            else if not ok
                detail := "Structural sweep not session-grade enough"

    [ok, detail, isSessionFresh]
```

### Prompt for another AI
```text
You are enhancing the Silver Bullet liquidity gate in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_signal_gate_engine.pine`.

Use this exact code block:

```pine
export silver_bullet_liquidity_gate(bool isLong, T.LiqSweep[] sweeps) =>
    bool ok = false
    bool isSessionFresh = false
    string detail = "No SB narrative liquidity"
    float bestScore = -1.0

    // SB is high-intensity; we tighten the lookback to keep it session-specific.
    int sbStrictLookback = math.max(1, int(math.round(1200.0 / timeframe.in_seconds(timeframe.period))))

    if array.size(sweeps) > 0
        for i = 0 to array.size(sweeps) - 1
            T.LiqSweep s = array.get(sweeps, i)
            int age = bar_index - s.sweepBar

            if s.isSSL != isLong or (not s.isActionable and not s.inSilverBullet) or age > sbStrictLookback
                continue

            int role = get_sweep_role(s)

            // SB Narrative Priorities:
            // 1. True Session/HTF Raids (Primary)
            // 2. High-Quality, Extremely Fresh External Targets (Secondary)
            bool isSessionNarrative = role == ROLE_SESSION_RAID or role == ROLE_HTF_RAID
            bool isPremiumExternal = role == ROLE_EXTERNAL_TARGET and s.qualityScore >= 70.0 and age <= 10

            if isSessionNarrative or isPremiumExternal
                float score = s.qualityScore + (isSessionNarrative ? 35.0 : 0.0)
                if score > bestScore
                    ok := true
                    bestScore := score
                    isSessionFresh := isSessionNarrative
                    detail := s.levelName + (isSessionNarrative ? " (Session Narrative)" : " (Premium Structural)")
            else if not ok
                detail := "Structural sweep not session-grade enough"

    [ok, detail, isSessionFresh]
```

Task:
- keep Silver Bullet session-focused
- modestly increase acceptance rate for legitimate SB setups
- prefer relaxing premium-external requirements before changing session logic

Preferred enhancements:
- slightly lower `qualityScore >= 70.0`
- slightly widen `age <= 10`
- only widen lookback if necessary after the above

Return the modified block and list the exact thresholds you changed.
```

## 7. Pending Freshness And Mode Qualification

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_pending_trade_state.pine`

### Exact code
```pine
export pending_is_structurally_fresh(int signalBar, int mssBar_, int fvgBar_, bool degraded, bool isExtended, string mode, bool mssFailed_, bool dispFailed_) =>
    bool fresh = true
    bool stale = false
    string reason = "Structurally fresh"
    int age = bar_index - signalBar
    int maxFresh = mode == "Aggressive" ? 5 : mode == "Conservative" ? 4 : 5
    if age > maxFresh
        fresh := false
        stale := true
        reason := "Age " + str.tostring(age) + " > " + str.tostring(maxFresh) + " bars"
    if fresh and not na(mssBar_)
        int mssAge = bar_index - mssBar_
        int mssMaxFresh = mode == "Conservative" ? 15 : mode == "Balanced" ? 25 : 35
        if mssAge > mssMaxFresh
            fresh := false
            stale := true
            reason := "MSS aged (" + str.tostring(mssAge) + " bars)"
    if fresh and not na(fvgBar_)
        int fvgAge = bar_index - fvgBar_
        int fvgMaxFresh = mode == "Conservative" ? 12 : mode == "Balanced" ? 20 : 30
        if fvgAge > fvgMaxFresh
            fresh := false
            stale := true
            reason := "FVG aged (" + str.tostring(fvgAge) + " bars)"
    if fresh and degraded
        fresh := false
        stale := true
        reason := "Setup degraded"
    if fresh and isExtended
        fresh := false
        stale := true
        reason := "Price too extended"
    if fresh and mssFailed_
        fresh := false
        stale := true
        reason := "MSS failed — structure invalidated"
    if fresh and dispFailed_
        fresh := false
        stale := true
        reason := "Displacement failed — setup invalidated"
    [fresh, stale, reason]

// Central mode qualification function (Chapter 2.2 + Chapter 4 + Chapter 5).
export evaluate_mode_execution(string mode, int lifecycle, bool swept, float sweepQ, bool hasMss, float mssDisp_, bool hasFvg, int fvgGrade_, bool seqOk, bool expired, bool degraded, bool reclaimPass, float reclaimStr, bool reclaimStrong, bool isExtended, bool mssQualPass, bool mssQualStrong, bool bridgePass, bool bridgeStrong, int score, int mssTrigSig, bool dispPass_, bool dispStrong_, bool dispFailed_, float dispScore_) =>
    int minCandidate = lm.mode_min_lifecycle_for_candidate(mode)
    bool meetsCandidate = lifecycle >= minCandidate and not expired and not degraded
    bool meetsActivation = false
    bool allowDirect = lm.mode_allows_direct_signal_activation(mode)
    string blockReason = ""
    string actPath = ""

    if lifecycle <= LC_SWEEP_CONFIRMED
        meetsCandidate := false
        blockReason := swept and sweepQ > 0 ? "Sweep-only (Q=" + str.tostring(math.round(sweepQ)) + ") — need structure shift" : "Sweep-only — need structure shift"

    if meetsCandidate and isExtended and mode != "Aggressive"
        meetsCandidate := false
        blockReason := lm.mode_name_short(mode) + " blocked — entry too extended"

    if not meetsCandidate
        if blockReason == ""
            blockReason := lm.mode_name_short(mode) + " needs " + lm.lifecycle_name(minCandidate)
    else
        if mode == "Aggressive"
            bool standardOk = lifecycle >= LC_ENTRY_TRIGGERED and hasMss and reclaimPass
            bool promoOk = lifecycle >= LC_DISPLACEMENT_CONFIRMED and reclaimPass and dispPass_ and not dispFailed_
            if standardOk
                meetsActivation := true
                actPath := "AGG standard (score=" + str.tostring(score) + ", mssDisp=" + str.tostring(math.round(mssDisp_ * 100) / 100) + ")"
            else if promoOk
                meetsActivation := true
                actPath := "AGG promo (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else
                blockReason := "AGG: " + (not hasMss ? "no MSS" : not reclaimPass ? "reclaim " + str.tostring(math.round(reclaimStr)) + " insufficient" : dispFailed_ ? "displacement failed" : not dispPass_ ? "displacement insufficient (score=" + str.tostring(math.round(dispScore_)) + ")" : "lifecycle insufficient")

        else if mode == "Balanced"
            bool idealOk = lifecycle >= LC_ENTRY_ARMED and reclaimPass and mssQualPass and not isExtended and dispPass_ and not dispFailed_
            bool bridgeOk = lifecycle >= LC_DISPLACEMENT_CONFIRMED and lifecycle < LC_ENTRY_ARMED and reclaimStr >= 40.0 and mssQualPass and bridgePass and not isExtended and dispPass_ and not dispFailed_
            if idealOk
                meetsActivation := true
                actPath := "BAL ideal (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else if bridgeOk
                meetsActivation := true
                actPath := "BAL bridge (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else
                blockReason := not reclaimPass ? "BAL: reclaim insufficient (" + str.tostring(math.round(reclaimStr)) + ")" : not mssQualPass ? "BAL: MSS quality insufficient" : dispFailed_ ? "BAL: displacement failed" : not dispPass_ ? "BAL: displacement quality insufficient (score=" + str.tostring(math.round(dispScore_)) + ")" : isExtended ? "BAL: entry too extended" : lifecycle < LC_ENTRY_ARMED and not bridgeOk ? "BAL: bridge conditions not met" : "BAL: activation not met"

        else // Conservative
            bool idealOk = lifecycle >= LC_ENTRY_ARMED and reclaimPass and reclaimStr >= 50.0 and mssQualStrong and not isExtended and seqOk and mssTrigSig >= 2 and dispStrong_ and not dispFailed_
            bool bridgeOk = lifecycle >= LC_DISPLACEMENT_CONFIRMED and lifecycle < LC_ENTRY_ARMED and reclaimStrong and mssQualStrong and bridgeStrong and not isExtended and (seqOk or (hasFvg and fvgGrade_ >= 2)) and mssTrigSig >= 2 and dispStrong_ and not dispFailed_
            bool fallbackOk = not idealOk and not bridgeOk and lifecycle >= LC_ENTRY_ARMED and reclaimStrong and mssQualStrong and not isExtended and seqOk and mssTrigSig >= 2 and dispPass_ and dispScore_ >= 50.0 and not dispFailed_
            if idealOk
                meetsActivation := true
                actPath := "CON ideal (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else if bridgeOk
                meetsActivation := true
                actPath := "CON bridge (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else if fallbackOk
                meetsActivation := true
                actPath := "CON fallback (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else
                blockReason := not reclaimStrong and reclaimStr < 50.0 ? "CON: reclaim not strong (" + str.tostring(math.round(reclaimStr)) + ")" : not mssQualStrong ? "CON: MSS quality not strong" : mssTrigSig < 2 ? "CON: protected structure not broken (sig=" + str.tostring(mssTrigSig) + ")" : dispFailed_ ? "CON: displacement failed" : not dispStrong_ and dispScore_ < 50.0 ? "CON: displacement not strong (score=" + str.tostring(math.round(dispScore_)) + ")" : isExtended ? "CON: entry too extended" : not seqOk and lifecycle >= LC_ENTRY_ARMED ? "CON: requires complete sequence" : "CON: strong bridge not met"

    if mode != "Aggressive"
        allowDirect := false

    [meetsCandidate, meetsActivation, blockReason, allowDirect, actPath]
```

### Prompt for another AI
```text
You are enhancing pending freshness and mode qualification in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_pending_trade_state.pine`.

Use this exact code block:

```pine
export pending_is_structurally_fresh(int signalBar, int mssBar_, int fvgBar_, bool degraded, bool isExtended, string mode, bool mssFailed_, bool dispFailed_) =>
    bool fresh = true
    bool stale = false
    string reason = "Structurally fresh"
    int age = bar_index - signalBar
    int maxFresh = mode == "Aggressive" ? 5 : mode == "Conservative" ? 4 : 5
    if age > maxFresh
        fresh := false
        stale := true
        reason := "Age " + str.tostring(age) + " > " + str.tostring(maxFresh) + " bars"
    if fresh and not na(mssBar_)
        int mssAge = bar_index - mssBar_
        int mssMaxFresh = mode == "Conservative" ? 15 : mode == "Balanced" ? 25 : 35
        if mssAge > mssMaxFresh
            fresh := false
            stale := true
            reason := "MSS aged (" + str.tostring(mssAge) + " bars)"
    if fresh and not na(fvgBar_)
        int fvgAge = bar_index - fvgBar_
        int fvgMaxFresh = mode == "Conservative" ? 12 : mode == "Balanced" ? 20 : 30
        if fvgAge > fvgMaxFresh
            fresh := false
            stale := true
            reason := "FVG aged (" + str.tostring(fvgAge) + " bars)"
    if fresh and degraded
        fresh := false
        stale := true
        reason := "Setup degraded"
    if fresh and isExtended
        fresh := false
        stale := true
        reason := "Price too extended"
    if fresh and mssFailed_
        fresh := false
        stale := true
        reason := "MSS failed — structure invalidated"
    if fresh and dispFailed_
        fresh := false
        stale := true
        reason := "Displacement failed — setup invalidated"
    [fresh, stale, reason]

// Central mode qualification function (Chapter 2.2 + Chapter 4 + Chapter 5).
export evaluate_mode_execution(string mode, int lifecycle, bool swept, float sweepQ, bool hasMss, float mssDisp_, bool hasFvg, int fvgGrade_, bool seqOk, bool expired, bool degraded, bool reclaimPass, float reclaimStr, bool reclaimStrong, bool isExtended, bool mssQualPass, bool mssQualStrong, bool bridgePass, bool bridgeStrong, int score, int mssTrigSig, bool dispPass_, bool dispStrong_, bool dispFailed_, float dispScore_) =>
    int minCandidate = lm.mode_min_lifecycle_for_candidate(mode)
    bool meetsCandidate = lifecycle >= minCandidate and not expired and not degraded
    bool meetsActivation = false
    bool allowDirect = lm.mode_allows_direct_signal_activation(mode)
    string blockReason = ""
    string actPath = ""

    if lifecycle <= LC_SWEEP_CONFIRMED
        meetsCandidate := false
        blockReason := swept and sweepQ > 0 ? "Sweep-only (Q=" + str.tostring(math.round(sweepQ)) + ") — need structure shift" : "Sweep-only — need structure shift"

    if meetsCandidate and isExtended and mode != "Aggressive"
        meetsCandidate := false
        blockReason := lm.mode_name_short(mode) + " blocked — entry too extended"

    if not meetsCandidate
        if blockReason == ""
            blockReason := lm.mode_name_short(mode) + " needs " + lm.lifecycle_name(minCandidate)
    else
        if mode == "Aggressive"
            bool standardOk = lifecycle >= LC_ENTRY_TRIGGERED and hasMss and reclaimPass
            bool promoOk = lifecycle >= LC_DISPLACEMENT_CONFIRMED and reclaimPass and dispPass_ and not dispFailed_
            if standardOk
                meetsActivation := true
                actPath := "AGG standard (score=" + str.tostring(score) + ", mssDisp=" + str.tostring(math.round(mssDisp_ * 100) / 100) + ")"
            else if promoOk
                meetsActivation := true
                actPath := "AGG promo (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else
                blockReason := "AGG: " + (not hasMss ? "no MSS" : not reclaimPass ? "reclaim " + str.tostring(math.round(reclaimStr)) + " insufficient" : dispFailed_ ? "displacement failed" : not dispPass_ ? "displacement insufficient (score=" + str.tostring(math.round(dispScore_)) + ")" : "lifecycle insufficient")

        else if mode == "Balanced"
            bool idealOk = lifecycle >= LC_ENTRY_ARMED and reclaimPass and mssQualPass and not isExtended and dispPass_ and not dispFailed_
            bool bridgeOk = lifecycle >= LC_DISPLACEMENT_CONFIRMED and lifecycle < LC_ENTRY_ARMED and reclaimStr >= 40.0 and mssQualPass and bridgePass and not isExtended and dispPass_ and not dispFailed_
            if idealOk
                meetsActivation := true
                actPath := "BAL ideal (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else if bridgeOk
                meetsActivation := true
                actPath := "BAL bridge (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else
                blockReason := not reclaimPass ? "BAL: reclaim insufficient (" + str.tostring(math.round(reclaimStr)) + ")" : not mssQualPass ? "BAL: MSS quality insufficient" : dispFailed_ ? "BAL: displacement failed" : not dispPass_ ? "BAL: displacement quality insufficient (score=" + str.tostring(math.round(dispScore_)) + ")" : isExtended ? "BAL: entry too extended" : lifecycle < LC_ENTRY_ARMED and not bridgeOk ? "BAL: bridge conditions not met" : "BAL: activation not met"

        else // Conservative
            bool idealOk = lifecycle >= LC_ENTRY_ARMED and reclaimPass and reclaimStr >= 50.0 and mssQualStrong and not isExtended and seqOk and mssTrigSig >= 2 and dispStrong_ and not dispFailed_
            bool bridgeOk = lifecycle >= LC_DISPLACEMENT_CONFIRMED and lifecycle < LC_ENTRY_ARMED and reclaimStrong and mssQualStrong and bridgeStrong and not isExtended and (seqOk or (hasFvg and fvgGrade_ >= 2)) and mssTrigSig >= 2 and dispStrong_ and not dispFailed_
            bool fallbackOk = not idealOk and not bridgeOk and lifecycle >= LC_ENTRY_ARMED and reclaimStrong and mssQualStrong and not isExtended and seqOk and mssTrigSig >= 2 and dispPass_ and dispScore_ >= 50.0 and not dispFailed_
            if idealOk
                meetsActivation := true
                actPath := "CON ideal (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else if bridgeOk
                meetsActivation := true
                actPath := "CON bridge (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else if fallbackOk
                meetsActivation := true
                actPath := "CON fallback (disp=" + str.tostring(math.round(dispScore_)) + ")"
            else
                blockReason := not reclaimStrong and reclaimStr < 50.0 ? "CON: reclaim not strong (" + str.tostring(math.round(reclaimStr)) + ")" : not mssQualStrong ? "CON: MSS quality not strong" : mssTrigSig < 2 ? "CON: protected structure not broken (sig=" + str.tostring(mssTrigSig) + ")" : dispFailed_ ? "CON: displacement failed" : not dispStrong_ and dispScore_ < 50.0 ? "CON: displacement not strong (score=" + str.tostring(math.round(dispScore_)) + ")" : isExtended ? "CON: entry too extended" : not seqOk and lifecycle >= LC_ENTRY_ARMED ? "CON: requires complete sequence" : "CON: strong bridge not met"

    if mode != "Aggressive"
        allowDirect := false

    [meetsCandidate, meetsActivation, blockReason, allowDirect, actPath]
```

Task:
- prioritize improving `Balanced` mode first
- widen freshness windows modestly
- soften `Balanced` bridge and activation requirements slightly
- leave `Conservative` mostly intact unless absolutely necessary
- keep the mode system recognizable

Suggested enhancement order:
1. widen `maxFresh`, `mssMaxFresh`, and `fvgMaxFresh`
2. soften `Balanced` bridge reclaim threshold
3. soften `Balanced` displacement requirement slightly
4. only then consider loosening `Conservative`

Return the modified block and summarize each threshold change.
```

## 8. Pending Activation Conversion

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_pending_trade_state.pine`

### Exact code
```pine
export evaluate_pending_activation(bool isLong, int currentLifecycle, bool reclaimPass, float reclaimStr, bool reclaimStrong, float dispStrength, bool seqOk, bool expired, bool degraded, string mode, int signalBar, int expiryBar, bool isExtended, bool mssQualPass, bool mssQualStrong, bool bridgePass_, bool bridgeStrong_, bool pendingFresh, bool reclaimFailed_, bool mssFailed_, bool mssFresh_, bool dispPass_, bool dispFresh_, bool dispFailed_) =>
    bool canActivate = false
    string reason = ""
    bool shouldInvalidate = false

    if reclaimFailed_
        shouldInvalidate := true
        reason := "Pending invalidated — reclaim failed (str=" + str.tostring(math.round(reclaimStr)) + ")"
    else if mssFailed_
        shouldInvalidate := true
        reason := "Pending invalidated — MSS failed"
    else if not mssFresh_
        shouldInvalidate := true
        reason := "Pending invalidated — MSS stale"
    else if dispFailed_
        shouldInvalidate := true
        reason := "Pending invalidated — displacement failed"
    else if not dispFresh_
        shouldInvalidate := true
        reason := "Pending invalidated — displacement stale"
    else if not lm.pending_setup_is_fresh(signalBar, expiryBar)
        shouldInvalidate := lm.pending_setup_has_expired(expiryBar)
        reason := shouldInvalidate ? "Pending window expired" : "Pending not yet active"
    else if expired or degraded
        shouldInvalidate := true
        reason := expired ? "Setup expired" : "Setup degraded"
    else if not pendingFresh
        shouldInvalidate := true
        reason := "Pending structurally stale"
    else if isExtended
        shouldInvalidate := true
        reason := "Price too extended for pending"
    else
        string side = isLong ? "long" : "short"
        if mode == "Aggressive"
            bool lifecycleOk = currentLifecycle >= LC_DISPLACEMENT_CONFIRMED
            if lifecycleOk and reclaimPass and dispPass_
                canActivate := true
                reason := "AGG pending " + side + " confirmed"
            else
                reason := not lifecycleOk ? "Pending: lifecycle insufficient" : not reclaimPass ? "Pending: reclaim lost (" + str.tostring(math.round(reclaimStr)) + ")" : "Pending: displacement insufficient"
        else if mode == "Balanced"
            bool lifecycleOk = currentLifecycle >= LC_DISPLACEMENT_CONFIRMED
            bool qualityOk = reclaimPass and mssQualPass and bridgePass_ and dispPass_
            if lifecycleOk and qualityOk
                canActivate := true
                reason := "BAL pending " + side + ": quality confirmed"
            else
                reason := not lifecycleOk ? "Pending: lifecycle " + lm.lifecycle_name(currentLifecycle) : not reclaimPass ? "Pending: reclaim insufficient (" + str.tostring(math.round(reclaimStr)) + ")" : not mssQualPass ? "Pending: MSS quality insufficient" : not dispPass_ ? "Pending: displacement insufficient" : "Pending: bridge insufficient"
        else // Conservative
            bool lifecycleOk = currentLifecycle >= LC_DISPLACEMENT_CONFIRMED
            bool qualityOk = reclaimStrong and mssQualStrong and bridgeStrong_ and dispPass_
            bool seqGate = seqOk or (not na(dispStrength) and dispStrength >= 1.5)
            if lifecycleOk and qualityOk and seqGate
                canActivate := true
                reason := "CON pending " + side + ": strong quality confirmed"
            else
                reason := not lifecycleOk ? "Pending: lifecycle insufficient" : not reclaimStrong ? "Pending: reclaim not strong" : not mssQualStrong ? "Pending: MSS not strong" : not dispPass_ ? "Pending: displacement not strong" : not seqGate ? "Pending: sequence insufficient" : "Pending: bridge not strong"

    [canActivate, reason, shouldInvalidate]
```

### Prompt for another AI
```text
You are enhancing pending-to-trade conversion in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_pending_trade_state.pine`.

Use this exact code block:

```pine
export evaluate_pending_activation(bool isLong, int currentLifecycle, bool reclaimPass, float reclaimStr, bool reclaimStrong, float dispStrength, bool seqOk, bool expired, bool degraded, string mode, int signalBar, int expiryBar, bool isExtended, bool mssQualPass, bool mssQualStrong, bool bridgePass_, bool bridgeStrong_, bool pendingFresh, bool reclaimFailed_, bool mssFailed_, bool mssFresh_, bool dispPass_, bool dispFresh_, bool dispFailed_) =>
    bool canActivate = false
    string reason = ""
    bool shouldInvalidate = false

    if reclaimFailed_
        shouldInvalidate := true
        reason := "Pending invalidated — reclaim failed (str=" + str.tostring(math.round(reclaimStr)) + ")"
    else if mssFailed_
        shouldInvalidate := true
        reason := "Pending invalidated — MSS failed"
    else if not mssFresh_
        shouldInvalidate := true
        reason := "Pending invalidated — MSS stale"
    else if dispFailed_
        shouldInvalidate := true
        reason := "Pending invalidated — displacement failed"
    else if not dispFresh_
        shouldInvalidate := true
        reason := "Pending invalidated — displacement stale"
    else if not lm.pending_setup_is_fresh(signalBar, expiryBar)
        shouldInvalidate := lm.pending_setup_has_expired(expiryBar)
        reason := shouldInvalidate ? "Pending window expired" : "Pending not yet active"
    else if expired or degraded
        shouldInvalidate := true
        reason := expired ? "Setup expired" : "Setup degraded"
    else if not pendingFresh
        shouldInvalidate := true
        reason := "Pending structurally stale"
    else if isExtended
        shouldInvalidate := true
        reason := "Price too extended for pending"
    else
        string side = isLong ? "long" : "short"
        if mode == "Aggressive"
            bool lifecycleOk = currentLifecycle >= LC_DISPLACEMENT_CONFIRMED
            if lifecycleOk and reclaimPass and dispPass_
                canActivate := true
                reason := "AGG pending " + side + " confirmed"
            else
                reason := not lifecycleOk ? "Pending: lifecycle insufficient" : not reclaimPass ? "Pending: reclaim lost (" + str.tostring(math.round(reclaimStr)) + ")" : "Pending: displacement insufficient"
        else if mode == "Balanced"
            bool lifecycleOk = currentLifecycle >= LC_DISPLACEMENT_CONFIRMED
            bool qualityOk = reclaimPass and mssQualPass and bridgePass_ and dispPass_
            if lifecycleOk and qualityOk
                canActivate := true
                reason := "BAL pending " + side + ": quality confirmed"
            else
                reason := not lifecycleOk ? "Pending: lifecycle " + lm.lifecycle_name(currentLifecycle) : not reclaimPass ? "Pending: reclaim insufficient (" + str.tostring(math.round(reclaimStr)) + ")" : not mssQualPass ? "Pending: MSS quality insufficient" : not dispPass_ ? "Pending: displacement insufficient" : "Pending: bridge insufficient"
        else // Conservative
            bool lifecycleOk = currentLifecycle >= LC_DISPLACEMENT_CONFIRMED
            bool qualityOk = reclaimStrong and mssQualStrong and bridgeStrong_ and dispPass_
            bool seqGate = seqOk or (not na(dispStrength) and dispStrength >= 1.5)
            if lifecycleOk and qualityOk and seqGate
                canActivate := true
                reason := "CON pending " + side + ": strong quality confirmed"
            else
                reason := not lifecycleOk ? "Pending: lifecycle insufficient" : not reclaimStrong ? "Pending: reclaim not strong" : not mssQualStrong ? "Pending: MSS not strong" : not dispPass_ ? "Pending: displacement not strong" : not seqGate ? "Pending: sequence insufficient" : "Pending: bridge not strong"

    [canActivate, reason, shouldInvalidate]
```

Task:
- make pending activation less fragile, especially for `Balanced`
- keep hard invalidation for truly broken setups
- prefer loosening activation requirements before loosening invalidation safety checks

Suggested enhancement order:
1. soften `Balanced` `qualityOk`
2. keep `Aggressive` mostly unchanged
3. only lightly soften `Conservative`

Return the modified block and explain how the pending pass rate should improve.
```

## 9. Lifecycle Mode Policy

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_lifecycle_mode.pine`

### Exact code
```pine
export mode_min_lifecycle_for_candidate(string mode) =>
    mode == "Aggressive" ? LC_MSS_CONFIRMED : mode == "Conservative" ? LC_ENTRY_ARMED : LC_DISPLACEMENT_CONFIRMED

export mode_min_lifecycle_for_activation(string mode) =>
    mode == "Aggressive" ? LC_ENTRY_ARMED : mode == "Conservative" ? LC_ENTRY_TRIGGERED : LC_ENTRY_ARMED

export mode_requires_retrace_for_activation(string mode) =>
    mode != "Aggressive"

export mode_allows_direct_signal_activation(string mode) =>
    mode == "Aggressive"

export mode_requires_displacement(string mode) =>
    mode != "Aggressive"

export mode_requires_reclaim_proxy(string mode) =>
    mode == "Conservative"

export mode_name_short(string mode) =>
    mode == "Aggressive" ? "AGG" : mode == "Conservative" ? "CON" : "BAL"

// =====================================================================
// DELAYED ACTIVATION WINDOW POLICY (Chapter 2.1)
// =====================================================================

export mode_pending_activation_bars(string mode) =>
    mode == "Aggressive" ? 2 : mode == "Conservative" ? 7 : 5

export pending_setup_is_fresh(int signalBar, int expiryBar) =>
    bar_index >= signalBar and bar_index <= expiryBar

export pending_setup_has_expired(int expiryBar) =>
```

### Prompt for another AI
```text
You are enhancing lifecycle mode policy in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_lifecycle_mode.pine`.

Use this exact code block:

```pine
export mode_min_lifecycle_for_candidate(string mode) =>
    mode == "Aggressive" ? LC_MSS_CONFIRMED : mode == "Conservative" ? LC_ENTRY_ARMED : LC_DISPLACEMENT_CONFIRMED

export mode_min_lifecycle_for_activation(string mode) =>
    mode == "Aggressive" ? LC_ENTRY_ARMED : mode == "Conservative" ? LC_ENTRY_TRIGGERED : LC_ENTRY_ARMED

export mode_requires_retrace_for_activation(string mode) =>
    mode != "Aggressive"

export mode_allows_direct_signal_activation(string mode) =>
    mode == "Aggressive"

export mode_requires_displacement(string mode) =>
    mode != "Aggressive"

export mode_requires_reclaim_proxy(string mode) =>
    mode == "Conservative"

export mode_name_short(string mode) =>
    mode == "Aggressive" ? "AGG" : mode == "Conservative" ? "CON" : "BAL"

// =====================================================================
// DELAYED ACTIVATION WINDOW POLICY (Chapter 2.1)
// =====================================================================

export mode_pending_activation_bars(string mode) =>
    mode == "Aggressive" ? 2 : mode == "Conservative" ? 7 : 5

export pending_setup_is_fresh(int signalBar, int expiryBar) =>
    bar_index >= signalBar and bar_index <= expiryBar

export pending_setup_has_expired(int expiryBar) =>
```

Task:
- improve trade frequency by softening mode policy only if library threshold tuning is not enough
- prioritize `Balanced`
- avoid changing the entire philosophy of each mode

Suggested enhancement order:
1. widen `mode_pending_activation_bars("Balanced")`
2. consider lowering the `Balanced` candidate lifecycle from `LC_DISPLACEMENT_CONFIRMED` only if needed
3. do not enable direct signal activation for non-Aggressive unless you explicitly justify it

Return the modified block and explain the exact mode-policy changes.
```

## 10. Reclaim Mode Pass

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`

### Exact code
```pine
export reclaim_mode_pass(bool detected_, bool valid_, bool strong_, float score_, string mode) =>
    bool pass = false
    if mode == "Aggressive"
        pass := detected_ and score_ >= 15.0
    else if mode == "Conservative"
        pass := strong_ or score_ >= 55.0
    else // Balanced
        pass := valid_ or score_ >= 35.0
    pass
```

### Prompt for another AI
```text
You are enhancing reclaim threshold policy in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`.

Use this exact code block:

```pine
export reclaim_mode_pass(bool detected_, bool valid_, bool strong_, float score_, string mode) =>
    bool pass = false
    if mode == "Aggressive"
        pass := detected_ and score_ >= 15.0
    else if mode == "Conservative"
        pass := strong_ or score_ >= 55.0
    else // Balanced
        pass := valid_ or score_ >= 35.0
    pass
```

Task:
- modestly increase reclaim pass rate
- keep Aggressive easiest, Balanced moderate, Conservative hardest
- prefer small numeric adjustments only

Return the modified block and the exact threshold deltas.
```

## 11. MSS Freshness And Mode Pass

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`

### Exact code
```pine
        int mssMaxFresh = mode == "Aggressive" ? 35 : mode == "Conservative" ? 18 : 25
        fresh := mssAge <= mssMaxFresh
        if not fresh and not failed
            failed := true
            failReason := "MSS stale (" + str.tostring(mssAge) + " bars)"
        if not newMss and not failed and mssAge >= 1 and not na(triggerLevel)
            bool holdingBreak = isLong ? close > triggerLevel : close < triggerLevel
            if holdingBreak
                followBars := followBars + 1
            else if followBars > 0
                followBars := followBars - 1
        if not failed and not newMss and mssAge >= 2 and not na(triggerLevel)
            bool lostBreak = isLong ? close < triggerLevel - atrVal * 0.15 : close > triggerLevel + atrVal * 0.15
            if lostBreak and followBars <= 1
                failed := true
                failReason := "Break lost — price recrossed trigger"
        score += math.min(tScore * 0.3, 30.0)
        score += math.min(breakQScore * 0.3, 30.0)
        score += math.max(0.0, math.min(seqScore, 20.0))
        if not newMss and prevMssScore > score
            score := score * 0.7 + prevMssScore * 0.3
        float dispScore = not na(mssDisp_) ? math.min(mssDisp_ * 10.0, 15.0) : 0.0
        score += dispScore
        score += math.min(float(followBars) * 2.0, 5.0)
        if mssAge > math.round(mssMaxFresh * 0.5)
            float decay = float(mssAge - math.round(mssMaxFresh * 0.5)) / float(mssMaxFresh) * 15.0
            score -= decay
        score := math.max(0.0, math.min(100.0, score))
        detected := not failed
        if detected
            mssWeak := score < 35.0 or trigSig == 0
            valid := score >= 35.0 and trigSig >= 1
            strong_ := score >= 60.0 and trigSig >= 2 and bodyConf
        if failed
            detected := false
            valid := false
            strong_ := false
            reason := "MSS failed: " + failReason
        else if strong_
            reason := "Strong MSS (" + str.tostring(math.round(score)) + ") — " + trigType
        else if valid
            reason := "Valid MSS (" + str.tostring(math.round(score)) + ") — " + trigType
        else if detected and mssWeak
            reason := "Weak MSS (" + str.tostring(math.round(score)) + ") — " + (trigSig == 0 ? "trivial trigger" : "low quality break")
        else
            reason := na(sweepBar_) ? "No sweep context" : not afterSweep ? "MSS before sweep" : "No MSS detected"
    [detected, mssWeak, valid, strong_, fresh, failed, score, reason, failReason, breakLvl, bodyConf, trigType, trigSig, followBars, breakQScore]

// Mode-dependent MSS pass (Chapter 4)
// Returns: [pass, passStrong]
export mss_mode_pass(bool detected_, bool valid_, bool strong_, float score_, int trigSig_, string mode) =>
    bool pass = false
    bool passStrong = false
    if mode == "Aggressive"
        pass := detected_ and score_ >= 20.0
        passStrong := valid_ and score_ >= 50.0
    else if mode == "Conservative"
        pass := valid_ and trigSig_ >= 2 and score_ >= 50.0
        passStrong := strong_ and trigSig_ >= 2 and score_ >= 65.0
    else // Balanced
        pass := valid_ and trigSig_ >= 1 and score_ >= 35.0
        passStrong := strong_ or (valid_ and score_ >= 55.0 and trigSig_ >= 2)
```

### Prompt for another AI
```text
You are enhancing MSS freshness and mode-pass strictness in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`.

Use this exact code block:

```pine
        int mssMaxFresh = mode == "Aggressive" ? 35 : mode == "Conservative" ? 18 : 25
        fresh := mssAge <= mssMaxFresh
        if not fresh and not failed
            failed := true
            failReason := "MSS stale (" + str.tostring(mssAge) + " bars)"
        if not newMss and not failed and mssAge >= 1 and not na(triggerLevel)
            bool holdingBreak = isLong ? close > triggerLevel : close < triggerLevel
            if holdingBreak
                followBars := followBars + 1
            else if followBars > 0
                followBars := followBars - 1
        if not failed and not newMss and mssAge >= 2 and not na(triggerLevel)
            bool lostBreak = isLong ? close < triggerLevel - atrVal * 0.15 : close > triggerLevel + atrVal * 0.15
            if lostBreak and followBars <= 1
                failed := true
                failReason := "Break lost — price recrossed trigger"
        score += math.min(tScore * 0.3, 30.0)
        score += math.min(breakQScore * 0.3, 30.0)
        score += math.max(0.0, math.min(seqScore, 20.0))
        if not newMss and prevMssScore > score
            score := score * 0.7 + prevMssScore * 0.3
        float dispScore = not na(mssDisp_) ? math.min(mssDisp_ * 10.0, 15.0) : 0.0
        score += dispScore
        score += math.min(float(followBars) * 2.0, 5.0)
        if mssAge > math.round(mssMaxFresh * 0.5)
            float decay = float(mssAge - math.round(mssMaxFresh * 0.5)) / float(mssMaxFresh) * 15.0
            score -= decay
        score := math.max(0.0, math.min(100.0, score))
        detected := not failed
        if detected
            mssWeak := score < 35.0 or trigSig == 0
            valid := score >= 35.0 and trigSig >= 1
            strong_ := score >= 60.0 and trigSig >= 2 and bodyConf
        if failed
            detected := false
            valid := false
            strong_ := false
            reason := "MSS failed: " + failReason
        else if strong_
            reason := "Strong MSS (" + str.tostring(math.round(score)) + ") — " + trigType
        else if valid
            reason := "Valid MSS (" + str.tostring(math.round(score)) + ") — " + trigType
        else if detected and mssWeak
            reason := "Weak MSS (" + str.tostring(math.round(score)) + ") — " + (trigSig == 0 ? "trivial trigger" : "low quality break")
        else
            reason := na(sweepBar_) ? "No sweep context" : not afterSweep ? "MSS before sweep" : "No MSS detected"
    [detected, mssWeak, valid, strong_, fresh, failed, score, reason, failReason, breakLvl, bodyConf, trigType, trigSig, followBars, breakQScore]

// Mode-dependent MSS pass (Chapter 4)
// Returns: [pass, passStrong]
export mss_mode_pass(bool detected_, bool valid_, bool strong_, float score_, int trigSig_, string mode) =>
    bool pass = false
    bool passStrong = false
    if mode == "Aggressive"
        pass := detected_ and score_ >= 20.0
        passStrong := valid_ and score_ >= 50.0
    else if mode == "Conservative"
        pass := valid_ and trigSig_ >= 2 and score_ >= 50.0
        passStrong := strong_ and trigSig_ >= 2 and score_ >= 65.0
    else // Balanced
        pass := valid_ and trigSig_ >= 1 and score_ >= 35.0
        passStrong := strong_ or (valid_ and score_ >= 55.0 and trigSig_ >= 2)
```

Task:
- slightly reduce false negatives in MSS qualification
- keep trigger significance meaningful
- prefer small threshold moves over structural rewrites

Suggested enhancement order:
1. widen freshness windows a little
2. slightly soften `Balanced` score thresholds
3. slightly soften Conservative only if still too restrictive

Return the modified block and list the threshold changes.
```

## 12. Extension Block

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`

### Exact code
```pine
export compute_extension_block(bool isLong, int mssBar_, float pivotVal, float atrVal, string mode, float reqLevel) =>
    bool isExtended = false
    float distAtr = 0.0
    string reason = ""
    if atrVal > 0
        float anchor = not na(pivotVal) ? pivotVal : reqLevel
        if not na(anchor)
            distAtr := isLong ? (close - anchor) / atrVal : (anchor - close) / atrVal
            float maxExt = mode == "Aggressive" ? 1.5 : mode == "Conservative" ? 0.7 : 1.0
            if distAtr > maxExt
                isExtended := true
                reason := str.tostring(distAtr, "#.##") + " ATR > " + str.tostring(maxExt, "#.#") + " max"
        if not isExtended and not na(mssBar_)
            int barsSince = bar_index - mssBar_
            int maxBars = mode == "Aggressive" ? 15 : mode == "Conservative" ? 8 : 12
            if barsSince > maxBars
                isExtended := true
                reason := str.tostring(barsSince) + " bars since MSS > " + str.tostring(maxBars)
    [isExtended, distAtr, reason]
```

### Prompt for another AI
```text
You are enhancing extension filtering in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`.

Use this exact code block:

```pine
export compute_extension_block(bool isLong, int mssBar_, float pivotVal, float atrVal, string mode, float reqLevel) =>
    bool isExtended = false
    float distAtr = 0.0
    string reason = ""
    if atrVal > 0
        float anchor = not na(pivotVal) ? pivotVal : reqLevel
        if not na(anchor)
            distAtr := isLong ? (close - anchor) / atrVal : (anchor - close) / atrVal
            float maxExt = mode == "Aggressive" ? 1.5 : mode == "Conservative" ? 0.7 : 1.0
            if distAtr > maxExt
                isExtended := true
                reason := str.tostring(distAtr, "#.##") + " ATR > " + str.tostring(maxExt, "#.#") + " max"
        if not isExtended and not na(mssBar_)
            int barsSince = bar_index - mssBar_
            int maxBars = mode == "Aggressive" ? 15 : mode == "Conservative" ? 8 : 12
            if barsSince > maxBars
                isExtended := true
                reason := str.tostring(barsSince) + " bars since MSS > " + str.tostring(maxBars)
    [isExtended, distAtr, reason]
```

Task:
- reduce over-blocking from extension rules
- prioritize `Balanced`
- do not remove the filter entirely

Suggested enhancement order:
1. slightly widen `Balanced` ATR distance
2. slightly widen `Balanced` bars-since-MSS
3. only lightly soften Conservative

Return the modified block and explain the new thresholds.
```

## 13. Displacement Quality, Pass, And Bridge

### Source file
`/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`

### Exact code
```pine
        if lookback >= 0
            for i = lookback to 0
                float barOpen = open[i]
                float barClose = close[i]
                float barHigh = high[i]
                float barLow = low[i]
                float barBody = math.abs(barClose - barOpen)
                float barRange = barHigh - barLow
                if barRange <= 0
                    continue
                bool dirOk = isLong ? barClose > barOpen : barClose < barOpen
                if not dirOk
                    continue
                float rAtr = barRange / atrVal
                float bDom = barBody / barRange
                float cQual = isLong ? (barClose - barLow) / barRange : (barHigh - barClose) / barRange
                if rAtr < 0.4
                    continue
                float barQ = rAtr * 0.4 + bDom * 0.35 + cQual * 0.25
                if barQ > bestRangeAtr * 0.4 + bestBodyDom * 0.35 + bestCloseQual * 0.25 or not foundDisp
                    bestRangeAtr := rAtr
                    bestBodyDom := bDom
                    bestCloseQual := cQual
                    bestDispBar := bar_index - i
                    bestOrigin := isLong ? barLow : barHigh
                    bestExtreme := isLong ? barHigh : barLow
                    foundDisp := true

        if foundDisp
            dispBar := bestDispBar
            rangeAtr := bestRangeAtr
            bodyDom := bestBodyDom
            closeQual := bestCloseQual
            if newMss or na(originPrice)
                originPrice := bestOrigin
                extremePrice := bestExtreme
            else
                extremePrice := isLong ? math.max(nz(extremePrice), bestExtreme) : math.min(nz(extremePrice, 1e18), bestExtreme)

        float compScore = 0.0

        float rangeScore = math.min(rangeAtr * 10.0, 20.0)
        compScore += rangeScore

        float bodyScore = bodyDom >= 0.75 ? 20.0 : bodyDom >= 0.6 ? 15.0 : bodyDom >= 0.45 ? 10.0 : 5.0
        compScore += bodyScore

        float closeScore = closeQual >= 0.8 ? 15.0 : closeQual >= 0.6 ? 10.0 : closeQual >= 0.4 ? 5.0 : 0.0
        compScore += closeScore

        float commitScore = 0.0
        if not na(mssBreakLvl_) and atrVal > 0
            float beyondBreak = isLong ? (close - mssBreakLvl_) / atrVal : (mssBreakLvl_ - close) / atrVal
            commitScore := beyondBreak > 1.0 ? 15.0 : beyondBreak > 0.5 ? 10.0 : beyondBreak > 0.15 ? 5.0 : 0.0
        compScore += commitScore

        float imbScore = 0.0
        bool fvgAfterMss = not na(fvgBar_) and fvgBar_ >= mssBar_
        bool fvgFresh = not na(fvgBar_) and (bar_index - fvgBar_) <= 25
        if fvgAfterMss and fvgFresh and not fvgMitigated_
            hasImbalance := true
            fvgGrOut := fvgGrade_
            imbScore := fvgGrade_ >= 3 ? 15.0 : fvgGrade_ >= 2 ? 10.0 : 5.0
        else if fvgAfterMss and fvgMitigated_
            imbScore := -5.0
        if not hasImbalance and rangeAtr >= 1.5 and bodyDom >= 0.65
            imbScore := math.max(imbScore, 3.0)
        compScore += imbScore

        if not newMss and not failed and mssAge >= 1
            bool holdingBeyond = isLong ? close > nz(mssBreakLvl_) : close < nz(mssBreakLvl_, 1e18)
            if holdingBeyond
                followBars := followBars + 1
            else if followBars > 0
                followBars := followBars - 1
        float ftScore = math.min(float(followBars) * 2.5, 10.0)
        compScore += ftScore

        float snapbackPenalty = 0.0
        if not na(originPrice) and not na(extremePrice) and atrVal > 0
            float totalMove = math.abs(extremePrice - originPrice)
            float retraceFromExtreme = isLong ? (extremePrice - close) : (close - extremePrice)
            if totalMove > 0 and retraceFromExtreme > 0
                float retraceRatio = retraceFromExtreme / totalMove
                if retraceRatio > 0.8
                    snapbackPenalty := -15.0
                else if retraceRatio > 0.6
                    snapbackPenalty := -10.0
                else if retraceRatio > 0.4
                    snapbackPenalty := -5.0
        compScore += snapbackPenalty

        float dispBonus = not na(mssDisp_) ? math.min(mssDisp_ * 3.0, 5.0) : 0.0
        compScore += dispBonus

        int dispMaxFresh = mode == "Aggressive" ? 30 : mode == "Conservative" ? 15 : 22
        if mssAge > math.round(dispMaxFresh * 0.5) and mssAge <= dispMaxFresh
            float decay = float(mssAge - math.round(dispMaxFresh * 0.5)) / float(dispMaxFresh) * 12.0
            compScore -= decay
        fresh := mssAge <= dispMaxFresh

        if not fresh and not failed
            failed := true
            failReason := "Displacement stale (" + str.tostring(mssAge) + " bars since MSS)"

        if not failed and not newMss and mssAge >= 2 and not na(originPrice)
            bool lostDisp = isLong ? close < originPrice + atrVal * 0.1 : close > originPrice - atrVal * 0.1
            if lostDisp and followBars <= 1
                failed := true
                failReason := "Displacement failed — price snapped back to origin"

        if not failed and hasImbalance and fvgMitigated_ and not na(fvgBar_) and (bar_index - fvgBar_) <= 3
            failed := true
            failReason := "Displacement imbalance mitigated immediately"

        if not newMss and not newDisp and prevDispScore > compScore
            compScore := compScore * 0.7 + prevDispScore * 0.3
        score := math.max(0.0, math.min(100.0, compScore))

        if not failed and foundDisp and mssValid_
            detected := true
            dispWeak := score < 30.0
            valid := score >= 30.0
            strong_ := score >= 60.0 and bodyDom >= 0.6 and rangeAtr >= 0.8
            retained := not na(mssBreakLvl_) and (isLong ? close > mssBreakLvl_ : close < mssBreakLvl_)

        if failed
            detected := false
            valid := false
            strong_ := false
            reason := "Displacement failed: " + failReason
        else if strong_
            reason := "Strong displacement (" + str.tostring(math.round(score)) + ") — " + str.tostring(rangeAtr, "#.#") + "×ATR, body " + str.tostring(math.round(bodyDom * 100)) + "%"
        else if valid and not dispWeak
            reason := "Valid displacement (" + str.tostring(math.round(score)) + ") — " + str.tostring(rangeAtr, "#.#") + "×ATR"
        else if detected and dispWeak
            reason := "Weak push (" + str.tostring(math.round(score)) + ") — displacement not confirmed"
        else if mssFailed_
            reason := "MSS failed — no displacement context"
        else if not foundDisp
            reason := "No directional push found after MSS"
        else if not mssValid_
            reason := "MSS not validated — displacement pending"
    else
        if mssFailed_
            reason := "MSS failed — displacement blocked"
            failed := true
        else if na(mssBar_)
            reason := "No MSS context"

    [detected, dispWeak, valid, strong_, fresh, failed, score, reason, failReason,
     dispBar, rangeAtr, bodyDom, closeQual, followBars, hasImbalance, fvgGrOut,
     retained, originPrice, extremePrice]
```

```pine
export displacement_mode_pass(bool detected_, bool valid_, bool strong_, float score_, bool failed_, string mode) =>
    bool pass = false
    bool passStrong = false
    if not failed_
        if mode == "Aggressive"
            pass := detected_ and score_ >= 15.0
            passStrong := valid_ and score_ >= 45.0
        else if mode == "Conservative"
            pass := valid_ and not strong_ ? score_ >= 50.0 : strong_
            passStrong := strong_ and score_ >= 65.0
        else // Balanced
            pass := valid_ and score_ >= 30.0
            passStrong := strong_ or (valid_ and score_ >= 55.0)
    [pass, passStrong]

// Displacement/FVG bridge (Chapter 5)
// Returns: [bridgePass, bridgeStrong, reason]
export evaluate_displacement_bridge(float mssDisp_, int fvgBar_, int fvgGrade_, bool fvgMitigated, bool seqOk, int mssBar_, string mode, bool dispValid_, bool dispStrong_, bool dispFailed_, float dispScore_) =>
    bool bridgePass = false
    bool bridgeStrong = false
    string reason = ""
    if dispFailed_
        reason := "Bridge fail — displacement failed"
    else
        [dPass, dPassStrong] = displacement_mode_pass(not dispFailed_, dispValid_, dispStrong_, dispScore_, dispFailed_, mode)
        bridgePass := dPass
        bridgeStrong := dPassStrong
        if not bridgePass
            float minDisp = mode == "Conservative" ? 1.5 : mode == "Balanced" ? 1.0 : 0.5
            bool legacyOk = not na(mssDisp_) and mssDisp_ >= minDisp
            bool hasFreshFvg = not na(fvgBar_) and fvgGrade_ >= 2 and not fvgMitigated
            bool fvgAfterMss = hasFreshFvg and not na(mssBar_) and fvgBar_ >= mssBar_
            if legacyOk and (seqOk or (fvgAfterMss and (bar_index - fvgBar_) <= 20))
                bridgePass := true
                reason := "Bridge OK [legacy fallback]"
        if bridgePass and reason == ""
            reason := "Bridge OK" + (bridgeStrong ? " [strong]" : "") + " (disp=" + str.tostring(math.round(dispScore_)) + ")"
        else if not bridgePass
            reason := "Bridge fail — disp score " + str.tostring(math.round(dispScore_)) + " insufficient for " + mode
```

### Prompt for another AI
```text
You are enhancing displacement detection and displacement mode pass in `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_structure_engine.pine`.

Use these exact code blocks:

```pine
        if lookback >= 0
            for i = lookback to 0
                float barOpen = open[i]
                float barClose = close[i]
                float barHigh = high[i]
                float barLow = low[i]
                float barBody = math.abs(barClose - barOpen)
                float barRange = barHigh - barLow
                if barRange <= 0
                    continue
                bool dirOk = isLong ? barClose > barOpen : barClose < barOpen
                if not dirOk
                    continue
                float rAtr = barRange / atrVal
                float bDom = barBody / barRange
                float cQual = isLong ? (barClose - barLow) / barRange : (barHigh - barClose) / barRange
                if rAtr < 0.4
                    continue
                float barQ = rAtr * 0.4 + bDom * 0.35 + cQual * 0.25
                if barQ > bestRangeAtr * 0.4 + bestBodyDom * 0.35 + bestCloseQual * 0.25 or not foundDisp
                    bestRangeAtr := rAtr
                    bestBodyDom := bDom
                    bestCloseQual := cQual
                    bestDispBar := bar_index - i
                    bestOrigin := isLong ? barLow : barHigh
                    bestExtreme := isLong ? barHigh : barLow
                    foundDisp := true

        if foundDisp
            dispBar := bestDispBar
            rangeAtr := bestRangeAtr
            bodyDom := bestBodyDom
            closeQual := bestCloseQual
            if newMss or na(originPrice)
                originPrice := bestOrigin
                extremePrice := bestExtreme
            else
                extremePrice := isLong ? math.max(nz(extremePrice), bestExtreme) : math.min(nz(extremePrice, 1e18), bestExtreme)

        float compScore = 0.0

        float rangeScore = math.min(rangeAtr * 10.0, 20.0)
        compScore += rangeScore

        float bodyScore = bodyDom >= 0.75 ? 20.0 : bodyDom >= 0.6 ? 15.0 : bodyDom >= 0.45 ? 10.0 : 5.0
        compScore += bodyScore

        float closeScore = closeQual >= 0.8 ? 15.0 : closeQual >= 0.6 ? 10.0 : closeQual >= 0.4 ? 5.0 : 0.0
        compScore += closeScore

        float commitScore = 0.0
        if not na(mssBreakLvl_) and atrVal > 0
            float beyondBreak = isLong ? (close - mssBreakLvl_) / atrVal : (mssBreakLvl_ - close) / atrVal
            commitScore := beyondBreak > 1.0 ? 15.0 : beyondBreak > 0.5 ? 10.0 : beyondBreak > 0.15 ? 5.0 : 0.0
        compScore += commitScore

        float imbScore = 0.0
        bool fvgAfterMss = not na(fvgBar_) and fvgBar_ >= mssBar_
        bool fvgFresh = not na(fvgBar_) and (bar_index - fvgBar_) <= 25
        if fvgAfterMss and fvgFresh and not fvgMitigated_
            hasImbalance := true
            fvgGrOut := fvgGrade_
            imbScore := fvgGrade_ >= 3 ? 15.0 : fvgGrade_ >= 2 ? 10.0 : 5.0
        else if fvgAfterMss and fvgMitigated_
            imbScore := -5.0
        if not hasImbalance and rangeAtr >= 1.5 and bodyDom >= 0.65
            imbScore := math.max(imbScore, 3.0)
        compScore += imbScore

        if not newMss and not failed and mssAge >= 1
            bool holdingBeyond = isLong ? close > nz(mssBreakLvl_) : close < nz(mssBreakLvl_, 1e18)
            if holdingBeyond
                followBars := followBars + 1
            else if followBars > 0
                followBars := followBars - 1
        float ftScore = math.min(float(followBars) * 2.5, 10.0)
        compScore += ftScore

        float snapbackPenalty = 0.0
        if not na(originPrice) and not na(extremePrice) and atrVal > 0
            float totalMove = math.abs(extremePrice - originPrice)
            float retraceFromExtreme = isLong ? (extremePrice - close) : (close - extremePrice)
            if totalMove > 0 and retraceFromExtreme > 0
                float retraceRatio = retraceFromExtreme / totalMove
                if retraceRatio > 0.8
                    snapbackPenalty := -15.0
                else if retraceRatio > 0.6
                    snapbackPenalty := -10.0
                else if retraceRatio > 0.4
                    snapbackPenalty := -5.0
        compScore += snapbackPenalty

        float dispBonus = not na(mssDisp_) ? math.min(mssDisp_ * 3.0, 5.0) : 0.0
        compScore += dispBonus

        int dispMaxFresh = mode == "Aggressive" ? 30 : mode == "Conservative" ? 15 : 22
        if mssAge > math.round(dispMaxFresh * 0.5) and mssAge <= dispMaxFresh
            float decay = float(mssAge - math.round(dispMaxFresh * 0.5)) / float(dispMaxFresh) * 12.0
            compScore -= decay
        fresh := mssAge <= dispMaxFresh

        if not fresh and not failed
            failed := true
            failReason := "Displacement stale (" + str.tostring(mssAge) + " bars since MSS)"

        if not failed and not newMss and mssAge >= 2 and not na(originPrice)
            bool lostDisp = isLong ? close < originPrice + atrVal * 0.1 : close > originPrice - atrVal * 0.1
            if lostDisp and followBars <= 1
                failed := true
                failReason := "Displacement failed — price snapped back to origin"

        if not failed and hasImbalance and fvgMitigated_ and not na(fvgBar_) and (bar_index - fvgBar_) <= 3
            failed := true
            failReason := "Displacement imbalance mitigated immediately"

        if not newMss and not newDisp and prevDispScore > compScore
            compScore := compScore * 0.7 + prevDispScore * 0.3
        score := math.max(0.0, math.min(100.0, compScore))

        if not failed and foundDisp and mssValid_
            detected := true
            dispWeak := score < 30.0
            valid := score >= 30.0
            strong_ := score >= 60.0 and bodyDom >= 0.6 and rangeAtr >= 0.8
            retained := not na(mssBreakLvl_) and (isLong ? close > mssBreakLvl_ : close < mssBreakLvl_)

        if failed
            detected := false
            valid := false
            strong_ := false
            reason := "Displacement failed: " + failReason
        else if strong_
            reason := "Strong displacement (" + str.tostring(math.round(score)) + ") — " + str.tostring(rangeAtr, "#.#") + "×ATR, body " + str.tostring(math.round(bodyDom * 100)) + "%"
        else if valid and not dispWeak
            reason := "Valid displacement (" + str.tostring(math.round(score)) + ") — " + str.tostring(rangeAtr, "#.#") + "×ATR"
        else if detected and dispWeak
            reason := "Weak push (" + str.tostring(math.round(score)) + ") — displacement not confirmed"
        else if mssFailed_
            reason := "MSS failed — no displacement context"
        else if not foundDisp
            reason := "No directional push found after MSS"
        else if not mssValid_
            reason := "MSS not validated — displacement pending"
    else
        if mssFailed_
            reason := "MSS failed — displacement blocked"
            failed := true
        else if na(mssBar_)
            reason := "No MSS context"

    [detected, dispWeak, valid, strong_, fresh, failed, score, reason, failReason,
     dispBar, rangeAtr, bodyDom, closeQual, followBars, hasImbalance, fvgGrOut,
     retained, originPrice, extremePrice]
```

```pine
export displacement_mode_pass(bool detected_, bool valid_, bool strong_, float score_, bool failed_, string mode) =>
    bool pass = false
    bool passStrong = false
    if not failed_
        if mode == "Aggressive"
            pass := detected_ and score_ >= 15.0
            passStrong := valid_ and score_ >= 45.0
        else if mode == "Conservative"
            pass := valid_ and not strong_ ? score_ >= 50.0 : strong_
            passStrong := strong_ and score_ >= 65.0
        else // Balanced
            pass := valid_ and score_ >= 30.0
            passStrong := strong_ or (valid_ and score_ >= 55.0)
    [pass, passStrong]

// Displacement/FVG bridge (Chapter 5)
// Returns: [bridgePass, bridgeStrong, reason]
export evaluate_displacement_bridge(float mssDisp_, int fvgBar_, int fvgGrade_, bool fvgMitigated, bool seqOk, int mssBar_, string mode, bool dispValid_, bool dispStrong_, bool dispFailed_, float dispScore_) =>
    bool bridgePass = false
    bool bridgeStrong = false
    string reason = ""
    if dispFailed_
        reason := "Bridge fail — displacement failed"
    else
        [dPass, dPassStrong] = displacement_mode_pass(not dispFailed_, dispValid_, dispStrong_, dispScore_, dispFailed_, mode)
        bridgePass := dPass
        bridgeStrong := dPassStrong
        if not bridgePass
            float minDisp = mode == "Conservative" ? 1.5 : mode == "Balanced" ? 1.0 : 0.5
            bool legacyOk = not na(mssDisp_) and mssDisp_ >= minDisp
            bool hasFreshFvg = not na(fvgBar_) and fvgGrade_ >= 2 and not fvgMitigated
            bool fvgAfterMss = hasFreshFvg and not na(mssBar_) and fvgBar_ >= mssBar_
            if legacyOk and (seqOk or (fvgAfterMss and (bar_index - fvgBar_) <= 20))
                bridgePass := true
                reason := "Bridge OK [legacy fallback]"
        if bridgePass and reason == ""
            reason := "Bridge OK" + (bridgeStrong ? " [strong]" : "") + " (disp=" + str.tostring(math.round(dispScore_)) + ")"
        else if not bridgePass
            reason := "Bridge fail — disp score " + str.tostring(math.round(dispScore_)) + " insufficient for " + mode
```

Task:
- modestly increase displacement confirmation rate
- preserve the idea that weak displacement should still be filtered
- prioritize `Balanced`

Suggested enhancement order:
1. lower the minimum candidate bar strength slightly
2. widen displacement freshness slightly
3. soften `Balanced` `pass` and `bridge` thresholds slightly
4. keep Conservative comparatively strict

Return the modified blocks and a short summary of exact threshold changes.
```

## 14. Trade Count Is Close-Based, Not Entry-Based

### Source files
- `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/version1-improving-dev.pine`
- `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/pine/prod/tv_pending_trade_state.pine`

### Exact code
```pine
    if closed
        pts.update_stats(mainStats, r, r > 0)
```

```pine
    float wr = mainStats.totalTrades > 0 ? (float(mainStats.wins) / mainStats.totalTrades) * 100 : 0
    rdash.PerfDisplay perf = rdash.PerfDisplay.new(
         fmt.format_pct(wr), wr >= 50 ? uiPosColor : uiNegColor,
         str.tostring(mainStats.totalTrades),
         str.tostring(mainStats.wins) + " / " + str.tostring(mainStats.losses),
```

```pine
export method update_stats(T.Stats s, float rEarned, bool isWin) =>
    s.totalTrades += 1
    s.totalR += rEarned
    s.equityR += rEarned
    if isWin
        s.wins += 1
    else
        s.losses += 1
```

### Prompt for another AI
```text
You are reviewing trade-count semantics in the Pine performance flow.

Use these exact code blocks:

```pine
    if closed
        pts.update_stats(mainStats, r, r > 0)
```

```pine
    float wr = mainStats.totalTrades > 0 ? (float(mainStats.wins) / mainStats.totalTrades) * 100 : 0
    rdash.PerfDisplay perf = rdash.PerfDisplay.new(
         fmt.format_pct(wr), wr >= 50 ? uiPosColor : uiNegColor,
         str.tostring(mainStats.totalTrades),
         str.tostring(mainStats.wins) + " / " + str.tostring(mainStats.losses),
```

```pine
export method update_stats(T.Stats s, float rEarned, bool isWin) =>
    s.totalTrades += 1
    s.totalR += rEarned
    s.equityR += rEarned
    if isWin
        s.wins += 1
    else
        s.losses += 1
```

Task:
- do not change this unless the user explicitly wants entry-count instead of close-count
- this is diagnostic context only
- explain to the user if zero trades may reflect zero closed trades rather than zero entries

Return "no code change recommended" unless explicitly asked to change counting semantics.
```

## Suggested Handoff Order

Use these prompts in this order:
1. `tv_pending_trade_state.pine` mode qualification and pending activation
2. `tv_structure_engine.pine` extension, MSS, and displacement thresholds
3. `tv_signal_gate_engine.pine` ICT and Silver Bullet gates
4. `tv_lifecycle_mode.pine` mode policy if still too strict
5. `version1-improving-dev.pine` raw MSS trigger and promotion logic only as a last resort
