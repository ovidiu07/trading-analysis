package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class DiagnosticsCoreMetrics {
    int sampleSize;
    BigDecimal winRate;
    BigDecimal expectancyR;
    BigDecimal profitFactor;
    BigDecimal avgMaeR;
    BigDecimal avgMfeR;
    BigDecimal avgDurationMinutes;
}
