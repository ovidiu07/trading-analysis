package com.tradevault.dto.backtest;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class BacktestOptimizerGridRequest {
    private List<Integer> mssMinConfirmCandles;
    private List<String> displacementType;
    private List<Boolean> retraceRequired;
    private List<BigDecimal> retraceMinPct;
    private List<BigDecimal> sweepMinDepthPips;
}
