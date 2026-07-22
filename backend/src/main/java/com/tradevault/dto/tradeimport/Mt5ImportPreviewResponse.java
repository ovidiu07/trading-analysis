package com.tradevault.dto.tradeimport;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeImportStatus;
import com.tradevault.domain.enums.TradeStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record Mt5ImportPreviewResponse(
        UUID importBatchId,
        TradeImportStatus status,
        AccountMetadata account,
        Summary summary,
        String sourceTimezone,
        UUID targetAccountId,
        List<UnmappedSymbol> unmappedSymbols,
        List<TradePreview> trades,
        List<String> warnings,
        List<String> errors
) {
    public record AccountMetadata(String externalAccountId, String accountName, String currency, String broker,
                                  String server, String accountType, String accountMode, String reportGeneratedAt) {}
    public record Summary(int positionsFound, int ordersFound, int dealsFound, int accountTransactionsFound,
                          int tradesReady, int duplicates, int warnings, BigDecimal grossPnl,
                          BigDecimal costs, BigDecimal netPnl) {}
    public record UnmappedSymbol(String externalSymbol, String suggestedInternalSymbol) {}
    public record ManualMatch(UUID tradeId, String symbol, int confidence, String explanation) {}
    public record TradePreview(
            String externalPositionId, String externalSymbol, String mappedSymbol, Market market, String tradeCurrency,
            Direction direction, TradeStatus status, OffsetDateTime openedAt, OffsetDateTime closedAt,
            BigDecimal quantity, BigDecimal entryPrice, BigDecimal exitPrice,
            BigDecimal initialStopLossPrice, BigDecimal initialTakeProfitPrice,
            BigDecimal finalStopLossPrice, BigDecimal finalTakeProfitPrice,
            BigDecimal grossPnl, BigDecimal commission, BigDecimal otherCosts, BigDecimal netPnl,
            String accountCurrency, String entryOrderType, BigDecimal requestedEntryPrice,
            BigDecimal requestedExitPrice, BigDecimal entrySlippagePoints, BigDecimal exitSlippagePoints,
            String exitReason, String note, boolean duplicate, UUID existingTradeId,
            List<ManualMatch> potentialManualMatches, List<String> warnings
    ) {}
}
