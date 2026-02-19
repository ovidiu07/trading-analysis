package com.tradevault.dto.strategy;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class StrategyRequest {
    @NotBlank
    private String name;

    @NotBlank
    private String model;

    private List<String> entryConditions;

    @NotBlank
    private String invalidationLogic;

    @NotBlank
    private String tpFramework;

    private String noTradeRules;

    private List<String> sessionSuitability;

    private List<String> tags;

    private Boolean archived;
}
