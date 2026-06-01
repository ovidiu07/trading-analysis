package com.tradevault.dto.backtesting;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class BacktestingEdgeLensRequest {
    @NotBlank
    private String name;
    private String description;
    @NotNull
    private Map<String, Object> filterDefinition;
}
