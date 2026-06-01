package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class BacktestingImportResponse {
    Integer imported;
    Integer invalid;
    List<String> errors;
    List<BacktestingTradeResponse> trades;
}
