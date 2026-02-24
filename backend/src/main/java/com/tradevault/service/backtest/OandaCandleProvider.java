package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.exception.BacktestErrorCodes;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OandaCandleProvider {
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final Map<String, String> INDEX_SYMBOL_MAP = Map.of(
            "GER40", "DE30_EUR",
            "DE40", "DE30_EUR",
            "NAS100", "NAS100_USD",
            "US30", "US30_USD"
    );

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${backtest.oanda.base-url:https://api-fxpractice.oanda.com/v3}")
    private String baseUrl;

    public OandaConnectionResult testConnection(String token) {
        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/accounts")
                .toUriString();
        String payload = executeGet(url, token);

        try {
            JsonNode root = objectMapper.readTree(payload == null ? "{}" : payload);
            JsonNode accounts = root.path("accounts");
            String accountId = null;
            if (accounts.isArray() && !accounts.isEmpty()) {
                accountId = trimToNull(accounts.get(0).path("id").asText(null));
            }
            return new OandaConnectionResult(true, accountId);
        } catch (Exception ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                    "Could not parse OANDA connection response",
                    "Verify that your OANDA token is valid for a practice account.",
                    org.springframework.http.HttpStatus.BAD_REQUEST
            );
        }
    }

    public List<CanonicalCandle> getCandles(String token,
                                            String sourceId,
                                            String symbolCanonical,
                                            String symbolDisplay,
                                            BacktestTimeframe timeframe,
                                            OffsetDateTime from,
                                            OffsetDateTime to) {
        String instrument = mapSymbol(symbolCanonical);
        String granularity = mapTimeframe(timeframe);

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/instruments/{instrument}/candles")
                .queryParam("price", "M")
                .queryParam("granularity", granularity)
                .queryParam("from", ISO.format(from.withOffsetSameInstant(ZoneOffset.UTC)))
                .queryParam("to", ISO.format(to.withOffsetSameInstant(ZoneOffset.UTC)))
                .queryParam("alignmentTimezone", "UTC")
                .buildAndExpand(instrument)
                .toUriString();

        String payload = executeGet(url, token);
        if (payload == null || payload.isBlank()) {
            return List.of();
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode candles = root.path("candles");
            if (!candles.isArray()) {
                return List.of();
            }

            List<CanonicalCandle> rows = new ArrayList<>();
            for (JsonNode item : candles) {
                if (!item.path("complete").asBoolean(true)) {
                    continue;
                }
                OffsetDateTime timestamp = parseTime(item.path("time").asText(null));
                JsonNode mid = item.path("mid");
                BigDecimal open = parseDecimal(mid.path("o").asText(null));
                BigDecimal high = parseDecimal(mid.path("h").asText(null));
                BigDecimal low = parseDecimal(mid.path("l").asText(null));
                BigDecimal close = parseDecimal(mid.path("c").asText(null));
                BigDecimal volume = parseDecimal(item.path("volume").asText(null));
                if (timestamp == null || open == null || high == null || low == null || close == null) {
                    continue;
                }
                rows.add(new CanonicalCandle(
                        BacktestCandleSource.OANDA,
                        sourceId,
                        symbolCanonical,
                        symbolDisplay,
                        timeframe,
                        timestamp,
                        open,
                        high,
                        low,
                        close,
                        volume
                ));
            }
            rows.sort(Comparator.comparing(CanonicalCandle::tsUtc));
            return rows;
        } catch (BacktestDomainException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                    "Could not parse OANDA candles payload",
                    "Try again in a moment or verify symbol/timeframe compatibility.",
                    org.springframework.http.HttpStatus.BAD_REQUEST
            );
        }
    }

    public OandaQuote getQuote(String token, String sourceId, String symbolCanonical) {
        String accountId = resolveAccountId(token, sourceId);
        String instrument = mapSymbol(symbolCanonical);

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/accounts/{accountId}/pricing")
                .queryParam("instruments", instrument)
                .buildAndExpand(accountId)
                .toUriString();

        String payload = executeGet(url, token);
        if (payload == null || payload.isBlank()) {
            return null;
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode prices = root.path("prices");
            if (!prices.isArray() || prices.isEmpty()) {
                return null;
            }
            JsonNode quote = prices.get(0);

            BigDecimal bid = null;
            JsonNode bids = quote.path("bids");
            if (bids.isArray() && !bids.isEmpty()) {
                bid = parseDecimal(bids.get(0).path("price").asText(null));
            }

            BigDecimal ask = null;
            JsonNode asks = quote.path("asks");
            if (asks.isArray() && !asks.isEmpty()) {
                ask = parseDecimal(asks.get(0).path("price").asText(null));
            }

            OffsetDateTime ts = parseTime(quote.path("time").asText(null));
            if (bid == null || ask == null) {
                return null;
            }

            return new OandaQuote(
                    instrument,
                    bid,
                    ask,
                    ts == null ? OffsetDateTime.now(ZoneOffset.UTC) : ts
            );
        } catch (Exception ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                    "Could not parse OANDA quote payload",
                    "Try again in a moment or verify symbol compatibility.",
                    org.springframework.http.HttpStatus.BAD_REQUEST
            );
        }
    }

    private String resolveAccountId(String token, String sourceId) {
        String normalizedSourceId = trimToNull(sourceId);
        if (normalizedSourceId != null) {
            return normalizedSourceId;
        }
        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl)
                .path("/accounts")
                .toUriString();
        String payload = executeGet(url, token);
        try {
            JsonNode root = objectMapper.readTree(payload == null ? "{}" : payload);
            JsonNode accounts = root.path("accounts");
            if (accounts.isArray() && !accounts.isEmpty()) {
                String accountId = trimToNull(accounts.get(0).path("id").asText(null));
                if (accountId != null) {
                    return accountId;
                }
            }
        } catch (Exception ignored) {
            // fall through
        }
        throw new BacktestDomainException(
                BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                "OANDA account id could not be resolved",
                "Reconnect OANDA from Settings -> Data Providers.",
                org.springframework.http.HttpStatus.FORBIDDEN
        );
    }

    private String executeGet(String url, String token) {
        if (token == null || token.isBlank()) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                    "OANDA token is not connected",
                    "Connect OANDA from Settings -> Data Providers.",
                    org.springframework.http.HttpStatus.FORBIDDEN
            );
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.trim());
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            org.springframework.http.HttpStatusCode statusCode = ex.getStatusCode();
            if (statusCode.value() == 401 || statusCode.value() == 403) {
                throw new BacktestDomainException(
                        BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                        "OANDA rejected the provided token",
                        "Reconnect your OANDA practice token from Settings -> Data Providers.",
                        org.springframework.http.HttpStatus.FORBIDDEN
                );
            }
            if (statusCode.value() == 429) {
                throw new BacktestDomainException(
                        "RATE_LIMITED",
                        "OANDA rate limit reached",
                        "Wait a bit before requesting another backtest range.",
                        org.springframework.http.HttpStatus.TOO_MANY_REQUESTS
                );
            }
            throw new BacktestDomainException(
                    BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                    "Could not query OANDA candles",
                    "Check token permissions and retry.",
                    org.springframework.http.HttpStatus.BAD_REQUEST
            );
        } catch (RestClientException ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                    "Could not reach OANDA service",
                    "Check network connectivity or retry shortly.",
                    org.springframework.http.HttpStatus.BAD_GATEWAY
            );
        }
    }

    private String mapSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.UNSUPPORTED_SYMBOL_TIMEFRAME,
                    "Symbol is required",
                    "Enter a symbol like EURUSD, OANDA:EURUSD, or GER40.",
                    org.springframework.http.HttpStatus.BAD_REQUEST
            );
        }
        String normalized = symbol.trim().toUpperCase(Locale.ROOT);
        if (normalized.contains(":")) {
            normalized = normalized.substring(normalized.indexOf(':') + 1);
        }
        String mappedIndex = INDEX_SYMBOL_MAP.get(normalized);
        if (mappedIndex != null) {
            return mappedIndex;
        }
        if (normalized.contains("_")) {
            return normalized;
        }
        if (normalized.length() == 6) {
            return normalized.substring(0, 3) + "_" + normalized.substring(3, 6);
        }
        return normalized;
    }

    private String mapTimeframe(BacktestTimeframe timeframe) {
        return switch (timeframe) {
            case M1 -> "M1";
            case M5 -> "M5";
            case M15 -> "M15";
            case H1 -> "H1";
            case H4 -> "H4";
            case D1 -> "D";
            case W1 -> "W";
        };
    }

    private OffsetDateTime parseTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value).withOffsetSameInstant(ZoneOffset.UTC);
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

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    public record OandaConnectionResult(boolean connected, String accountId) {
    }

    public record OandaQuote(String instrument, BigDecimal bid, BigDecimal ask, OffsetDateTime tsUtc) {
    }
}
