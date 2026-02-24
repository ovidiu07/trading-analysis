package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class DiagnosticsReportRow {
    UUID reportId;
    UUID runId;
    UUID strategyId;
    String strategyName;
    String instrument;
    String timeframe;
    String sessionFilter;
    int sampleSize;
    BigDecimal winRate;
    BigDecimal expectancyR;
    OffsetDateTime createdAt;
}
