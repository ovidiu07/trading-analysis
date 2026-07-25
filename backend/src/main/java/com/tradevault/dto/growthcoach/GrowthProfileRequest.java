package com.tradevault.dto.growthcoach;

import com.tradevault.domain.enums.CapitalSource;
import com.tradevault.domain.enums.DrawdownType;
import com.tradevault.domain.enums.GrowthAccountType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record GrowthProfileRequest(
        @NotNull GrowthAccountType accountType,
        @DecimalMin("0.00") BigDecimal initialCapital,
        @NotNull CapitalSource capitalSource,
        @NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal defaultRiskPerTradePct,
        @NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal preferredMaxRiskPerTradePct,
        @NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal maxConcurrentRiskPct,
        @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal maxDailyRiskPct,
        @DecimalMin("0.00") BigDecimal maxDailyLossAmount,
        @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal maxTotalDrawdownPct,
        @DecimalMin("0.00") BigDecimal maxTotalDrawdownAmount,
        @NotNull DrawdownType drawdownType,
        @NotNull @DecimalMin("0.00") @DecimalMax("1000.00") BigDecimal monthlyTargetPct,
        boolean compoundsMonthly,
        @DecimalMin("0.00") @DecimalMax("1000.00") BigDecimal profitTargetPct,
        @DecimalMin("0.00") BigDecimal profitTargetAmount,
        @Min(0) Integer minimumTradingDays,
        LocalDate challengeDeadline,
        @Size(max = 40) String consistencyRuleType,
        @DecimalMin("0.00") BigDecimal consistencyRuleValue,
        boolean trailingDrawdownEnabled,
        @Size(max = 40) String trailingDrawdownType,
        @DecimalMin("0.00") BigDecimal trailingDrawdownAmount,
        @DecimalMin("0.00") BigDecimal trailingDrawdownHighWaterMark,
        @Min(0) Integer contractLimit,
        @Size(max = 4000) String scalingRestrictions,
        @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal profitSplitPct,
        @DecimalMin("0.00") BigDecimal payoutThreshold,
        @Size(max = 80) String payoutFrequency,
        @Size(max = 4000) String payoutEligibilityRules,
        @Size(max = 4000) String resetDetails,
        @Pattern(regexp = "[A-Za-z]{3}", message = "must be a three-letter currency code")
        String currency
) {
}
