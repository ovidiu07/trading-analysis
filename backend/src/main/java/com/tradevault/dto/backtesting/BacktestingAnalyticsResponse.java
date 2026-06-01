package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value
@Builder
public class BacktestingAnalyticsResponse {
    BacktestingMetricResponse baseline;
    Map<String, List<BacktestingBreakdownRowResponse>> breakdowns;
    List<BacktestingBreakdownRowResponse> impactRows;
}
