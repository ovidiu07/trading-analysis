package com.tradevault.service.backtest;

import java.time.OffsetDateTime;
import java.util.List;

public interface CandleProvider {
    String providerKey();

    List<BacktestCandle> getCandles(String symbol, String timeframe, OffsetDateTime from, OffsetDateTime to);
}
