package com.tradevault.dto.trade;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

public record TradeDataDeletionRequest(
        @NotNull UUID accountId,
        @NotNull Scope scope,
        LocalDate startDate,
        LocalDate endDate,
        String timezone,
        boolean confirmed,
        String confirmationText,
        String previewToken
) {
    public enum Scope {
        DATE_RANGE,
        ENTIRE_HISTORY
    }
}
