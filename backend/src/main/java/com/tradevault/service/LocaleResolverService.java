package com.tradevault.service;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class LocaleResolverService {
    public static final String DEFAULT_LOCALE = "en";
    public static final String ROMANIAN_LOCALE = "ro";

    private static final List<String> SUPPORTED_LOCALES = List.of(DEFAULT_LOCALE, ROMANIAN_LOCALE);
    private static final Set<String> SUPPORTED_SET = Set.copyOf(SUPPORTED_LOCALES);

    public String resolveLocale(String langParam, String acceptLanguageHeader) {
        String fromParam = normalizeLocale(langParam);
        if (fromParam != null) {
            return fromParam;
        }

        if (acceptLanguageHeader != null && !acceptLanguageHeader.isBlank()) {
            String[] parts = acceptLanguageHeader.split(",");
            for (String part : parts) {
                String candidate = normalizeLocale(part);
                if (candidate != null) {
                    return candidate;
                }
            }
        }

        return DEFAULT_LOCALE;
    }

    public String normalizeLocale(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT).replace('_', '-');
        int separator = normalized.indexOf('-');
        if (separator > 0) {
            normalized = normalized.substring(0, separator);
        }
        int quality = normalized.indexOf(';');
        if (quality > 0) {
            normalized = normalized.substring(0, quality);
        }
        if (!SUPPORTED_SET.contains(normalized)) {
            return null;
        }
        return normalized;
    }

    public List<String> getSupportedLocales() {
        return SUPPORTED_LOCALES;
    }
}
