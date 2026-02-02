package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class DrawdownSummary {
    private BigDecimal maxDrawdown;
    private BigDecimal maxDrawdownPercent;
    private int maxDrawdownDurationTrades;
    private long maxDrawdownDurationDays;
    private BigDecimal recoveryFactor;
    private Double ulcerIndex;
}
