package com.tradevault.dto.growthcoach;

import com.tradevault.dto.analytics.AnalyticsResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record GrowthCoachResponse(
        String mode,
        OffsetDateTime generatedAt,
        boolean requiresAccountSelection,
        List<PortfolioAccount> portfolioAccounts,
        Detail detail
) {
    public record PortfolioAccount(
            UUID accountId,
            String accountName,
            String accountType,
            String currency,
            BigDecimal realisedBalance,
            BigDecimal currentEquity,
            BigDecimal currentMonthRealisedPnl,
            BigDecimal floatingPnl,
            Integer openTradeCount,
            String riskState,
            String confidenceLevel
    ) {
    }

    public record Detail(
            AccountInfo account,
            GrowthProfile profile,
            MonthlyPlan monthlyPlan,
            CapitalSummary capital,
            TargetSummary target,
            AnalyticsResponse realisedPerformance,
            OpenExposure openExposure,
            RiskPlan riskPlan,
            Feasibility feasibility,
            Projection projection,
            Confidence confidence,
            List<CoachMessage> coachMessages,
            List<Scenario> scenarios,
            PerformanceDrivers performanceDrivers,
            DataQuality dataQuality,
            List<LedgerEvent> ledgerEvents,
            List<ProgressPoint> progressSeries,
            String disclaimer
    ) {
    }

    public record AccountInfo(
            UUID id,
            String name,
            String broker,
            String type,
            String currency,
            String timezone
    ) {
    }

    public record GrowthProfile(
            UUID id,
            String accountType,
            BigDecimal initialCapital,
            String capitalSource,
            BigDecimal defaultRiskPerTradePct,
            BigDecimal preferredMaxRiskPerTradePct,
            BigDecimal maxConcurrentRiskPct,
            BigDecimal maxDailyRiskPct,
            BigDecimal maxDailyLossAmount,
            BigDecimal maxTotalDrawdownPct,
            BigDecimal maxTotalDrawdownAmount,
            String drawdownType,
            BigDecimal monthlyTargetPct,
            boolean compoundsMonthly,
            BigDecimal profitTargetPct,
            BigDecimal profitTargetAmount,
            Integer minimumTradingDays,
            LocalDate challengeDeadline,
            String consistencyRuleType,
            BigDecimal consistencyRuleValue,
            boolean trailingDrawdownEnabled,
            String trailingDrawdownType,
            BigDecimal trailingDrawdownAmount,
            BigDecimal trailingDrawdownHighWaterMark,
            Integer contractLimit,
            String scalingRestrictions,
            BigDecimal profitSplitPct,
            BigDecimal payoutThreshold,
            String payoutFrequency,
            String payoutEligibilityRules,
            String resetDetails,
            OffsetDateTime updatedAt
    ) {
    }

    public record MonthlyPlan(
            UUID id,
            String monthKey,
            String timezone,
            BigDecimal monthStartBalance,
            BigDecimal monthStartEquity,
            String targetType,
            String targetBasis,
            BigDecimal targetPct,
            BigDecimal targetAmount,
            BigDecimal targetR,
            BigDecimal plannedRiskPerTradePct,
            BigDecimal hardMaxRiskPerTradePct,
            Integer plannedMaxTradesPerDay,
            Integer plannedMaxTradesPerWeek,
            BigDecimal plannedMinimumRr,
            String snapshotSource,
            OffsetDateTime snapshotLockedAt,
            BigDecimal snapshotAdjustmentAmount,
            String snapshotAdjustmentNote,
            OffsetDateTime targetChangedAt
    ) {
    }

    public record CapitalSummary(
            BigDecimal initialCapital,
            BigDecimal ledgerNet,
            BigDecimal lifetimeRealisedTradePnl,
            BigDecimal currentRealisedBalance,
            BigDecimal currentFloatingPnl,
            BigDecimal currentEquity,
            BigDecimal withdrawableProfit,
            BigDecimal profitAfterSplit,
            BigDecimal drawdownBuffer,
            BigDecimal dailyLossRemaining,
            BigDecimal totalLossRemaining,
            BigDecimal profitTargetRemaining,
            boolean floatingPnlAvailable,
            String riskReference
    ) {
    }

    public record TargetSummary(
            BigDecimal targetAmount,
            BigDecimal realisedCurrentMonthPnl,
            BigDecimal floatingPnl,
            BigDecimal realisedProgressPct,
            BigDecimal equityAdjustedProgressPct,
            BigDecimal remainingTargetAmount,
            BigDecimal equityAdjustedRemainingAmount,
            BigDecimal requiredR,
            int tradingDaysRemaining,
            boolean targetReached
    ) {
    }

    public record OpenExposure(
            int openTradeCount,
            BigDecimal totalFloatingPnl,
            boolean floatingPnlAvailable,
            BigDecimal grossLongExposure,
            BigDecimal grossShortExposure,
            BigDecimal netExposure,
            BigDecimal totalOpenRisk,
            boolean openRiskKnown,
            BigDecimal openRiskPct,
            BigDecimal openReward,
            int tradesWithoutStop,
            int tradesWithoutQuantity,
            int tradesWithoutEntryPrice,
            int tradesWithoutReliablePrice,
            String concentratedSymbol,
            BigDecimal concentrationPct,
            List<OpenTrade> trades
    ) {
    }

    public record OpenTrade(
            UUID tradeId,
            String symbol,
            String direction,
            BigDecimal entryPrice,
            BigDecimal currentPrice,
            OffsetDateTime priceTimestamp,
            boolean priceStale,
            BigDecimal quantity,
            BigDecimal stopLoss,
            BigDecimal takeProfit,
            BigDecimal floatingPnl,
            BigDecimal openRisk,
            BigDecimal plannedRr,
            BigDecimal currentR,
            BigDecimal notionalExposure,
            long ageMinutes,
            String strategy,
            String setup,
            List<String> warnings
    ) {
    }

    public record RiskPlan(
            String state,
            BigDecimal recommendedRiskAmount,
            BigDecimal recommendedRiskPct,
            BigDecimal maximumPermittedRiskAmount,
            BigDecimal maximumPermittedRiskPct,
            BigDecimal capByDailyLimit,
            BigDecimal capByDrawdown,
            BigDecimal capByOpenExposure,
            List<String> reasons,
            List<String> stopConditions
    ) {
    }

    public record Feasibility(
            String classification,
            List<String> reasonKeys,
            Map<String, Object> reasonParams
    ) {
    }

    public record Projection(
            boolean available,
            String dataset,
            int sampleSize,
            Integer simulationCount,
            BigDecimal expectancyR,
            BigDecimal expectancyMoney,
            BigDecimal expectedTradesLow,
            BigDecimal expectedTradesBase,
            BigDecimal expectedTradesHigh,
            BigDecimal expectedTradingDaysLow,
            BigDecimal expectedTradingDaysBase,
            BigDecimal expectedTradingDaysHigh,
            BigDecimal probabilityTargetBeforeMonthEnd,
            BigDecimal probabilityProfitableBelowTarget,
            BigDecimal probabilityFinishNegative,
            BigDecimal probabilityDrawdownFirst,
            BigDecimal probabilityRuleBreach,
            String unavailableReasonKey
    ) {
    }

    public record Confidence(
            String level,
            int score,
            List<String> reasonKeys,
            Map<String, Object> reasonParams
    ) {
    }

    public record CoachMessage(
            String key,
            String category,
            String severity,
            int priority,
            String titleKey,
            String messageKey,
            List<String> actionKeys,
            Map<String, Object> params,
            Map<String, Object> evidence,
            boolean blocking
    ) {
    }

    public record Scenario(
            String key,
            BigDecimal riskPct,
            BigDecimal riskAmount,
            BigDecimal estimatedDays,
            BigDecimal targetProbability,
            BigDecimal drawdownProbability,
            boolean recommended,
            boolean available,
            String warningKey
    ) {
    }

    public record PerformanceDrivers(
            Driver strongestStrategy,
            Driver weakestStrategy,
            Driver strongestSession,
            Driver weakestSession,
            Driver strongestSymbol,
            Driver weakestSymbol,
            Driver strongestRrBucket,
            BigDecimal costPctOfGrossProfit,
            BigDecimal costPerTrade
    ) {
    }

    public record Driver(
            String name,
            int sampleSize,
            BigDecimal expectancy,
            BigDecimal expectancyR,
            String confidence
    ) {
    }

    public record DataQuality(
            int validClosedTrades,
            int missingCloseTime,
            int missingPnl,
            int inconsistentPnl,
            int missingRisk,
            int missingStop,
            int missingQuantity,
            int missingStrategy,
            int missingSetup,
            boolean reconstructedCapital,
            List<UUID> affectedTradeIds
    ) {
    }

    public record LedgerEvent(
            UUID id,
            String eventType,
            BigDecimal amount,
            String currency,
            OffsetDateTime eventTime,
            String description,
            String externalReference
    ) {
    }

    public record ProgressPoint(
            LocalDate date,
            BigDecimal realisedBalance,
            BigDecimal targetBalance,
            BigDecimal plannedBalance,
            BigDecimal drawdownBoundary
    ) {
    }
}
