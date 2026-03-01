package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Value
@Builder
public class BacktestCandidateSetupResponse {
    UUID candidateId;
    UUID runId;
    UUID tradeId;
    String symbol;
    String sessionName;
    String setupTemplate;
    String state;
    Instant candidateTimeUtc;
    BigDecimal confidenceScore;
    String qualityLabel;
    String storySummary;
    String qualifiedReason;
    String failedReason;
    JsonNode pool;
    JsonNode sweep;
    JsonNode displacement;
    JsonNode structure;
    JsonNode entry;
    JsonNode evidence;
}
