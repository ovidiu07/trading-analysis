package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class BacktestPlaybookResponse {
    UUID playbookId;
    UUID runId;
    UUID datasetSetId;
    UUID strategyConfigId;
    String name;
    String templateFamily;
    String status;
    BigDecimal expectedWinRate;
    BigDecimal expectancyR;
    BigDecimal profitFactor;
    BigDecimal maxDrawdownR;
    Integer sampleSize;
    JsonNode playbook;
    PlaybookValidationSummaryResponse validationSummary;
    OffsetDateTime createdAtUtc;
    OffsetDateTime updatedAtUtc;
}
