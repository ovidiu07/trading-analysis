package com.tradevault.dto.session;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Set;

@Data
public class CloseSessionTradeRequest {
    @NotNull
    @DecimalMin("0.0000001")
    private BigDecimal exitPrice;

    private Set<String> ruleBreaks;

    private String postTradeNotes;
}
