package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class BacktestSessionPreviewResponse {
    String sessionName;
    String sessionDate;
    int candleCount;
    BigDecimal sessionHigh;
    BigDecimal sessionLow;
}
