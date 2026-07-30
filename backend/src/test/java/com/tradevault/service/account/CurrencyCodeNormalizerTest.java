package com.tradevault.service.account;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CurrencyCodeNormalizerTest {
    @ParameterizedTest
    @ValueSource(strings = {"EUR", "eur", "EUR "})
    void normalizesSupportedIsoCurrencyCodes(String value) {
        assertEquals("EUR", CurrencyCodeNormalizer.normalize(value).orElseThrow());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "ZZZ", "EURO"})
    void rejectsMissingOrUnsupportedCurrencyCodes(String value) {
        assertTrue(CurrencyCodeNormalizer.normalize(value).isEmpty());
    }

    @Test
    void supportsUsdIndependently() {
        assertEquals("USD", CurrencyCodeNormalizer.normalize(" usd ").orElseThrow());
    }
}
