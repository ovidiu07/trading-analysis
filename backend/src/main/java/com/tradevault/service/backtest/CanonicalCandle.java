package com.tradevault.service.backtest;

import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

public record CanonicalCandle(
        BacktestCandleSource provider,
        String sourceId,
        String symbolCanonical,
        String symbolDisplay,
        BacktestTimeframe timeframe,
        OffsetDateTime tsUtc,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal close,
        BigDecimal volume
) {
    public CanonicalCandle {
        if (tsUtc != null) {
            tsUtc = tsUtc.withOffsetSameInstant(ZoneOffset.UTC);
        }
    }

    public BacktestCandle toBacktestCandle() {
        long volumeLong = volume == null ? 0L : volume.longValue();
        return new BacktestCandle(tsUtc, open, high, low, close, volumeLong);
    }
}
