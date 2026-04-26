package com.tradevault.dto.session;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class UpsertSessionPlanRequest {
    private String title;
    private String bias;
    private List<String> focusSymbols;
    private String objectives;
    private BigDecimal target;
    private BigDecimal maxLoss;
    private String notes;
    private String reviewIntentions;
}
