package com.tradevault.dto.tradeimport;

import com.tradevault.domain.enums.TradeImportStatus;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record Trading212ImportCommitResponse(
        UUID importBatchId,
        TradeImportStatus status,
        int totalRows,
        int validRows,
        int created,
        int updated,
        int duplicatesSkipped,
        int duplicatesInFile,
        int invalidRows,
        int failedRows,
        int excluded,
        UUID targetAccountId,
        String targetAccountName,
        String originalFilename,
        java.time.OffsetDateTime importedAt,
        BigDecimal grossPnl,
        BigDecimal costs,
        BigDecimal netPnl,
        BigDecimal skippedNetPnl,
        List<UUID> tradeIds,
        List<String> warnings,
        List<String> errors
) {
}
