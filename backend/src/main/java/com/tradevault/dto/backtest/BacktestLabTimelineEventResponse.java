package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;

@Value
@Builder
public class BacktestLabTimelineEventResponse {
    String stage;
    OffsetDateTime timeUtc;
    JsonNode details;
}
