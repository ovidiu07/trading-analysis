package com.tradevault.dto.backtesting;

import com.tradevault.domain.enums.BacktestingAutoImportMode;
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
    private String session;
    private BacktestingAutoImportMode autoImportMode;
    private String description;
    private String researchObjective;
    private String executionObservations;
    private String liveExecutionGap;
    private String nextTestingObjective;
    private String researchConclusion;
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
