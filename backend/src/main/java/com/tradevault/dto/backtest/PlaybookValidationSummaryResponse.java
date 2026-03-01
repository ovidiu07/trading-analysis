package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class PlaybookValidationSummaryResponse {
    BigDecimal winRate;
    BigDecimal expectancyR;
    BigDecimal profitFactor;
    Integer sampleSize;
    BigDecimal maxDrawdownR;
    BigDecimal fillRate;
    String confidence;
    String validationSplit;
}
