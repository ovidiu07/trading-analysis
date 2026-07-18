package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;
import java.math.BigDecimal;

@Value
@Builder
public class BacktestingAnalyticsResponse {
    BacktestingMetricResponse baseline;
    Map<String, List<BacktestingBreakdownRowResponse>> breakdowns;
    List<BacktestingBreakdownRowResponse> impactRows;
    Map<String, BacktestingMetricResponse> sourceMetrics;
    BigDecimal liveExpectancyGap;
    String regressionStatus;
    Integer recentLiveSampleSize;
}
