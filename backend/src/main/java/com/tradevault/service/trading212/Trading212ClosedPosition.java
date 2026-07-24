package com.tradevault.service.trading212;

import com.tradevault.domain.enums.Direction;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public record Trading212ClosedPosition(
        long rowNumber,
        String recordType,
        OffsetDateTime recordDate,
        String accountCurrency,
        String instrument,
        String symbol,
        String instrumentCurrency,
        Direction direction,
        BigDecimal units,
        String positionId,
        String orderId,
        OffsetDateTime openedAt,
        OffsetDateTime closedAt,
        BigDecimal averagePrice,
        BigDecimal closePrice,
        BigDecimal exchangeRate,
        BigDecimal spread,
        BigDecimal result,
        BigDecimal fxFee,
        BigDecimal resultAfterFxFee,
        BigDecimal overnightInterest,
        BigDecimal dividendAdjustment,
        BigDecimal totalResult,
        BigDecimal priceDerivedPnl,
        BigDecimal pricePnlDifference,
        BigDecimal totalReconciliationDifference,
        Map<String, String> raw,
        List<String> warnings
) {
}
