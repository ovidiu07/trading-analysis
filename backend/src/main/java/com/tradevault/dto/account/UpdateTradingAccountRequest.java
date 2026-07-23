package com.tradevault.dto.account;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdateTradingAccountRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 120) String broker,
        @NotBlank
        @Pattern(regexp = "[A-Za-z]{3}", message = "must be a three-letter currency code")
        String currency,
        @Size(max = 40) String accountType,
        @Size(max = 128) String externalAccountId,
        @Size(max = 160) String brokerServer,
        @Size(max = 80) String brokerTimezone,
        BigDecimal startingBalance
) {
}
