package com.tradevault.dto.backtest;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BacktestDatasetValidationIssueResponse {
    String code;
    String message;
    String details;
}
