package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class BacktestingWorkspaceResponse {
    UUID id;
    String symbol;
    String marketType;
    UUID strategyId;
    String strategyNameSnapshot;
    String strategyName;
    String title;
    String primaryTimeframe;
    String contextTimeframe;
    String executionTimeframe;
    String entryTimeframe;
    Integer numberOfTrades;
    Integer winningTrades;
    Integer losingTrades;
    Integer breakevenTrades;
    BigDecimal averageR;
    BigDecimal totalR;
    BigDecimal expectancy;
    BigDecimal profitFactor;
    BigDecimal averageWinR;
    BigDecimal averageLossR;
    BigDecimal largestWinR;
    BigDecimal largestLossR;
    BigDecimal winRate;
    BigDecimal lossRate;
    BigDecimal breakevenRate;
    Integer categorizedTrades;
    Integer missingClassificationCount;
    Integer structuredTradeCount;
    String statsSource;
    String sampleQuality;
    String bestEdgeLensName;
    Integer screenshotCount;
    String notes;
    String whatWorked;
    String whatFailed;
    String bestConditions;
    String avoidConditions;
    String status;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
    BacktestingStrategySummaryResponse strategy;
}
