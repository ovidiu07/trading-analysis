package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class KpiSummary {
    private BigDecimal totalPnlGross;
    private BigDecimal totalPnlNet;
    private BigDecimal grossProfit;
    private BigDecimal grossLoss;
    private double winRate;
    private double lossRate;
    private BigDecimal averageWin;
    private BigDecimal averageLoss;
    private BigDecimal medianPnl;
    private BigDecimal payoffRatio;
    private BigDecimal expectancy;
    private BigDecimal profitFactor;
    private int totalTrades;
    private int winningTrades;
    private int losingTrades;
    private int flatTrades;
    private int openTrades;
    private int closedTrades;
}
