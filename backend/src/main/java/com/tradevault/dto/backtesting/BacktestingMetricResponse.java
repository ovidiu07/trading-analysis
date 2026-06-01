package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class BacktestingMetricResponse {
    Integer trades;
    Integer wins;
    Integer losses;
    Integer breakevens;
    BigDecimal winRate;
    BigDecimal lossRate;
    BigDecimal breakevenRate;
    BigDecimal totalR;
    BigDecimal averageR;
    BigDecimal expectancy;
    BigDecimal profitFactor;
    BigDecimal averageWinR;
    BigDecimal averageLossR;
    BigDecimal largestWinR;
    BigDecimal largestLossR;
    String sampleQuality;
}
