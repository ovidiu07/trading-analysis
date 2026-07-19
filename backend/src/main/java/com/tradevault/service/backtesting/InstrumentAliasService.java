package com.tradevault.service.backtesting;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class InstrumentAliasService {
    public static final String DAX_INDEX = "DAX_INDEX";
    public static final String DAX_FUTURES_FULL = "DAX_FUTURES_FULL";
    public static final String DAX_FUTURES_MINI = "DAX_FUTURES_MINI";
    public static final String DAX_FUTURES_MICRO = "DAX_FUTURES_MICRO";

    private static final Map<String, CanonicalInstrument> EXACT_ALIASES = Map.ofEntries(
            Map.entry("DAX", index()),
            Map.entry("DAX30", index()),
            Map.entry("DAX40", index()),
            Map.entry("GER30", index()),
            Map.entry("GER40", index()),
            Map.entry("DE30", index()),
            Map.entry("DE40", index()),
            Map.entry("DEU40", index()),
            Map.entry("GERMANY40", index()),
            Map.entry("FDAX", new CanonicalInstrument(DAX_FUTURES_FULL, "DAX", "FUTURES_FULL")),
            Map.entry("FDXM", new CanonicalInstrument(DAX_FUTURES_MINI, "DAX", "FUTURES_MINI")),
            Map.entry("FDXS", new CanonicalInstrument(DAX_FUTURES_MICRO, "DAX", "FUTURES_MICRO"))
    );

    public Optional<CanonicalInstrument> resolveCanonicalInstrument(String symbol) {
        if (!StringUtils.hasText(symbol)) return Optional.empty();
        String normalized = normalize(symbol);
        CanonicalInstrument exact = EXACT_ALIASES.get(normalized);
        if (exact != null) return Optional.of(exact);

        // Broker suffixes are accepted only after an already-known index/CFD alias.
        for (String suffix : new String[]{"CASH", "CFD", "INDEX"}) {
            if (normalized.endsWith(suffix)) {
                String base = normalized.substring(0, normalized.length() - suffix.length());
                CanonicalInstrument candidate = EXACT_ALIASES.get(base);
                if (candidate != null && DAX_INDEX.equals(candidate.id())) return Optional.of(candidate);
            }
        }
        return Optional.empty();
    }

    public String normalizeDisplayToken(String symbol) {
        return StringUtils.hasText(symbol) ? normalize(symbol) : "";
    }

    private String normalize(String value) {
        String upper = value.trim().toUpperCase(Locale.ROOT);
        int brokerPrefix = upper.lastIndexOf(':');
        String withoutPrefix = brokerPrefix >= 0 ? upper.substring(brokerPrefix + 1) : upper;
        return withoutPrefix.replaceAll("[^A-Z0-9]", "");
    }

    private static CanonicalInstrument index() {
        return new CanonicalInstrument(DAX_INDEX, "DAX", "INDEX_CFD");
    }

    public record CanonicalInstrument(String id, String displayName, String instrumentClass) { }
}
