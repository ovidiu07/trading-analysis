package com.tradevault.dto.backtesting;

import com.tradevault.domain.enums.BacktestingTradeDirection;
import com.tradevault.domain.enums.BacktestingTradeResult;
import com.tradevault.domain.enums.BacktestingTradeScope;
import com.tradevault.domain.enums.BacktestingTradeSource;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestingTradeResponse {
    UUID id;
    UUID workspaceId;
    LocalDate date;
    String weekday;
    LocalTime entryTime;
    String instrument;
    BacktestingTradeDirection direction;
    String session;
    String setupName;
    UUID strategyId;
    BigDecimal riskPercent;
    BigDecimal plannedRR;
    BacktestingTradeResult result;
    BigDecimal pnlR;
    String contextTimeframe;
    String executionTimeframe;
    String entryTimeframe;
    List<String> tags;
    String notes;
    BacktestingTradeSource source;
    BacktestingTradeScope tradeScope;
    Integer screenshotCount;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
