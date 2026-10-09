package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;
import java.math.BigDecimal;

@Value
@Builder
public class BacktestingCurrencyMetricResponse {
    String currency;
    Integer trades;
    BigDecimal netPnl;
    BigDecimal grossProfit;
    BigDecimal grossLoss;
    BigDecimal expectancy;
    BigDecimal profitFactor;
    BigDecimal averageWinner;
    BigDecimal averageLoser;
    BigDecimal largestWinner;
    BigDecimal largestLoser;
    BigDecimal maximumDrawdown;
    BigDecimal commission;
    BigDecimal averageHoldingMinutes;
    BigDecimal averageDurationBars;
    BigDecimal averageFavorableExcursion;
    BigDecimal averageAdverseExcursion;
}
