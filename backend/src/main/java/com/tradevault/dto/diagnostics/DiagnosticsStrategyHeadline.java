package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.UUID;

@Value
@Builder
public class DiagnosticsStrategyHeadline {
    UUID strategyId;
    String strategyName;
    int sampleSize;
    BigDecimal winRate;
    BigDecimal expectancyR;
    BigDecimal profitFactor;
}
