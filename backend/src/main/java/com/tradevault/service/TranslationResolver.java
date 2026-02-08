package com.tradevault.service;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class TranslationResolver {
    public <T> ResolvedTranslation<T> resolve(Map<String, T> translations, String requestedLocale) {
        if (translations == null || translations.isEmpty()) {
            return new ResolvedTranslation<>(LocaleResolverService.DEFAULT_LOCALE, null);
        }

        T requested = translations.get(requestedLocale);
        if (requested != null) {
            return new ResolvedTranslation<>(requestedLocale, requested);
        }

        T english = translations.get(LocaleResolverService.DEFAULT_LOCALE);
        if (english != null) {
            return new ResolvedTranslation<>(LocaleResolverService.DEFAULT_LOCALE, english);
        }

        Map.Entry<String, T> first = translations.entrySet().stream()
                .filter(entry -> entry.getValue() != null)
                .findFirst()
                .orElse(null);

        if (first == null) {
            return new ResolvedTranslation<>(LocaleResolverService.DEFAULT_LOCALE, null);
        }
        return new ResolvedTranslation<>(first.getKey(), first.getValue());
    }

    public List<String> missingLocales(Collection<String> requiredLocales, Map<String, ?> translations) {
        if (requiredLocales == null || requiredLocales.isEmpty()) {
            return List.of();
        }
        Map<String, ?> safeTranslations = translations == null ? Map.of() : translations;
        return requiredLocales.stream()
                .filter(Objects::nonNull)
                .filter(locale -> {
                    Object value = safeTranslations.get(locale);
                    return value == null;
                })
                .toList();
    }

    public record ResolvedTranslation<T>(String locale, T value) {}
}
