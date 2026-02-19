package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class SessionPerformanceRow {
    private String session;
    private int trades;
    private double winRate;
    private BigDecimal expectancy;
    private BigDecimal profitFactor;
    private BigDecimal netPnl;
}
