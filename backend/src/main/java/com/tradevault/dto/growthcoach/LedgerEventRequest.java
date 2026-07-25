package com.tradevault.dto.growthcoach;

import com.tradevault.domain.enums.LedgerEventType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record LedgerEventRequest(
        @NotNull LedgerEventType eventType,
        @NotNull BigDecimal amount,
        @NotNull
        @Pattern(regexp = "[A-Za-z]{3}", message = "must be a three-letter currency code")
        String currency,
        @NotNull OffsetDateTime eventTime,
        @Size(max = 240) String description,
        @Size(max = 160) String externalReference
) {
}
