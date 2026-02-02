package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StreakSummary {
    private int maxWinStreak;
    private int maxLossStreak;
    private String currentStreakType;
    private int currentStreakCount;
}
