package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestLabRunResultsResponse {
    UUID runId;
    String status;
    String strategyName;
    OffsetDateTime createdAt;
    OffsetDateTime completedAt;
    BacktestLabSummaryResponse summary;
    List<BacktestLabTradeResultResponse> trades;
}
