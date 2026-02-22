package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class BacktestDatasetSummaryResponse {
    UUID datasetId;
    String provider;
    String symbolDisplay;
    String symbolCanonical;
    String timeframe;
    OffsetDateTime dataFromUtc;
    OffsetDateTime dataToUtc;
    Long candleCount;
    String timezoneHint;
    OffsetDateTime defaultFromUtc;
    OffsetDateTime defaultToUtc;
    Integer defaultWindowDays;
}
