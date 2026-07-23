package com.tradevault.dto.account;

import java.util.UUID;

public record TradingAccountOptionResponse(
        UUID id,
        String name,
        String broker,
        String currency,
        String externalAccountId,
        String brokerServer,
        String brokerTimezone
) {
}
