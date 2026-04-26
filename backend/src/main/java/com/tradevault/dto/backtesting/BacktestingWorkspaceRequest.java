package com.tradevault.dto.backtesting;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class BacktestingWorkspaceRequest {
    @NotBlank
    private String symbol;
    private String marketType;
    private UUID strategyId;
    private String strategyNameSnapshot;
    private String title;
    private String primaryTimeframe;
    private String contextTimeframe;
    private String executionTimeframe;
    private String entryTimeframe;
    private Integer numberOfTrades;
    private Integer winningTrades;
    private Integer losingTrades;
    private Integer breakevenTrades;
    private BigDecimal averageR;
    private String notes;
    private String whatWorked;
    private String whatFailed;
    private String bestConditions;
    private String avoidConditions;
}
