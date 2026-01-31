package com.tradevault.dto.trade;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Value
@Builder
public class DailySummaryResponse {
    LocalDate date;
    BigDecimal netPnl;
    long tradeCount;
    long winners;
    long losers;
    double winRate;
    List<BigDecimal> equityPoints;
}
