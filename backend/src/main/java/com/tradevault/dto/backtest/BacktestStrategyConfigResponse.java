package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class BacktestStrategyConfigResponse {
    UUID id;
    UUID datasetSetId;
    String name;
    JsonNode configJson;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
