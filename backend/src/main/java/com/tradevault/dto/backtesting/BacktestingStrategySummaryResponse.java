package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestingStrategySummaryResponse {
    UUID id;
    String name;
    String model;
    List<String> entryConditions;
    String invalidationLogic;
    String tpFramework;
    String noTradeRules;
}
