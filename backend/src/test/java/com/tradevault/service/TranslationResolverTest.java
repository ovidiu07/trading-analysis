package com.tradevault.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TranslationResolverTest {

    private TranslationResolver resolver;

    @BeforeEach
    void setup() {
        resolver = new TranslationResolver();
    }

    @Test
    void returnsRequestedLocaleWhenAvailable() {
        var resolved = resolver.resolve(Map.of(
                "en", "English",
                "ro", "Romana"
        ), "ro");

        assertEquals("ro", resolved.locale());
        assertEquals("Romana", resolved.value());
    }

    @Test
    void fallsBackToEnglishWhenRequestedLocaleMissing() {
        var resolved = resolver.resolve(Map.of(
                "en", "English"
        ), "ro");

        assertEquals("en", resolved.locale());
        assertEquals("English", resolved.value());
    }

    @Test
    void reportsMissingLocalesForSupportedSet() {
        List<String> missing = resolver.missingLocales(List.of("en", "ro"), Map.of("en", "English"));
        assertEquals(List.of("ro"), missing);
    }
}
