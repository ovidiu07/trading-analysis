package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestDatasetFileResponse {
    UUID datasetId;
    String timeframe;
    String originalFilename;
    OffsetDateTime minTimeUtc;
    OffsetDateTime maxTimeUtc;
    int candleCount;
    String columnsMapped;
    String status;
    boolean runnable;
    int minRequiredCandles;
    String errorMsg;
    List<BacktestDatasetValidationIssueResponse> warnings;
    List<BacktestDatasetValidationIssueResponse> fatalErrors;
}
