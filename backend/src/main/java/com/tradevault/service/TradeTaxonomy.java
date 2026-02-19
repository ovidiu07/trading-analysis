package com.tradevault.service;

import java.util.List;
import java.util.Set;

public final class TradeTaxonomy {
    private TradeTaxonomy() {
    }

    public static final List<String> FEELINGS = List.of(
            "Calm",
            "Focused",
            "Confident",
            "Patient",
            "Disciplined",
            "Neutral",
            "Curious",
            "Alert",
            "Energized",
            "Motivated",
            "Determined",
            "Cautious",
            "Hesitant",
            "Uncertain",
            "Doubtful",
            "Anxious",
            "Stressed",
            "Overwhelmed",
            "Frustrated",
            "Irritated",
            "Impatient",
            "Fearful",
            "FOMO (Fear of missing out)",
            "Greedy",
            "Euphoric",
            "Revengeful",
            "Distracted",
            "Tired",
            "Bored",
            "Detached"
    );

    public static final List<String> RULE_BREAKS = List.of(
            "No pre-trade plan",
            "Entered without confirmation",
            "Chased price (late entry)",
            "Entered in the middle of range (chop)",
            "Ignored HTF bias",
            "Ignored key level",
            "Ignored liquidity sweep requirement",
            "Ignored MSS/structure shift requirement",
            "Ignored displacement requirement",
            "Ignored retest requirement",
            "Traded against the trend",
            "Overtraded (too many trades)",
            "Revenge trade",
            "FOMO entry",
            "Impulsive entry",
            "Increased size after a loss",
            "Oversized position",
            "Risked more than daily limit",
            "Risked more than plan per trade",
            "Moved stop-loss further away",
            "Removed stop-loss",
            "Tightened stop-loss randomly",
            "Took profit too early (no rule)",
            "Let winner turn into loser",
            "Closed early due to fear",
            "Did not take partials per plan",
            "Did not trail per plan",
            "Moved to breakeven too early",
            "Did not move to breakeven when rules said",
            "Averaged down / added to loser",
            "Added without confirmation",
            "Held through high-impact news",
            "Entered during high-impact news window",
            "Traded outside session window",
            "Ignored max trades rule",
            "Ignored profit target stop rule",
            "Ignored loss limit stop rule",
            "Didn't respect entry trigger candle",
            "Ignored spread/volatility conditions",
            "Poor execution (market when limit planned)",
            "Misread direction (clicked wrong side)",
            "Wrong quantity entered",
            "Wrong instrument/symbol",
            "Didn't set TP",
            "Didn't set SL",
            "Slippage/fees not considered",
            "Emotional trading (anger/frustration)",
            "Emotional trading (euphoria/greed)",
            "Distracted / multitasking",
            "No journal / no post-trade review"
    );

    public static final Set<String> FEELINGS_SET = Set.copyOf(FEELINGS);
    public static final Set<String> RULE_BREAKS_SET = Set.copyOf(RULE_BREAKS);
}
