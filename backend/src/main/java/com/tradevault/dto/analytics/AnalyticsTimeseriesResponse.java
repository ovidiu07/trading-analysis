package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AnalyticsTimeseriesResponse {
    private List<TimeSeriesPoint> equityCurve;
    private List<TimeSeriesPoint> groupedPnl;
    private List<TimeSeriesPoint> drawdownSeries;
    private List<TimeSeriesPoint> weeklyPnl;
    private List<RollingMetricPoint> rolling;
}
