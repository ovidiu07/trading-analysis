package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class DiagnosticsCoreMetrics {
    int sampleSize;
    int rSampleSize;
    int missingRCount;
    String rUnavailableReason;
    int monetarySampleSize;
    int missingMonetaryCount;
    String rProfitFactorUnavailableReason;
    String monetaryProfitFactorUnavailableReason;
    BigDecimal monetaryWinRate;
    BigDecimal monetaryExpectancy;
    BigDecimal monetaryProfitFactor;
    String monetaryCurrency;
    String monetaryUnavailableReason;
    BigDecimal winRate;
    BigDecimal expectancyR;
    BigDecimal profitFactor;
    BigDecimal avgMaeR;
    BigDecimal avgMfeR;
    BigDecimal avgDurationMinutes;
}
