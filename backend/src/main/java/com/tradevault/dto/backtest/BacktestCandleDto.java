package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Value
@Builder
public class BacktestCandleDto {
    OffsetDateTime timestamp;
    Long epochSec;
    BigDecimal open;
    BigDecimal high;
    BigDecimal low;
    BigDecimal close;
    long volume;
}
