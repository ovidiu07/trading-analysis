package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class BacktestLabSummaryResponse {
    int sampleSize;
    BigDecimal winRate;
    BigDecimal expectancyR;
    BigDecimal avgR;
    BigDecimal avgMaeR;
    BigDecimal avgMfeR;
    BigDecimal fillRate;
    BigDecimal avgDurationSec;
}
