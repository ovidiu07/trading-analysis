package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class BacktestOptimizerVariantResultResponse {
    int rank;
    JsonNode params;
    Integer trades;
    Integer sampleSize;
    BigDecimal winRate;
    BigDecimal profitFactor;
    BigDecimal expectancyR;
    BigDecimal avgR;
    BigDecimal maxDdR;
    BigDecimal fillRate;
    BigDecimal avgMaeR;
    BigDecimal avgMfeR;
    BigDecimal avgDurationSec;
    String confidenceNote;
}
