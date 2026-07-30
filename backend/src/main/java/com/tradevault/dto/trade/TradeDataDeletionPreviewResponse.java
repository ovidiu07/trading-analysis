package com.tradevault.dto.trade;

import com.tradevault.domain.enums.TradeSource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record TradeDataDeletionPreviewResponse(
        UUID accountId,
        String accountName,
        TradeDataDeletionRequest.Scope scope,
        LocalDate startDate,
        LocalDate endDate,
        String timezone,
        int tradeCount,
        OffsetDateTime earliestAffectedTrade,
        OffsetDateTime latestAffectedTrade,
        BigDecimal realizedPnl,
        long linkedJournalRecords,
        Map<TradeSource, Long> sourceDistribution,
        String previewToken
) {
}
