package com.tradevault.service.news;

import java.util.*;
import java.util.regex.Pattern;

/** News grouping never changes a chart symbol, trading instrument, or private plan. */
public final class InstrumentTopics {
    public record Topic(String key, Set<String> regions, String stockSymbol) {}
    private InstrumentTopics() {}
    public static Topic resolve(String exact) {
        String symbol = exact.trim().toUpperCase(Locale.ROOT);
        if (symbol.matches("(?:NASDAQ|NYSE|AMEX):[A-Z][A-Z0-9.]{0,9}"))
            return new Topic("US_STOCK", Set.of("US"), symbol.substring(symbol.indexOf(':') + 1));
        String bare = symbol.replaceFirst("^[A-Z0-9_]+:", "").replaceAll("[-_ /]", "");
        if (Set.of("GER40", "DE40", "DAX", "DE30EUR", "DAX40").contains(bare)) return new Topic("GERMANY", Set.of("EU", "DE", "US"), null);
        if (Set.of("NQ", "MNQ", "NQ1!", "MNQ1!", "NAS100", "US100", "NASDAQ100", "NAS100USD").contains(bare)) return new Topic("US_TECH", Set.of("US"), null);
        if (bare.equals("EURUSD")) return new Topic("EUR_USD", Set.of("EU", "DE", "US"), null);
        if (bare.equals("GBPUSD")) return new Topic("GBP_USD", Set.of("UK", "US"), null);
        if (Set.of("ES", "ES1!", "MES", "MES1!", "XAUUSD", "USOIL", "WTICOUSD", "DXY").contains(bare)) return new Topic("US_MACRO", Set.of("US"), null);
        return new Topic("UNSUPPORTED", Set.of(), null);
    }
    public static boolean newsMatches(Topic topic, NewsModels.Story story) {
        if (topic.stockSymbol != null && story.entities().contains(topic.stockSymbol)) return true;
        return switch (story.category()) {
            case "EURO_AREA_MACRO" -> topic.regions.contains("EU");
            case "US_MACRO" -> topic.regions.contains("US");
            case "UK_MACRO" -> topic.regions.contains("UK");
            case "DIRECT_INSTRUMENT" -> topic.stockSymbol != null && story.entities().contains(topic.stockSymbol);
            case "TECHNOLOGY_SECTOR" -> topic.key.equals("US_TECH");
            case "GERMAN_EQUITIES" -> topic.key.equals("GERMANY");
            default -> false;
        };
    }
    public static boolean trackedEvent(Topic topic, NewsModels.Event event) {
        if (!topic.regions.contains(event.region())) return false;
        return Pattern.compile("inflation|consumer price|producer price|employment|unemployment|gross domestic|gdp|personal income|outlays|international trade|industrial production|retail trade|retail sales|interest rate|monetary", Pattern.CASE_INSENSITIVE).matcher(event.name()).find();
    }
}
