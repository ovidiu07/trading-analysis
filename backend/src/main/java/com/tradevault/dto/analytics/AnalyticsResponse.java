package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class AnalyticsResponse {
    private KpiSummary kpi;
    private CostSummary costs;
    private DrawdownSummary drawdown;
    private DistributionSummary distribution;
    private ConsistencySummary consistency;
    private TimeEdgeSummary timeEdge;
    private AttributionSummary attribution;
    private RiskSummary risk;
    private DataQualitySummary dataQuality;
    private TraderReadSummary traderRead;
    private FilterOptions filterOptions;
    private List<TimeSeriesPoint> equityCurve;
    private List<TimeSeriesPoint> groupedPnl;
    private List<TimeSeriesPoint> drawdownSeries;
    private List<TimeSeriesPoint> weeklyPnl;
    private List<RollingMetricPoint> rolling20;
    private List<RollingMetricPoint> rolling50;
    private Map<String, Double> breakdown;
}
