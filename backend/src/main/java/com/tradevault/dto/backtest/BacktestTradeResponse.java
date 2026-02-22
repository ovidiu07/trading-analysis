package com.tradevault.dto.backtest;

import com.tradevault.domain.enums.BacktestExitReason;
import com.tradevault.domain.enums.BacktestOrderType;
import com.tradevault.domain.enums.Direction;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class BacktestTradeResponse {
    UUID id;
    UUID runId;
    UUID strategyId;
    UUID strategyVersionId;
    UUID contextSnapshotId;
    String symbol;
    Direction direction;
    BacktestOrderType orderType;
    BigDecimal entryPrice;
    BigDecimal stopLossPrice;
    BigDecimal takeProfitPrice;
    BigDecimal riskAmount;
    String invalidationText;
    OffsetDateTime requestedAt;
    OffsetDateTime entryTime;
    OffsetDateTime exitTime;
    boolean filled;
    BacktestExitReason exitReason;
    Boolean win;
    boolean breakEven;
    BigDecimal rMultiple;
    BigDecimal maePrice;
    BigDecimal mfePrice;
    BigDecimal maeR;
    BigDecimal mfeR;
    Integer durationMinutes;
    Integer durationBars;
    Integer timeToPlus1RMinutes;
    Integer timeToPlus1RBars;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
