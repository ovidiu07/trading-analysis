package com.tradevault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.dto.fx.FxRateResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class FxRateService {
    private static final String FX_SOURCE = "FRANKFURTER";
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(6);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(HTTP_TIMEOUT)
            .build();

    public FxRateResponse getLatestRate(String baseCurrencyRaw, String quoteCurrencyRaw) {
        String baseCurrency = normalizeCurrency(baseCurrencyRaw);
        String quoteCurrency = normalizeCurrency(quoteCurrencyRaw);
        if (baseCurrency.equals(quoteCurrency)) {
            return FxRateResponse.builder()
                    .baseCurrency(baseCurrency)
                    .quoteCurrency(quoteCurrency)
                    .rate(BigDecimal.ONE)
                    .timestamp(OffsetDateTime.now(ZoneOffset.UTC))
                    .source("IDENTITY")
                    .build();
        }

        try {
            String endpoint = "https://api.frankfurter.app/latest?from=%s&to=%s".formatted(
                    URLEncoder.encode(baseCurrency, StandardCharsets.UTF_8),
                    URLEncoder.encode(quoteCurrency, StandardCharsets.UTF_8)
            );
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(HTTP_TIMEOUT)
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("FX provider returned " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            BigDecimal rate = parseRate(root.path("rates").path(quoteCurrency));
            return FxRateResponse.builder()
                    .baseCurrency(baseCurrency)
                    .quoteCurrency(quoteCurrency)
                    .rate(rate)
                    .timestamp(OffsetDateTime.now(ZoneOffset.UTC))
                    .source(FX_SOURCE)
                    .build();
        } catch (Exception ex) {
            throw new IllegalStateException("Could not fetch FX rate for " + baseCurrency + " -> " + quoteCurrency, ex);
        }
    }

    private BigDecimal parseRate(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            throw new IllegalStateException("FX provider payload did not contain rate");
        }
        BigDecimal rate;
        if (node.isNumber()) {
            rate = node.decimalValue();
        } else {
            rate = new BigDecimal(node.asText());
        }
        if (rate.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("FX provider returned non-positive rate");
        }
        return rate.setScale(8, RoundingMode.HALF_UP);
    }

    private String normalizeCurrency(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Currency is required");
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!normalized.matches("^[A-Z]{3}$")) {
            throw new IllegalArgumentException("Currency must be a 3-letter ISO code");
        }
        return normalized;
    }
}
