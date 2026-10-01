package com.tradevault.service.news;

import com.tradevault.service.backtesting.InstrumentAliasService;
import java.util.*;
import java.util.regex.Pattern;

/** Relevance only: never rewrites the instrument, chart or private preparation. */
public final class InstrumentTopics {
    public record Topic(String key, Set<String> regions, String stockSymbol, String stockIdentity) {
        Topic(String key, Set<String> regions) { this(key, regions, null, null); }
    }
    private static final InstrumentAliasService ALIASES = new InstrumentAliasService();
    private InstrumentTopics() {}
    public static Topic resolve(String exact) {
        String symbol = Objects.toString(exact, "").trim().toUpperCase(Locale.ROOT);
        if (symbol.matches("(?:NASDAQ|NYSE|AMEX|LSE|XETR|FWB|EURONEXT|EPA|AMS):[A-Z][A-Z0-9.]{0,14}") && !symbol.equals("XETR:DAX")) {
            String exchange = symbol.substring(0, symbol.indexOf(':'));
            Set<String> regions = exchange.equals("LSE") ? Set.of("UK")
                : Set.of("XETR", "FWB").contains(exchange) ? Set.of("DE", "EU")
                : Set.of("EURONEXT", "EPA", "AMS").contains(exchange) ? Set.of("EU") : Set.of("US");
            return new Topic("STOCK", regions, symbol.substring(symbol.indexOf(':') + 1), symbol);
        }
        String bare = symbol.replaceFirst("^[A-Z0-9_]+:", "").replaceAll("[-_ /]", "");
        if (ALIASES.resolveCanonicalInstrument(symbol).isPresent() || bare.equals("DE30EUR")) return new Topic("GERMANY", Set.of("EU", "DE", "US"));
        if (Set.of("NQ", "MNQ", "NQ1!", "MNQ1!", "NAS", "NAS100", "US100", "NASDAQ100", "NAS100USD").contains(bare)) return new Topic("US_TECH", Set.of("US"));
        if (Set.of("UK100", "FTSE", "FTSE100", "UK100GBP").contains(bare)) return new Topic("UK_EQUITIES", Set.of("UK", "US"));
        if (bare.equals("EURUSD")) return new Topic("EUR_USD", Set.of("EU", "DE", "US"));
        if (bare.equals("GBPUSD")) return new Topic("GBP_USD", Set.of("UK", "US"));
        // Other FX pairs in SymbolSearchService have partial US coverage only.
        if (Set.of("USDJPY", "AUDUSD").contains(bare)) return new Topic("PARTIAL_FX", Set.of("US"));
        if (Set.of("ES", "ES1!", "MES", "MES1!", "XAUUSD", "USOIL", "WTICOUSD", "DXY").contains(bare)) return new Topic("US_MACRO", Set.of("US"));
        return new Topic("UNSUPPORTED", Set.of());
    }
    public static boolean direct(Topic topic, NewsModels.Story story) {
        return topic.stockIdentity != null && story.entities().contains(topic.stockIdentity);
    }
    public static boolean newsMatches(Topic topic, NewsModels.Story story) {
        if (direct(topic, story)) return true;
        return switch (story.category()) {
            case "EURO_AREA_MACRO" -> topic.regions.contains("EU");
            case "GERMAN_MACRO" -> topic.regions.contains("DE");
            case "US_MACRO" -> topic.regions.contains("US");
            case "UK_MACRO" -> topic.regions.contains("UK");
            case "TECHNOLOGY_SECTOR", "NASDAQ_INDEX" -> topic.key.equals("US_TECH");
            case "GERMAN_EQUITIES", "DAX_INDEX" -> topic.key.equals("GERMANY");
            case "UK_EQUITIES", "FTSE_INDEX" -> topic.key.equals("UK_EQUITIES");
            default -> false;
        };
    }
    public static int rank(Topic topic, NewsModels.Story story) {
        if (direct(topic, story) || story.category().endsWith("_INDEX")) return 0;
        if (story.category().endsWith("_EQUITIES") || story.category().endsWith("_SECTOR")) return 1;
        // US macro is a justified cross-market fallback for European equity indices.
        if (Set.of("GERMANY", "UK_EQUITIES").contains(topic.key) && story.category().equals("US_MACRO")) return 3;
        return 2;
    }
    public static boolean trackedEvent(Topic topic, NewsModels.Event event) {
        if (!topic.regions.contains(event.region())) return false;
        return Pattern.compile("inflation|consumer price|producer price|employment|unemployment|gross domestic|gdp|personal income|outlays|international trade|industrial production|retail trade|retail sales|interest rate|monetary", Pattern.CASE_INSENSITIVE).matcher(event.name()).find();
    }
}
