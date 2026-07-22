package com.tradevault.dto.tradeimport;

import com.tradevault.domain.enums.Market;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record Mt5ImportCommitRequest(
        @NotNull UUID targetAccountId,
        @NotBlank String sourceTimezone,
        List<String> selectedPositionIds,
        @Valid List<SymbolMapping> symbolMappings,
        Map<String, UUID> linkToExistingTradeIds,
        boolean saveBrokerTimezone
) {
    public record SymbolMapping(
            @NotBlank String externalSymbol,
            @NotBlank String internalSymbol,
            @NotNull Market market,
            @NotBlank String tradeCurrency,
            BigDecimal tickSize,
            BigDecimal tickValue,
            BigDecimal pointValue,
            BigDecimal contractMultiplier,
            boolean saveForFuture
    ) {}
}
