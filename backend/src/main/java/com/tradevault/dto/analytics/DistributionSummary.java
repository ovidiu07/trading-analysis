package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class DistributionSummary {
    private Double standardDeviation;
    private BigDecimal p10;
    private BigDecimal p25;
    private BigDecimal p50;
    private BigDecimal p75;
    private BigDecimal p90;
    private List<HistogramBucket> pnlHistogram;
    private BigDecimal outlierLower;
    private BigDecimal outlierUpper;
    private int outlierCount;
}
