package com.tradevault.dto.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;

@Data
public class BacktestStrategyConfigUpsertRequest {
    private String name;
    private JsonNode configJson;
}
