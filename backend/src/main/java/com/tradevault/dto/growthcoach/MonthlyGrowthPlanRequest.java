package com.tradevault.dto.growthcoach;

import com.tradevault.domain.enums.GrowthTargetType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record MonthlyGrowthPlanRequest(
        @NotNull GrowthTargetType targetType,
        @NotNull @Size(max = 40) String targetBasis,
        @DecimalMin("0.00") @DecimalMax("1000.00") BigDecimal targetPct,
        @DecimalMin("0.00") BigDecimal targetAmount,
        @DecimalMin("0.00") BigDecimal targetR,
        @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal plannedRiskPerTradePct,
        @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal hardMaxRiskPerTradePct,
        @Min(0) Integer plannedMaxTradesPerDay,
        @Min(0) Integer plannedMaxTradesPerWeek,
        @DecimalMin("0.00") BigDecimal plannedMinimumRr,
        @Size(max = 240) String changeReason
) {
}
