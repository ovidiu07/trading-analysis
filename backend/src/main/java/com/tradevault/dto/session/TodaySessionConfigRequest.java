package com.tradevault.dto.session;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class TodaySessionConfigRequest {
    @NotNull
    @DecimalMin("0.0")
    private BigDecimal profitTarget;

    @NotNull
    @DecimalMin("0.0")
    private BigDecimal lossLimit;

    @NotNull
    @Positive
    private Integer maxTrades;
}
