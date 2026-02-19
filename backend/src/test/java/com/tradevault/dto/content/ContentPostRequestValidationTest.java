package com.tradevault.dto.content;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ContentPostRequestValidationTest {

    private static ValidatorFactory validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void closeValidatorFactory() {
        if (validatorFactory != null) {
            validatorFactory.close();
        }
    }

    @Test
    void rejectsUnsupportedTradingViewSymbolCharacters() {
        ContentPostRequest request = minimalRequest();
        request.setTradingViewSymbol("TVC:DAX<script>");

        var violations = validator.validate(request);

        assertTrue(violations.stream().anyMatch(v -> "tradingViewSymbol".equals(v.getPropertyPath().toString())));
    }

    @Test
    void rejectsUnsupportedTradingViewInterval() {
        ContentPostRequest request = minimalRequest();
        request.setTradingViewSymbol("TVC:DAX");
        request.setTradingViewInterval("2H");

        var violations = validator.validate(request);

        assertTrue(violations.stream().anyMatch(v -> "tradingViewInterval".equals(v.getPropertyPath().toString())));
    }

    @Test
    void acceptsSupportedTradingViewConfigAndBlankBody() {
        ContentPostRequest request = minimalRequest();
        request.setTradingViewSymbol("TVC:DAX");
        request.setTradingViewInterval("15");

        var violations = validator.validate(request);

        assertTrue(violations.isEmpty());
    }

    private static ContentPostRequest minimalRequest() {
        ContentPostRequest request = new ContentPostRequest();
        request.setContentTypeId(UUID.randomUUID());

        LocalizedContentRequest en = new LocalizedContentRequest();
        en.setTitle("Daily Plan");
        en.setSummary("Summary");
        en.setBody("");
        request.setTranslations(Map.of("en", en));
        return request;
    }
}
