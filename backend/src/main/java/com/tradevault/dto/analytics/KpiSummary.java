package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class KpiSummary {
    private BigDecimal totalPnlGross;
    private BigDecimal totalPnlNet;
    private double winRate;
    private double lossRate;
    private BigDecimal averageWin;
    private BigDecimal averageLoss;
    private BigDecimal expectancy;
    private BigDecimal profitFactor;
    private BigDecimal maxDrawdown;
    private int maxWinStreak;
    private int maxLossStreak;
}
