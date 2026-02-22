package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.domain.enums.BacktestOrderType;
import com.tradevault.domain.enums.Direction;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
public class BacktestTradeSimulateRequest {
    @NotNull
    private Direction direction;

    private BacktestOrderType orderType;

    @DecimalMin("0.0000001")
    private BigDecimal entryPrice;

    @NotNull
    @DecimalMin("0.0000001")
    private BigDecimal stopLossPrice;

    @DecimalMin("0.0000001")
    private BigDecimal takeProfitPrice;

    @DecimalMin("0.0001")
    private BigDecimal riskAmount;

    private String invalidationText;

    @NotNull
    private OffsetDateTime replayCursorTime;

    private Boolean conservativeSameBar;

    private UUID strategyId;

    private UUID prereqsTemplateId;

    private UUID triggersTemplateId;

    private UUID selectedSweepLevelId;

    private JsonNode prereqsStatesJson;

    private JsonNode triggersStatesJson;

    private JsonNode levelsSnapshotJson;

    private JsonNode lockInSnapshotJson;

    private JsonNode qualityScoreInputsJson;
}
