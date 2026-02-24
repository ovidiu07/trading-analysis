package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestLabRunResponse {
    UUID runId;
    String status;
    String symbol;
    String timeframe;
    OffsetDateTime fromUtc;
    OffsetDateTime toUtc;
    OffsetDateTime createdAt;
    OffsetDateTime completedAt;
    String errorMsg;
    OffsetDateTime datasetMinUtc;
    OffsetDateTime datasetMaxUtc;
    OffsetDateTime requestedFromUtc;
    OffsetDateTime requestedToUtc;
    OffsetDateTime effectiveFromUtc;
    OffsetDateTime effectiveToUtc;
    Integer candleCountInRange;
    Integer minRequiredCandles;
    List<String> warnings;
}
