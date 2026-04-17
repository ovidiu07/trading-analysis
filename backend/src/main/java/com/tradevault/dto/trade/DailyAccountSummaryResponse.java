package com.tradevault.dto.trade;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class DailyAccountSummaryResponse {
    String accountId;
    BigDecimal netPnl;
    long tradeCount;
    long winners;
    long losers;
    double winRate;
}
