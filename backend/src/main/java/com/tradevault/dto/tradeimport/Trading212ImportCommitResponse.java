package com.tradevault.dto.tradeimport;

import com.tradevault.domain.enums.TradeImportStatus;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record Trading212ImportCommitResponse(
        UUID importBatchId,
        TradeImportStatus status,
        int created,
        int updated,
        int duplicatesSkipped,
        int excluded,
        BigDecimal grossPnl,
        BigDecimal costs,
        BigDecimal netPnl,
        List<UUID> tradeIds,
        List<String> warnings,
        List<String> errors
) {
}
