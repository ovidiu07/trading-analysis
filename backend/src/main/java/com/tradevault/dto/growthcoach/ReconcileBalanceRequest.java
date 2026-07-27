package com.tradevault.dto.growthcoach;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

public record ReconcileBalanceRequest(
        @NotNull @DecimalMin("0.00") BigDecimal brokerReportedBalance,
        @NotNull LocalDate effectiveDate,
        @NotNull LocalTime effectiveTime,
        @NotBlank String timezone,
        @NotBlank @Size(max = 240) String reason,
        @Size(max = 1000) String note,
        @Size(max = 160) String externalReference,
        @NotNull @Pattern(regexp = "PRESERVE_BASELINE|REBASE_FUTURE|RESET_CURRENT") String planningBehavior,
        boolean resetConfirmed
) {
}
