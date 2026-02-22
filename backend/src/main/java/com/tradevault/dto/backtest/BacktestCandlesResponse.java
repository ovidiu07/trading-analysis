package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestCandlesResponse {
    String provider;
    String sourceId;
    UUID datasetId;
    String symbol;
    String timeframe;
    OffsetDateTime effectiveFromUtc;
    OffsetDateTime effectiveToUtc;
    int count;
    OffsetDateTime from;
    OffsetDateTime to;
    int candleCount;
    String message;
    List<BacktestCandleDto> candles;
}
