package com.tradevault.service.account;

import java.util.Currency;
import java.util.Locale;
import java.util.Optional;

public final class CurrencyCodeNormalizer {
    private CurrencyCodeNormalizer() {
    }

    public static Optional<String> normalize(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        try {
            Currency.getInstance(normalized);
            return Optional.of(normalized);
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
