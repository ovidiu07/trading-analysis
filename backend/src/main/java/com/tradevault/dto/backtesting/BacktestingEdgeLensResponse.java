package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Value
@Builder
public class BacktestingEdgeLensResponse {
    UUID id;
    UUID workspaceId;
    String name;
    String description;
    Map<String, Object> filterDefinition;
    BacktestingMetricResponse metrics;
    OffsetDateTime recalculatedAt;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
