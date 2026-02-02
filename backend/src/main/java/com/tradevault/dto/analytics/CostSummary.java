package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class CostSummary {
    private BigDecimal totalFees;
    private BigDecimal totalCommission;
    private BigDecimal totalSlippage;
    private BigDecimal totalCosts;
    private BigDecimal avgFees;
    private BigDecimal avgCommission;
    private BigDecimal avgSlippage;
    private BigDecimal avgCosts;
    private BigDecimal netVsGrossDelta;
}
