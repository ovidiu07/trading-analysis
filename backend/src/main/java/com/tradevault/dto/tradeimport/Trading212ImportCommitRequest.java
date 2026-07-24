package com.tradevault.dto.tradeimport;

import com.tradevault.domain.enums.Market;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record Trading212ImportCommitRequest(
        @NotNull UUID targetAccountId,
        List<String> selectedPositionIds,
        @Valid List<SymbolMapping> symbolMappings,
        Map<String, UUID> linkToExistingTradeIds
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
    ) {
    }
}
