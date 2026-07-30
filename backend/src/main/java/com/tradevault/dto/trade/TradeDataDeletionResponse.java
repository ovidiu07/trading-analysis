package com.tradevault.dto.trade;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record TradeDataDeletionResponse(
        UUID accountId,
        String accountName,
        int deletedTrades,
        BigDecimal deletedRealizedPnl,
        OffsetDateTime deletedAt
) {
}
