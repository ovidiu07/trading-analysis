package com.tradevault.service.backtest;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record BacktestCandle(
        OffsetDateTime timestamp,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal close,
        long volume
) {
}
