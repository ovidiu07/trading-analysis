package com.tradevault.dto.account;

import com.tradevault.domain.enums.AccountStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record TradingAccountOptionResponse(
        UUID id,
        String name,
        String broker,
        String currency,
        String externalAccountId,
        String brokerServer,
        String brokerTimezone,
        String accountType,
        AccountStatus status,
        boolean isDefault,
        BigDecimal startingBalance,
        long tradeCount,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
