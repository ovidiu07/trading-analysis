package com.tradevault.service.backtest;

import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CandleLoadRequest(
        UUID userId,
        BacktestCandleSource provider,
        String sourceId,
        String symbolCanonical,
        String symbolDisplay,
        BacktestTimeframe timeframe,
        OffsetDateTime from,
        OffsetDateTime to,
        boolean refresh
) {
}
