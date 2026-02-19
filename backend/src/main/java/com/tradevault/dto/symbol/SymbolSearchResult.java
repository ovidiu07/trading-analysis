package com.tradevault.dto.symbol;

import com.tradevault.domain.enums.Market;

public record SymbolSearchResult(
        String symbol,
        String name,
        String exchange,
        String currency,
        Market market
) {
}
