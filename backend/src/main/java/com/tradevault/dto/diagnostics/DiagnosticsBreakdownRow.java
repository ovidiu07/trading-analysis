package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class DiagnosticsBreakdownRow {
    String key;
    int sampleSize;
    int rSampleSize;
    BigDecimal winRate;
    BigDecimal expectancyR;
}
