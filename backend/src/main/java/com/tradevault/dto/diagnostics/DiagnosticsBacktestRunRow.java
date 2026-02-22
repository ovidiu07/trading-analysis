package com.tradevault.dto.diagnostics;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class DiagnosticsBacktestRunRow {
    UUID runId;
    String symbol;
    String timeframe;
    OffsetDateTime from;
    OffsetDateTime to;
    int tradesCount;
    BigDecimal expectancyR;
}
