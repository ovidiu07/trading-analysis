package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
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
}
