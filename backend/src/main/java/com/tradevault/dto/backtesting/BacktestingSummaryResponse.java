package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class BacktestingSummaryResponse {
    Integer totalBacktests;
    Integer totalScreenshots;
    Integer totalTradesTested;
    Integer manualTrades;
    Integer importedTrades;
    Integer liveTrades;
    BigDecimal averageWinRate;
    BigDecimal averageExpectancy;
    Integer strategiesNeedingReview;
    String bestPerformer;
}
