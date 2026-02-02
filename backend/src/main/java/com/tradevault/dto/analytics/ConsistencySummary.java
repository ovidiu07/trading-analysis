package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ConsistencySummary {
    private int greenWeeks;
    private int redWeeks;
    private TimeSeriesPoint bestDay;
    private TimeSeriesPoint worstDay;
    private TimeSeriesPoint bestWeek;
    private TimeSeriesPoint worstWeek;
    private StreakSummary streaks;
}
