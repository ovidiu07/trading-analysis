package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class BreakdownRow {
    private String name;
    private int trades;
    private BigDecimal netPnl;
    private double winRate;
    private BigDecimal averagePnl;
    private BigDecimal profitFactor;
    private boolean lowSample;
}
