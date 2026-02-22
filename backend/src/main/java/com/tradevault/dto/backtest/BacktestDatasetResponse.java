package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
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
    String originalFileName;
    JsonNode detectedMappingJson;
    OffsetDateTime createdAt;
    List<String> warnings;
}
