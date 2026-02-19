package com.tradevault.dto.strategy;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class StrategyResponse {
    UUID id;
    String source;
    String name;
    String model;
    List<String> entryConditions;
    String invalidationLogic;
    String tpFramework;
    String noTradeRules;
    List<String> sessionSuitability;
    List<String> tags;
    boolean archived;
    String slug;
    OffsetDateTime updatedAt;
}
