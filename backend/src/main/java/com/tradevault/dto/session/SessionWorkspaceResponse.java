package com.tradevault.dto.session;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.SessionSetupReadinessState;
import com.tradevault.domain.enums.SessionSetupStatus;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.domain.enums.TradeSession;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class SessionWorkspaceResponse {
    SessionSummary session;
    UUID activeSetupId;
    List<SetupItem> setups;
    List<ActivityTrade> activity;

    @Value
    @Builder
    public static class SessionSummary {
        UUID id;
        LocalDate tradingDate;
        String sessionName;
        String objective;
        String bias;
        String biasReason;
        String narrative;
        BigDecimal dailyMaxLoss;
        Integer maxTrades;
        Boolean liveModeOnly;
        OffsetDateTime lockedInAt;
        TodaySessionStatus status;
        QuickStats quickStats;
        Readiness readiness;
        List<String> warnings;
    }

    @Value
    @Builder
    public static class QuickStats {
        BigDecimal maxLoss;
        BigDecimal riskUsed;
        long tradesTaken;
        long activeSetupCount;
        BigDecimal realizedPnl;
    }

    @Value
    @Builder
    public static class Readiness {
        int score;
        SessionSetupReadinessState state;
        String summary;
        List<String> missingItems;
        List<String> blockers;
        List<ReadinessStep> steps;
    }

    @Value
    @Builder
    public static class ReadinessStep {
        String key;
        String label;
        SessionSetupReadinessState state;
        String summary;
        List<String> missingItems;
    }

    @Value
    @Builder
    public static class SetupItem {
        UUID id;
        String symbol;
        Direction direction;
        Market market;
        TradeSession tradeSession;
        UUID strategyId;
        String strategyLabel;
        String setupTitle;
        String biasAlignment;
        SessionSetupStatus status;
        UUID linkedTradeId;
        Readiness readiness;
        SetupContext context;
        SetupStrategySnapshot strategySnapshot;
        SetupTrigger trigger;
        SetupExecution execution;
        SetupExecutionWorkspace executions;
        SetupReview review;
        List<SetupLevel> levels;
        MentorReference mentorReference;
        Integer sortOrder;
        OffsetDateTime executedAt;
        OffsetDateTime invalidatedAt;
        OffsetDateTime skippedAt;
        OffsetDateTime archivedAt;
        OffsetDateTime closedAt;
        OffsetDateTime createdAt;
        OffsetDateTime updatedAt;
    }

    @Value
    @Builder
    public static class SetupContext {
        String narrative;
        String liquidityNotes;
        String invalidationIdea;
        String newsSafety;
        String notes;
    }

    @Value
    @Builder
    public static class SetupTrigger {
        Boolean sweepIdentified;
        Boolean displacementConfirmed;
        Boolean structureConfirmed;
        String confirmationModel;
        String sweepType;
        String liquiditySource;
        String confirmationTimeframe;
        String displacementRule;
        String structureRule;
        String fvgRequirement;
        String entryModel;
        String entryZone;
        BigDecimal rrEstimate;
        BigDecimal rrMinimum;
        String confluenceRequirement;
        String newsRestriction;
        String sessionRestriction;
        String invalidationThreshold;
        String notes;
    }

    @Value
    @Builder
    public static class SetupExecution {
        String activeExecutionId;
        BigDecimal entryPrice;
        BigDecimal stopLossPrice;
        BigDecimal takeProfitPrice;
        BigDecimal riskAmount;
        BigDecimal quantity;
        String invalidation;
        String whyWrong;
        String initialNotes;
    }

    @Value
    @Builder
    public static class SetupExecutionWorkspace {
        String activeExecutionId;
        List<ExecutionTicket> tickets;
    }

    @Value
    @Builder
    public static class ExecutionTicket {
        String id;
        String label;
        String status;
        BigDecimal entryPrice;
        BigDecimal stopLossPrice;
        BigDecimal takeProfitPrice;
        BigDecimal riskAmount;
        BigDecimal quantity;
        String invalidation;
        String whyWrong;
        String initialNotes;
        String notes;
        UUID linkedTradeId;
        OffsetDateTime createdAt;
        OffsetDateTime updatedAt;
        OffsetDateTime startedAt;
        OffsetDateTime closedAt;
    }

    @Value
    @Builder
    public static class SetupStrategySnapshot {
        UUID strategyId;
        String source;
        String name;
        String model;
        String entryConditionsRich;
        List<String> entryConditions;
        String invalidationLogic;
        String tpFramework;
        String noTradeRules;
        List<String> sessionSuitability;
        List<String> tags;
        UUID snapshotAssetId;
        OffsetDateTime importedAt;
        Boolean localEditsApplied;
    }

    @Value
    @Builder
    public static class SetupReview {
        String liveNotes;
        String mistakes;
        String lessons;
        String outcomeSummary;
        List<String> tags;
        List<ReviewTimelineEntry> timeline;
    }

    @Value
    @Builder
    public static class ReviewTimelineEntry {
        String id;
        String type;
        String title;
        String body;
        String executionId;
        UUID tradeId;
        OffsetDateTime occurredAt;
    }

    @Value
    @Builder
    public static class SetupLevel {
        String label;
        BigDecimal price;
        String source;
        String notes;
    }

    @Value
    @Builder
    public static class MentorReference {
        String planTitle;
        String symbol;
        String bias;
        String preferredScenario;
        String invalidation;
        String noTradeWarning;
        List<String> keyLevels;
    }

    @Value
    @Builder
    public static class ActivityTrade {
        UUID tradeId;
        UUID setupId;
        String setupTitle;
        String symbol;
        Direction direction;
        TradeSession tradeSession;
        String status;
        BigDecimal entryPrice;
        BigDecimal exitPrice;
        BigDecimal riskAmount;
        BigDecimal rMultiple;
        BigDecimal pnlNet;
        OffsetDateTime openedAt;
        OffsetDateTime closedAt;
    }
}
