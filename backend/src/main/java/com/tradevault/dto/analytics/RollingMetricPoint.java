package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class RollingMetricPoint {
    private LocalDate date;
    private double winRate;
    private BigDecimal profitFactor;
    private BigDecimal expectancy;
    private BigDecimal averagePnl;
}
