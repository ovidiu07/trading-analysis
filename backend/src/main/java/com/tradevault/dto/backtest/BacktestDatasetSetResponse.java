package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class BacktestDatasetSetResponse {
    UUID id;
    String instrument;
    String timezoneBasis;
    OffsetDateTime createdAt;
}
