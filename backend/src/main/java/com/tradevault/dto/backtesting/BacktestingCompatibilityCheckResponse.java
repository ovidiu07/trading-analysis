package com.tradevault.dto.backtesting;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BacktestingCompatibilityCheckResponse {
    String code;
    boolean matches;
    boolean blocking;
    String tradeValue;
    String workspaceValue;
}
