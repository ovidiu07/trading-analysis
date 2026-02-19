package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class PlanAdherenceSummary {
    private int linkedTrades;
    private int unlinkedTrades;
    private double linkedPct;
    private BigDecimal linkedNetPnl;
    private BigDecimal unlinkedNetPnl;
    private double linkedWinRate;
    private double unlinkedWinRate;
}
