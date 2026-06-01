package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.Map;

@Value
@Builder
public class BacktestingBreakdownRowResponse {
    String dimension;
    String label;
    Map<String, Object> filters;
    BacktestingMetricResponse metrics;
    BigDecimal expectancyDelta;
    BigDecimal totalRDelta;
    String verdict;
    String warning;
}
