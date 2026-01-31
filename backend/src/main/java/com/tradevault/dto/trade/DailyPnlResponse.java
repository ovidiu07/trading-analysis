package com.tradevault.dto.trade;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DailyPnlResponse(LocalDate date,
                               BigDecimal netPnl,
                               long tradeCount,
                               long wins,
                               long losses) {
}
