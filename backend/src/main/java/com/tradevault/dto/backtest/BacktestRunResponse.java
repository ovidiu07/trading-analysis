package com.tradevault.dto.backtest;

import com.tradevault.domain.enums.BacktestRunStatus;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BacktestRunResponse {
    UUID id;
    String symbol;
    String timeframe;
    OffsetDateTime from;
    OffsetDateTime to;
    String sessionWindow;
    BigDecimal spread;
    BigDecimal slippage;
    String provider;
    BacktestRunStatus status;
    int candleCount;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
    List<BacktestCandleDto> candles;
}
