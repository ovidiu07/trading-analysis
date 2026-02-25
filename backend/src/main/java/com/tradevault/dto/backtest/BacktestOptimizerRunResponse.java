package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestOptimizerRunResponse {
    UUID optimizerRunId;
    String status;
    Integer variantCount;
    Integer maxVariants;
    Boolean truncated;
    OffsetDateTime createdAtUtc;
    JsonNode summary;
    List<BacktestOptimizerVariantResultResponse> variants;
}
