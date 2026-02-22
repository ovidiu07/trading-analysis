package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestDatasetResponse {
    UUID id;
    String provider;
    String sourceId;
    String name;
    String symbolCanonical;
    String symbolDisplay;
    String timeframe;
    OffsetDateTime dataFrom;
    OffsetDateTime dataTo;
    int rowCount;
    List<String> warnings;
}
