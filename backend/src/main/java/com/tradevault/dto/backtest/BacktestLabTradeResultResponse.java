package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestLabTradeResultResponse {
    UUID tradeId;
    UUID setupId;
    String sessionName;
    String direction;
    OffsetDateTime entryTime;
    BigDecimal entryPrice;
    BigDecimal stopLoss;
    BigDecimal takeProfit;
    OffsetDateTime exitTime;
    BigDecimal exitPrice;
    String exitReason;
    String fillStatus;
    BigDecimal rMultiple;
    BigDecimal maeR;
    BigDecimal mfeR;
    Integer durationSec;
    JsonNode evidence;
    List<BacktestLabTimelineEventResponse> timeline;
}
