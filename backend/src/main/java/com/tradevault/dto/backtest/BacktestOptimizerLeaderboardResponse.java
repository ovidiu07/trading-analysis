package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BacktestOptimizerLeaderboardResponse {
    JsonNode bestWinRate;
    JsonNode bestExpectancy;
    JsonNode bestBalanced;
    JsonNode recommendedLive;
}
