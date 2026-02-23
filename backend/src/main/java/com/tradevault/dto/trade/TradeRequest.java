package com.tradevault.dto.trade;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeGrade;
import com.tradevault.domain.enums.TradeSession;
import com.tradevault.domain.enums.TradeStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

@Data
public class TradeRequest {
    @NotBlank
    private String symbol;
    @NotNull
    private Market market;
    @NotNull
    private Direction direction;
    @NotNull
    private TradeStatus status;
    @NotNull
    private OffsetDateTime openedAt;
    private OffsetDateTime closedAt;
    @NotNull
    private BigDecimal quantity;
    @NotNull
    private BigDecimal entryPrice;
    private BigDecimal exitPrice;
    private BigDecimal stopLossPrice;
    private BigDecimal takeProfitPrice;
    private BigDecimal fees = BigDecimal.ZERO;
    private BigDecimal feesProfileCurrency;
    private BigDecimal commission = BigDecimal.ZERO;
    private BigDecimal slippage = BigDecimal.ZERO;
    private String tradeCurrency;
    private String profileCurrency;
    private BigDecimal fxRateTradeToProfile;
    private OffsetDateTime fxRateTimestamp;
    private String fxRateSource;
    private BigDecimal pnlProfileCurrency;
    private BigDecimal riskAmount;
    private BigDecimal capitalUsed;
    private String timeframe;
    private String setup;
    private String strategyTag;
    private String catalystTag;
    private UUID strategyId;
    private UUID strategyVersionId;
    private UUID contextSnapshotId;
    private TradeGrade setupGrade;
    private Set<String> ruleBreaks;
    private TradeSession session;
    private UUID sessionId;
    private UUID sweepLevelId;
    private UUID sweepPoolId;
    private UUID entryLevelId;
    private UUID slLevelId;
    private UUID tpLevelId;
    private JsonNode narrativeSnapshotJson;
    private Boolean sweepConfirmed;
    private Boolean displacementConfirmed;
    private Boolean mssConfirmed;
    private BigDecimal sweepDepthPoints;
    private BigDecimal displacementSizePoints;
    private Integer timeSweepToEntrySeconds;
    private BigDecimal mfePoints;
    private BigDecimal maePoints;
    private Boolean levelExpectationMet;
    private String levelExpectation;
    private String feeling;
    private Set<UUID> linkedContentIds;
    private Set<UUID> linkedPlanIds;
    private String notes;
    private String initialNotes;
    private String entryJournalText;
    private String entryInvalidation;
    private Set<UUID> entryScreenshotAssetIds;
    private UUID accountId;
    private Set<UUID> tagIds;
}
