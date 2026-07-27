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
            OperatingSystem operatingSystem,
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
            String externalReference,
            String eventStatus,
            String planningBehavior,
            UUID reversalEventId,
            OffsetDateTime createdAt
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

    public record OperatingSystem(
            PeriodContext selectedPeriod,
            PlanBundle plans,
            PeriodSummary selectedSummary,
            TodayActivity todayActivity,
            TradingPermission tradingPermission,
            List<PeriodComparison> periodComparisons,
            PlanAdherence planAdherence,
            List<MetricConfidence> metricConfidence,
            List<OperatingChartPoint> chartSeries,
            List<ChartMarker> chartMarkers,
            List<PlanRevision> planHistory
    ) {
    }

    public record PeriodContext(
            String periodType,
            String periodKey,
            LocalDate anchorDate,
            OffsetDateTime startsAt,
            OffsetDateTime endsAtExclusive,
            String timezone
    ) {
    }

    public record PlanBundle(
            PeriodPlan day,
            PeriodPlan week,
            PeriodPlan month
    ) {
    }

    public record PeriodPlan(
            UUID id,
            String periodType,
            String periodKey,
            String timezone,
            String targetType,
            BigDecimal targetValue,
            BigDecimal targetAmount,
            String maxLossType,
            BigDecimal maxLossValue,
            BigDecimal maxLossAmount,
            Integer maxTrades,
            BigDecimal maxRiskBudget,
            Integer maxConsecutiveLosses,
            Integer maxLosingDays,
            Integer maxConsecutiveLosingDays,
            Integer minimumReviewDays,
            BigDecimal defaultRiskPerTrade,
            BigDecimal minimumRr,
            boolean stopAfterTarget,
            boolean reduceRiskAfterTarget,
            BigDecimal riskReductionPct,
            String riskReductionType,
            BigDecimal riskReductionValue,
            BigDecimal riskReductionAfterDrawdownPct,
            BigDecimal maximumDrawdownTolerance,
            Integer plannedTradingDays,
            String withdrawalPolicy,
            String compoundingBehavior,
            boolean stopAfterMaxLoss,
            boolean stopAfterConsecutiveLosses,
            String permittedSessions,
            String focus,
            String notes,
            String allocationMode,
            boolean active,
            int version,
            OffsetDateTime effectiveFrom,
            OffsetDateTime updatedAt
    ) {
    }

    public record PeriodSummary(
            String periodType,
            BigDecimal periodStartBalance,
            BigDecimal realisedTradingPnl,
            BigDecimal realisedPnlPct,
            BigDecimal realisedR,
            BigDecimal netLedgerMovement,
            BigDecimal netAccountChange,
            BigDecimal currentRealisedBalance,
            BigDecimal currentEquity,
            BigDecimal floatingPnl,
            BigDecimal targetAmount,
            BigDecimal targetProgressPct,
            BigDecimal targetRemaining,
            BigDecimal targetExceededAmount,
            BigDecimal distanceToBreakeven,
            BigDecimal distanceToTarget,
            BigDecimal lossLimitUtilisationPct,
            BigDecimal lossAllowanceRemaining,
            int completedTrades,
            int winningTrades,
            int losingTrades,
            BigDecimal winRate,
            BigDecimal averageTrade,
            BigDecimal grossProfit,
            BigDecimal grossLoss,
            BigDecimal riskUsed,
            BigDecimal riskRemaining,
            Integer tradesRemaining,
            int currentConsecutiveLosses,
            BigDecimal maximumDrawdown,
            BigDecimal openRisk
    ) {
    }

    public record TodayActivity(
            PeriodSummary summary,
            int currentlyOpenTrades,
            List<ClosedTradeActivity> closedTrades,
            String tradingPermission
    ) {
    }

    public record ClosedTradeActivity(
            UUID tradeId,
            String symbol,
            String direction,
            OffsetDateTime openedAt,
            OffsetDateTime closedAt,
            BigDecimal pnl,
            BigDecimal realisedR,
            BigDecimal initialRisk,
            String strategy,
            String setup,
            String session
    ) {
    }

    public record TradingPermission(
            String state,
            String primaryReason,
            List<String> secondaryReasons,
            BigDecimal maximumPermittedRisk,
            BigDecimal maximumPermittedRiskPct,
            BigDecimal recommendedRiskWhenTradingResumes,
            BigDecimal recommendedRiskWhenTradingResumesPct,
            BigDecimal theoreticalMaximumRisk,
            BigDecimal theoreticalMaximumRiskPct,
            Integer remainingTrades,
            String applicableLimit,
            String recommendedAction
    ) {
    }

    public record PeriodComparison(
            String periodType,
            BigDecimal realisedPnl,
            BigDecimal realisedPct,
            BigDecimal realisedR,
            BigDecimal target,
            BigDecimal targetProgress,
            int trades,
            BigDecimal winRate,
            BigDecimal averageTrade,
            BigDecimal riskUsed,
            BigDecimal riskRemaining,
            BigDecimal drawdown,
            int adherenceScore,
            int adherenceCoverage,
            String periodStatus
    ) {
    }

    public record PlanAdherence(
            int score,
            int passedRules,
            int failedRules,
            int unavailableRules,
            int evaluationCoverage,
            String confidence,
            List<String> passed,
            List<String> failed,
            List<String> unavailable
    ) {
    }

    public record MetricConfidence(
            String metric,
            String status,
            int score,
            String reason,
            int missingDataCount,
            List<String> affectedMetrics,
            String action
    ) {
    }

    public record OperatingChartPoint(
            LocalDate date,
            BigDecimal cumulativeTradingPnl,
            BigDecimal dailyTradingPnl,
            BigDecimal cumulativeR,
            BigDecimal dailyR,
            BigDecimal realisedBalance,
            BigDecimal equity,
            BigDecimal plannedProgress,
            BigDecimal target,
            BigDecimal maximumLoss,
            BigDecimal drawdownLimit,
            BigDecimal cumulativeRisk
    ) {
    }

    public record ChartMarker(
            String id,
            String type,
            OffsetDateTime timestamp,
            BigDecimal amount,
            String label,
            UUID tradeId,
            UUID ledgerEventId
    ) {
    }

    public record PlanRevision(
            UUID id,
            String periodType,
            String periodKey,
            int version,
            String reason,
            OffsetDateTime changedAt
    ) {
    }
}
