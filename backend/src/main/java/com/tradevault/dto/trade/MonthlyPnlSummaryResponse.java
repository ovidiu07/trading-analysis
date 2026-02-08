package com.tradevault.dto.trade;

import java.math.BigDecimal;

public record MonthlyPnlSummaryResponse(int year,
                                       int month,
                                       String timezone,
                                       BigDecimal netPnl,
                                       BigDecimal grossPnl,
                                       long tradeCount,
                                       long tradingDays) {
}
