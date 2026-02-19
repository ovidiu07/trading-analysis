package com.tradevault.service.symbol;

import com.tradevault.domain.enums.Market;
import com.tradevault.dto.symbol.SymbolSearchResult;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class SymbolSearchService {

    private static final List<SymbolEntry> SYMBOLS = List.of(
            new SymbolEntry("AAPL", "Apple Inc.", "NASDAQ", "USD", Market.STOCK),
            new SymbolEntry("MSFT", "Microsoft Corp.", "NASDAQ", "USD", Market.STOCK),
            new SymbolEntry("GOOGL", "Alphabet Inc.", "NASDAQ", "USD", Market.STOCK),
            new SymbolEntry("AMZN", "Amazon.com Inc.", "NASDAQ", "USD", Market.STOCK),
            new SymbolEntry("META", "Meta Platforms", "NASDAQ", "USD", Market.STOCK),
            new SymbolEntry("TSLA", "Tesla Inc.", "NASDAQ", "USD", Market.STOCK),
            new SymbolEntry("NVDA", "NVIDIA Corp.", "NASDAQ", "USD", Market.STOCK),
            new SymbolEntry("SPY", "SPDR S&P 500 ETF", "NYSE ARCA", "USD", Market.STOCK),
            new SymbolEntry("QQQ", "Invesco QQQ", "NASDAQ", "USD", Market.STOCK),
            new SymbolEntry("EURUSD", "Euro / US Dollar", "FX", "USD", Market.FOREX),
            new SymbolEntry("GBPUSD", "British Pound / US Dollar", "FX", "USD", Market.FOREX),
            new SymbolEntry("USDJPY", "US Dollar / Japanese Yen", "FX", "JPY", Market.FOREX),
            new SymbolEntry("AUDUSD", "Australian Dollar / US Dollar", "FX", "USD", Market.FOREX),
            new SymbolEntry("XAUUSD", "Gold Spot / US Dollar", "COMMODITIES", "USD", Market.FOREX),
            new SymbolEntry("ES", "E-mini S&P 500", "CME", "USD", Market.FUTURES),
            new SymbolEntry("NQ", "E-mini Nasdaq 100", "CME", "USD", Market.FUTURES),
            new SymbolEntry("CL", "Crude Oil WTI", "NYMEX", "USD", Market.FUTURES),
            new SymbolEntry("GC", "Gold Futures", "COMEX", "USD", Market.FUTURES),
            new SymbolEntry("BTCUSD", "Bitcoin / US Dollar", "CRYPTO", "USD", Market.CRYPTO),
            new SymbolEntry("ETHUSD", "Ethereum / US Dollar", "CRYPTO", "USD", Market.CRYPTO),
            new SymbolEntry("SOLUSD", "Solana / US Dollar", "CRYPTO", "USD", Market.CRYPTO)
    );

    public List<SymbolSearchResult> search(String query, Market market) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        String normalizedQuery = query.trim().toUpperCase(Locale.ROOT);

        return SYMBOLS.stream()
                .filter(entry -> market == null || entry.market() == market)
                .filter(entry -> {
                    String symbol = entry.symbol().toUpperCase(Locale.ROOT);
                    String name = entry.name().toUpperCase(Locale.ROOT);
                    return symbol.contains(normalizedQuery) || name.contains(normalizedQuery);
                })
                .sorted(Comparator
                        .comparingInt((SymbolEntry entry) -> rank(entry, normalizedQuery))
                        .thenComparing(SymbolEntry::symbol))
                .limit(20)
                .map(entry -> new SymbolSearchResult(entry.symbol(), entry.name(), entry.exchange(), entry.currency(), entry.market()))
                .toList();
    }

    private int rank(SymbolEntry entry, String query) {
        String symbol = entry.symbol().toUpperCase(Locale.ROOT);
        String name = entry.name().toUpperCase(Locale.ROOT);

        if (symbol.startsWith(query)) {
            return 0;
        }
        if (name.startsWith(query)) {
            return 1;
        }
        if (symbol.contains(query)) {
            return 2;
        }
        return 3;
    }

    private record SymbolEntry(
            String symbol,
            String name,
            String exchange,
            String currency,
            Market market
    ) {
    }
}
