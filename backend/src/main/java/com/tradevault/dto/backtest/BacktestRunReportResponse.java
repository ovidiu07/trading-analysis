package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class BacktestRunReportResponse {
    UUID reportId;
    UUID runId;
    UUID strategyId;
    String strategyNameSnapshot;
    JsonNode strategyConfigSnapshotJson;
    JsonNode filtersSnapshotJson;
    JsonNode summarySnapshotJson;
    JsonNode tradesTimelineSnapshotJson;
    JsonNode recommendationsSnapshotJson;
    String reportMarkdown;
    String reportVersion;
    OffsetDateTime createdAtUtc;
}
