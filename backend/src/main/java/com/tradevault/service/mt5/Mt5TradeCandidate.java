package com.tradevault.service.mt5;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record Mt5TradeCandidate(
        String externalPositionId,
        String externalSymbol,
        Direction direction,
        TradeStatus status,
        String openedAtOriginal,
        OffsetDateTime openedAt,
        String closedAtOriginal,
        OffsetDateTime closedAt,
        BigDecimal quantity,
        BigDecimal entryPrice,
        BigDecimal exitPrice,
        BigDecimal initialStopLossPrice,
        BigDecimal initialTakeProfitPrice,
        BigDecimal finalStopLossPrice,
        BigDecimal finalTakeProfitPrice,
        BigDecimal brokerReportedGrossPnl,
        BigDecimal commission,
        BigDecimal otherCosts,
        BigDecimal brokerReportedNetPnl,
        String entryOrderType,
        BigDecimal requestedEntryPrice,
        BigDecimal requestedExitPrice,
        BigDecimal entrySlippagePoints,
        BigDecimal exitSlippagePoints,
        String exitReason,
        String note,
        List<String> dealIds,
        List<String> orderIds,
        List<String> warnings
) {}
