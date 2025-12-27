package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class AnalyticsResponse {
    private KpiSummary kpi;
    private List<TimeSeriesPoint> equityCurve;
    private List<TimeSeriesPoint> groupedPnl;
    private Map<String, Double> breakdown;
}
