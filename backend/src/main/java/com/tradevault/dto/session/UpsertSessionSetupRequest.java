package com.tradevault.dto.session;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeSession;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class UpsertSessionSetupRequest {
    private String symbol;
    private Direction direction;
    private Market market;
    private TradeSession tradeSession;
    private UUID strategyId;
    private String strategyLabel;
    private String setupTitle;
    private String biasAlignment;
    private Context context;
    private StrategySnapshot strategySnapshot;
    private Trigger trigger;
    private Execution execution;
    private Review review;
    private List<Level> levels;
    private Mentor mentorReference;
    private List<Confluence> confluences;
    private Boolean manualSetupMode;

    @Data
    public static class Context {
        private String narrative;
        private String liquidityNotes;
        private String invalidationIdea;
        private String newsSafety;
        private String notes;
    }

    @Data
    public static class Trigger {
        private Boolean sweepIdentified;
        private Boolean displacementConfirmed;
        private Boolean structureConfirmed;
        private String confirmationModel;
        private String sweepType;
        private String liquiditySource;
        private String confirmationTimeframe;
        private String displacementRule;
        private String structureRule;
        private String fvgRequirement;
        private String entryModel;
        private String entryZone;
        private BigDecimal rrEstimate;
        private BigDecimal rrMinimum;
        private String confluenceRequirement;
        private String newsRestriction;
        private String sessionRestriction;
        private String invalidationThreshold;
        private String notes;
    }

    @Data
    public static class Execution {
        private String activeExecutionId;
        private BigDecimal entryPrice;
        private BigDecimal stopLossPrice;
        private BigDecimal takeProfitPrice;
        private BigDecimal riskAmount;
        private BigDecimal quantity;
        private String invalidation;
        private String whyWrong;
        private String initialNotes;
        private List<Ticket> tickets;
    }

    @Data
    public static class Ticket {
        private String id;
        private String label;
        private String status;
        private BigDecimal entryPrice;
        private BigDecimal stopLossPrice;
        private BigDecimal takeProfitPrice;
        private BigDecimal riskAmount;
        private BigDecimal quantity;
        private String invalidation;
        private String whyWrong;
        private String initialNotes;
        private String notes;
        private UUID linkedTradeId;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
        private OffsetDateTime startedAt;
        private OffsetDateTime closedAt;
    }

    @Data
    public static class StrategySnapshot {
        private UUID strategyId;
        private String source;
        private String name;
        private String model;
        private String entryConditionsRich;
        private List<String> entryConditions;
        private String invalidationLogic;
        private String tpFramework;
        private String noTradeRules;
        private List<String> sessionSuitability;
        private List<String> tags;
        private UUID snapshotAssetId;
        private OffsetDateTime importedAt;
        private Boolean localEditsApplied;
    }

    @Data
    public static class Review {
        private String liveNotes;
        private String mistakes;
        private String lessons;
        private String outcomeSummary;
        private List<String> tags;
        private List<TimelineEntry> timeline;
    }

    @Data
    public static class TimelineEntry {
        private String id;
        private String type;
        private String title;
        private String body;
        private String executionId;
        private UUID tradeId;
        private OffsetDateTime occurredAt;
    }

    @Data
    public static class Level {
        private String label;
        private BigDecimal price;
        private String source;
        private String notes;
    }

    @Data
    public static class Mentor {
        private String planTitle;
        private String symbol;
        private String bias;
        private String preferredScenario;
        private String invalidation;
        private String noTradeWarning;
        private List<String> keyLevels;
    }

    @Data
    public static class Confluence {
        private String id;
        private String label;
        private Boolean checked;
        private Boolean required;
        private String source;
    }
}
