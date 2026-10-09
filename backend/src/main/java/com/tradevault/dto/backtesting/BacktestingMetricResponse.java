package com.tradevault.dto.backtesting;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.Map;

@Value
@Builder
public class BacktestingMetricResponse {
    @Getter(onMethod_ = @JsonProperty("rSampleSize"))
    Integer rSampleSize;
    Map<String, BacktestingCurrencyMetricResponse> currencyMetrics;
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
    BigDecimal medianR;
    BigDecimal maximumDrawdownR;
    Integer maximumLosingStreak;
    Integer currentLosingStreak;
    String sampleQuality;
}
