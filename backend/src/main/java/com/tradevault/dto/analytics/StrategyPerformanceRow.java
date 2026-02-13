package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class StrategyPerformanceRow {
    private String strategy;
    private String market;
    private int trades;
    private double winRate;
    private BigDecimal expectancy;
    private BigDecimal profitFactor;
    private BigDecimal netPnl;
    private boolean lowSample;
}
