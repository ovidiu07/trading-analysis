package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class RiskSummary {
    private boolean available;
    private BigDecimal averageR;
    private BigDecimal medianR;
    private BigDecimal expectancyR;
    private double winRateR;
    private BigDecimal averageRiskAmount;
    private BigDecimal averageRiskPercent;
    private List<HistogramBucket> rDistribution;
    private int tradesWithRisk;
}
