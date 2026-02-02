package com.tradevault.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CoachDataQuality {
    private int totalTrades;
    private int closedTrades;
    private int missingClosedAtCount;
    private int missingPnlNetCount;
    private int missingEntryExitCount;
    private int inconsistentPnlCount;
}
