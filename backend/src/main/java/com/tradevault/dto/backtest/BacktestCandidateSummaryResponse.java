package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

import java.util.Map;

@Value
@Builder
public class BacktestCandidateSummaryResponse {
    int totalCandidates;
    int convertedTrades;
    int userAccepted;
    int userRejected;
    Map<String, Integer> byState;
}
