package com.tradevault.service.growthcoach;

import com.tradevault.dto.growthcoach.GrowthCoachResponse.CoachMessage;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class GrowthCoachMessageEngine {

    public List<CoachMessage> evaluate(Context context) {
        List<CoachMessage> messages = new ArrayList<>();

        if (context.initialCapital() == null) {
            messages.add(message("MISSING_CAPITAL", "DATA_QUALITY", "CRITICAL", 1000, true,
                    Map.of(), List.of("growthCoach.actions.editProfile")));
        }
        if (!context.openRiskKnown() && context.openTradeCount() > 0) {
            messages.add(message("OPEN_TRADE_WITHOUT_STOP", "ACTIVE_TRADES", "CRITICAL", 980, true,
                    Map.of("count", context.unknownRiskTradeCount()),
                    List.of("growthCoach.actions.addStops", "growthCoach.actions.reviewOpenTrades")));
        }
        if ("BLOCKED".equals(context.riskState())) {
            messages.add(message("NO_ADDITIONAL_RISK_CAPACITY", "ACCOUNT_RULES", "CRITICAL", 970, true,
                    Map.of(), List.of("growthCoach.actions.stopTrading", "growthCoach.actions.reviewExposure")));
        } else if (context.dailyLossRemaining() != null
                && context.dailyLossRemaining().compareTo(BigDecimal.ZERO) <= 0) {
            messages.add(message("DAILY_LIMIT_REACHED", "ACCOUNT_RULES", "CRITICAL", 960, true,
                    Map.of(), List.of("growthCoach.actions.stopTrading")));
        }

        if (context.targetReached()) {
            messages.add(message("TARGET_REACHED", "TARGET_REACHED", "POSITIVE", 900, false,
                    Map.of(), List.of("growthCoach.actions.protectResult", "growthCoach.actions.reduceRisk")));
            if (context.amountAboveTarget() != null && context.amountAboveTarget().compareTo(BigDecimal.ZERO) > 0) {
                messages.add(message("TARGET_EXCEEDED", "TARGET_REACHED", "POSITIVE", 895, false,
                        Map.of("amountAboveTarget", context.amountAboveTarget()),
                        List.of("growthCoach.actions.protectResult")));
            }
        } else {
            if (context.realisedTradeCount() == 0) {
                messages.add(message("MONTH_NOT_STARTED", "TARGET_PROGRESS", "INFO", 500, false,
                        mapOf("targetPct", context.targetPct(), "targetAmount", context.targetAmount()),
                        List.of("growthCoach.actions.followPlan")));
            } else if (context.realisedProgressPct() != null
                    && context.realisedProgressPct().compareTo(context.expectedCalendarProgressPct()) >= 0) {
                messages.add(message("ON_TRACK", "TARGET_PROGRESS", "POSITIVE", 490, false,
                        Map.of("progressPct", context.realisedProgressPct()),
                        List.of("growthCoach.actions.maintainRisk")));
            } else if (!"UNLIKELY".equals(context.feasibility()) && !"UNSAFE".equals(context.feasibility())) {
                messages.add(message("BEHIND_BUT_RECOVERABLE", "TARGET_PROGRESS", "CAUTION", 510, false,
                        Map.of(), List.of("growthCoach.actions.followPlan")));
            } else {
                messages.add(message("BEHIND_UNREALISTIC", "TARGET_FEASIBILITY", "WARNING", 700, false,
                        mapOf("requiredR", context.requiredR(), "daysRemaining", context.daysRemaining()),
                        List.of("growthCoach.actions.reviewTarget", "growthCoach.actions.doNotChase")));
                messages.add(message("DO_NOT_INCREASE_TO_CATCH_UP", "RISK", "WARNING", 695, false,
                        Map.of(), List.of("growthCoach.actions.maintainRisk", "growthCoach.actions.reviewTarget")));
            }
        }

        if (context.floatingPnl() != null && context.floatingPnl().compareTo(BigDecimal.ZERO) > 0) {
            messages.add(message("OPEN_PROFIT_NOT_REALIZED", "ACTIVE_TRADES", "INFO", 680, false,
                    Map.of("floatingPnL", context.floatingPnl()),
                    List.of("growthCoach.actions.reviewOpenTrades")));
        } else if (context.floatingPnl() != null && context.floatingPnl().compareTo(BigDecimal.ZERO) < 0) {
            messages.add(message("OPEN_LOSS_REDUCES_BUFFER", "ACTIVE_TRADES", "WARNING", 760, false,
                    Map.of("bufferReduction", context.floatingPnl().abs()),
                    List.of("growthCoach.actions.reviewExposure")));
        }

        if ("REDUCED".equals(context.riskState())) {
            messages.add(message("REDUCE_RISK", "RISK", "WARNING", 780, false,
                    mapOf("currentRiskPct", context.currentRiskPct(),
                            "recommendedRiskPct", context.recommendedRiskPct()),
                    List.of("growthCoach.actions.reduceRisk")));
        } else if ("STANDARD".equals(context.riskState()) || "CONSERVATIVE".equals(context.riskState())) {
            messages.add(message("STANDARD_RISK", "RISK", "INFO", 460, false,
                    mapOf("riskPct", context.recommendedRiskPct(), "riskAmount", context.recommendedRiskAmount()),
                    List.of("growthCoach.actions.maintainRisk")));
        }

        if (context.currentLosingStreak() >= 3) {
            messages.add(message("LOSING_STREAK", "STREAK", "WARNING", 800, false,
                    Map.of("lossCount", context.currentLosingStreak()),
                    List.of("growthCoach.actions.reduceRisk", "growthCoach.actions.reviewRecentTrades")));
        }
        if (context.expectancyR() != null && context.expectancyR().compareTo(BigDecimal.ZERO) <= 0) {
            messages.add(message("NEGATIVE_EXPECTANCY", "EXPECTANCY", "WARNING", 720, false,
                    Map.of("expectancyR", context.expectancyR()),
                    List.of("growthCoach.actions.reviewExecution", "growthCoach.actions.doNotChase")));
        } else if (context.expectancyR() != null) {
            messages.add(message("POSITIVE_EXPECTANCY", "EXPECTANCY", "POSITIVE", 430, false,
                    Map.of("expectancyR", context.expectancyR()),
                    List.of("growthCoach.actions.followPlan")));
        }
        if (context.sampleSize() == 0) {
            messages.add(message(context.realisedTradeCount() == 0 ? "NO_CLOSED_TRADES" : "NO_VALID_R_SAMPLE", "NO_DATA", "CAUTION", 850, false,
                    Map.of(), List.of("growthCoach.actions.addTrades")));
        } else if (context.sampleSize() < 20) {
            messages.add(message("LOW_SAMPLE_SIZE", "NO_DATA", "CAUTION", 840, false,
                    Map.of("tradeCount", context.sampleSize()),
                    List.of("growthCoach.actions.addTrades")));
        }
        if (context.inconsistentPnlCount() > 0) {
            messages.add(message("INCONSISTENT_PNL", "DATA_QUALITY", "WARNING", 830, false,
                    Map.of("count", context.inconsistentPnlCount()),
                    List.of("growthCoach.actions.fixData")));
        }
        if (context.costPct() != null && context.costPct().compareTo(new BigDecimal("20")) >= 0) {
            messages.add(message("COSTS_MATERIAL", "COSTS", "CAUTION", 420, false,
                    mapOf("costPct", context.costPct(), "costR", context.costR()),
                    List.of("growthCoach.actions.reviewCosts")));
        }

        Map<String, CoachMessage> deduplicated = new LinkedHashMap<>();
        messages.stream()
                .sorted(Comparator.comparingInt(CoachMessage::priority).reversed())
                .forEach(item -> deduplicated.putIfAbsent(item.key(), item));
        return List.copyOf(deduplicated.values());
    }

    private CoachMessage message(String key,
                                 String category,
                                 String severity,
                                 int priority,
                                 boolean blocking,
                                 Map<String, Object> params,
                                 List<String> actionKeys) {
        String base = "growthCoach.messages." + key;
        return new CoachMessage(
                key,
                category,
                severity,
                priority,
                base + ".title",
                base + ".message",
                actionKeys,
                params,
                Map.of(),
                blocking
        );
    }

    private Map<String, Object> mapOf(Object... entries) {
        Map<String, Object> values = new LinkedHashMap<>();
        for (int index = 0; index + 1 < entries.length; index += 2) {
            if (entries[index + 1] != null) {
                values.put(String.valueOf(entries[index]), entries[index + 1]);
            }
        }
        return values;
    }

    public record Context(
            BigDecimal initialCapital,
            boolean openRiskKnown,
            int openTradeCount,
            int unknownRiskTradeCount,
            String riskState,
            BigDecimal dailyLossRemaining,
            boolean targetReached,
            BigDecimal amountAboveTarget,
            int realisedTradeCount,
            BigDecimal targetPct,
            BigDecimal targetAmount,
            BigDecimal realisedProgressPct,
            BigDecimal expectedCalendarProgressPct,
            String feasibility,
            BigDecimal requiredR,
            int daysRemaining,
            BigDecimal floatingPnl,
            BigDecimal currentRiskPct,
            BigDecimal recommendedRiskPct,
            BigDecimal recommendedRiskAmount,
            int currentLosingStreak,
            BigDecimal expectancyR,
            int sampleSize,
            int inconsistentPnlCount,
            BigDecimal costPct,
            BigDecimal costR
    ) {
    }
}
