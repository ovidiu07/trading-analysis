package com.tradevault.dto.growthcoach;

import com.tradevault.domain.enums.GrowthTargetType;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record PeriodPlanRequest(
        @NotNull GrowthTargetType targetType,
        @NotNull @DecimalMin("0.00") BigDecimal targetValue,
        @NotNull @Pattern(regexp = "FIXED_AMOUNT|PERCENTAGE|R_MULTIPLE") String maxLossType,
        @DecimalMin("0.00") BigDecimal maxLossValue,
        @Min(1) Integer maxTrades,
        @DecimalMin("0.00") BigDecimal maxRiskBudget,
        @Min(1) Integer maxConsecutiveLosses,
        @Min(1) Integer maxLosingDays,
        @DecimalMin("0.00") BigDecimal defaultRiskPerTrade,
        @DecimalMin("0.00") BigDecimal minimumRr,
        boolean stopAfterTarget,
        boolean reduceRiskAfterTarget,
        @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal riskReductionPct,
        boolean stopAfterMaxLoss,
        boolean stopAfterConsecutiveLosses,
        @Size(max = 240) String permittedSessions,
        @Size(max = 240) String focus,
        @Size(max = 4000) String notes,
        @NotNull @Pattern(regexp = "MANUAL|AUTOMATIC") String allocationMode,
        boolean active,
        @NotBlank @Size(max = 240) String changeReason
) {
}

