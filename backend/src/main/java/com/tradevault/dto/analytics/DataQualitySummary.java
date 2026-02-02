package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DataQualitySummary {
    private int missingClosedAtCount;
    private int inconsistentStatusCount;
    private int missingStrategyCount;
    private int missingSetupCount;
    private int missingCatalystCount;
    private int missingPnlPercentCount;
    private int missingRiskCount;
    private String timezoneNote;
}
