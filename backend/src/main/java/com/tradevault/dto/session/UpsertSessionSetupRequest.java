package com.tradevault.dto.session;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeSession;
import lombok.Data;

import java.math.BigDecimal;
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
    private Trigger trigger;
    private Execution execution;
    private List<Level> levels;
    private Mentor mentorReference;

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
        private String entryZone;
        private BigDecimal rrEstimate;
        private String notes;
    }

    @Data
    public static class Execution {
        private BigDecimal entryPrice;
        private BigDecimal stopLossPrice;
        private BigDecimal takeProfitPrice;
        private BigDecimal riskAmount;
        private BigDecimal quantity;
        private String invalidation;
        private String whyWrong;
        private String initialNotes;
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
}
