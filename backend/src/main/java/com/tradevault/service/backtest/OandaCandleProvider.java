package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class OandaCandleProvider implements CandleProvider {
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${backtest.oanda.base-url:https://api-fxpractice.oanda.com/v3}")
    private String baseUrl;

    @Value("${backtest.oanda.api-key:}")
    private String apiKey;

    @Override
    public String providerKey() {
        return "OANDA";
    }

    @Override
    public List<BacktestCandle> getCandles(String symbol, String timeframe, OffsetDateTime from, OffsetDateTime to) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("OANDA API key is missing. Set backtest.oanda.api-key to load candles.");
        }
        String instrument = mapSymbol(symbol);
        String granularity = mapTimeframe(timeframe);

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/instruments/{instrument}/candles")
                .queryParam("price", "M")
                .queryParam("granularity", granularity)
                .queryParam("from", ISO.format(from))
                .queryParam("to", ISO.format(to))
                .buildAndExpand(instrument)
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey.trim());
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
        String payload = response.getBody();
        if (payload == null || payload.isBlank()) {
            return List.of();
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode candles = root.path("candles");
            if (!candles.isArray()) {
                return List.of();
            }
            List<BacktestCandle> rows = new ArrayList<>();
            for (JsonNode item : candles) {
                if (!item.path("complete").asBoolean(false)) {
                    continue;
                }
                OffsetDateTime timestamp = parseTime(item.path("time").asText(null));
                JsonNode mid = item.path("mid");
                BigDecimal open = parseDecimal(mid.path("o").asText(null));
                BigDecimal high = parseDecimal(mid.path("h").asText(null));
                BigDecimal low = parseDecimal(mid.path("l").asText(null));
                BigDecimal close = parseDecimal(mid.path("c").asText(null));
                long volume = item.path("volume").asLong(0L);
                if (timestamp == null || open == null || high == null || low == null || close == null) {
                    continue;
                }
                rows.add(new BacktestCandle(timestamp, open, high, low, close, volume));
            }
            rows.sort(Comparator.comparing(BacktestCandle::timestamp));
            return rows;
        } catch (Exception ex) {
            throw new IllegalStateException("Could not parse OANDA candles payload", ex);
        }
    }

    private String mapSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("Symbol is required");
        }
        String normalized = symbol.trim().toUpperCase(Locale.ROOT);
        if (normalized.contains(":")) {
            normalized = normalized.substring(normalized.indexOf(':') + 1);
        }
        if (normalized.contains("_")) {
            return normalized;
        }
        if (normalized.length() == 6) {
            return normalized.substring(0, 3) + "_" + normalized.substring(3, 6);
        }
        return normalized;
    }

    private String mapTimeframe(String timeframe) {
        if (timeframe == null || timeframe.isBlank()) {
            return "M1";
        }
        String normalized = timeframe.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "1", "M1" -> "M1";
            case "5", "M5" -> "M5";
            case "15", "M15" -> "M15";
            default -> throw new IllegalArgumentException("Unsupported timeframe for OANDA provider: " + timeframe);
        };
    }

    private OffsetDateTime parseTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value);
        } catch (Exception ex) {
            return null;
        }
    }

    private BigDecimal parseDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value);
        } catch (Exception ex) {
            return null;
        }
    }
}
