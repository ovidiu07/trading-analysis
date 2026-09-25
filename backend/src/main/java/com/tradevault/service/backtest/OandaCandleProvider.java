package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.exception.BacktestErrorCodes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.time.Instant;

@Service
public class OandaCandleProvider {
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final Map<String, String> INDEX_SYMBOL_MAP = Map.of(
            "GER40", "DE30_EUR",
            "DE40", "DE30_EUR",
            "NAS100", "NAS100_USD",
            "USOIL", "WTICO_USD",
            "US30", "US30_USD"
    );

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final Map<String, CircuitState> circuits = new ConcurrentHashMap<>();
    private static RestTemplate boundedClient() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        return new RestTemplate(factory);
    }

    @Autowired
    public OandaCandleProvider(ObjectMapper objectMapper) {
        this(objectMapper, boundedClient());
    }

    OandaCandleProvider(ObjectMapper objectMapper, RestTemplate restTemplate) {
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplate;
    }

    @Value("${backtest.oanda.base-url:https://api-fxpractice.oanda.com/v3}")
    private String baseUrl;

    @Value("${backtest.oanda.practice-base-url:${backtest.oanda.base-url:https://api-fxpractice.oanda.com/v3}}")
    private String practiceBaseUrl;

    @Value("${backtest.oanda.live-base-url:https://api-fxtrade.oanda.com/v3}")
    private String liveBaseUrl;

    public OandaConnectionResult testConnection(String token) {
        return testConnection(token, OandaEnvironment.PRACTICE);
    }

    public OandaConnectionResult testConnection(String token, OandaEnvironment environment) {
        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl(environment))
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
                    "Verify that the OANDA token is valid for the selected account environment.",
                    org.springframework.http.HttpStatus.BAD_REQUEST
            );
        }
    }

    public List<String> listInstruments(String token, String accountId, OandaEnvironment environment) {
        if (accountId == null || accountId.isBlank()) return List.of();
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl(environment))
                .path("/accounts/{accountId}/instruments")
                .buildAndExpand(accountId).toUriString();
        String payload = executeGet(url, token);
        try {
            JsonNode instruments = objectMapper.readTree(payload == null ? "{}" : payload).path("instruments");
            if (!instruments.isArray()) throw new IllegalArgumentException("Missing instruments");
            List<String> names = new ArrayList<>();
            for (JsonNode item : instruments) {
                String name = trimToNull(item.path("name").asText(null));
                if (name != null && name.matches("[A-Z0-9]{2,16}_[A-Z0-9]{2,16}")) names.add(name);
            }
            return names.stream().distinct().sorted().toList();
        } catch (Exception ex) {
            throw new BacktestDomainException(BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                    "Could not parse OANDA instrument capabilities", "Retest the OANDA connection.",
                    org.springframework.http.HttpStatus.BAD_GATEWAY);
        }
    }

    public Map<String, OandaQuote> getQuotes(String token, String accountId, OandaEnvironment environment,
                                              Collection<String> providerSymbols) {
        if (providerSymbols == null || providerSymbols.isEmpty()) return Map.of();
        List<String> symbols = providerSymbols.stream().filter(s -> s != null && s.matches("[A-Z0-9]{2,16}_[A-Z0-9]{2,16}"))
                .distinct().sorted().toList();
        if (symbols.isEmpty()) return Map.of();
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl(environment))
                .path("/accounts/{accountId}/pricing").queryParam("instruments", String.join(",", symbols))
                .buildAndExpand(accountId).toUriString();
        String payload = executeGet(url, token);
        try {
            JsonNode prices = objectMapper.readTree(payload == null ? "{}" : payload).path("prices");
            Map<String, OandaQuote> result = new LinkedHashMap<>();
            if (!prices.isArray()) throw new IllegalArgumentException("Missing prices");
            for (JsonNode price : prices) {
                String instrument = price.path("instrument").asText("");
                BigDecimal bid = firstPrice(price.path("bids"));
                BigDecimal ask = firstPrice(price.path("asks"));
                boolean closePrice = bid == null || ask == null;
                if (closePrice) {
                    bid = parseDecimal(price.path("closeoutBid").asText(null));
                    ask = parseDecimal(price.path("closeoutAsk").asText(null));
                }
                OffsetDateTime observedAt = parseTime(price.path("time").asText(null));
                if (symbols.contains(instrument) && bid != null && ask != null && bid.signum() > 0 && ask.compareTo(bid) >= 0 && observedAt != null) {
                    String providerStatus = price.path("status").asText("");
                    if ("invalid".equalsIgnoreCase(providerStatus)) continue;
                    Boolean tradeable = price.path("tradeable").isBoolean() ? price.path("tradeable").booleanValue()
                            : providerStatus.isBlank() ? null : "tradeable".equalsIgnoreCase(providerStatus);
                    result.put(instrument, new OandaQuote(instrument, bid, ask, observedAt,
                            tradeable, closePrice ? "CLOSEOUT_MID" : "MID"));
                }
            }
            return result;
        } catch (Exception ex) {
            throw new BacktestDomainException(BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                    "Could not parse OANDA batch pricing response", "Retry the market data request.",
                    org.springframework.http.HttpStatus.BAD_GATEWAY);
        }
    }

    private BigDecimal firstPrice(JsonNode levels) {
        return levels.isArray() && !levels.isEmpty() ? parseDecimal(levels.get(0).path("price").asText(null)) : null;
    }

    private String baseUrl(OandaEnvironment environment) {
        return environment == OandaEnvironment.LIVE ? liveBaseUrl : practiceBaseUrl;
    }

    public List<CanonicalCandle> getCandles(String token,
                                            String sourceId,
                                            String symbolCanonical,
                                            String symbolDisplay,
                                            BacktestTimeframe timeframe,
                                            OffsetDateTime from,
                                            OffsetDateTime to) {
        return getCandles(token, sourceId, symbolCanonical, symbolDisplay, timeframe, from, to, OandaEnvironment.PRACTICE);
    }

    public List<CanonicalCandle> getCandles(String token,
                                            String sourceId,
                                            String symbolCanonical,
                                            String symbolDisplay,
                                            BacktestTimeframe timeframe,
                                            OffsetDateTime from,
                                            OffsetDateTime to,
                                            OandaEnvironment environment) {
        String instrument = mapSymbol(symbolCanonical);
        String granularity = mapTimeframe(timeframe);

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl(environment))
                .path("/instruments/{instrument}/candles")
                .queryParam("price", "M")
                .queryParam("granularity", granularity)
                .queryParam("from", ISO.format(from.withOffsetSameInstant(ZoneOffset.UTC)))
                .queryParam("to", ISO.format(to.withOffsetSameInstant(ZoneOffset.UTC)))
                .queryParam("dailyAlignment", 17)
                .queryParam("alignmentTimezone", "America/New_York")
                .buildAndExpand(instrument)
                .toUriString();

        String payload = executeGet(url, token);
        if (payload == null || payload.isBlank()) {
            return List.of();
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            if (!instrument.equals(root.path("instrument").asText()) || !granularity.equals(root.path("granularity").asText())) {
                throw new IllegalArgumentException("Candle response does not match the requested instrument and timeframe");
            }
            JsonNode candles = root.path("candles");
            if (!candles.isArray()) {
                return List.of();
            }

            List<CanonicalCandle> rows = new ArrayList<>();
            for (JsonNode item : candles) {
                if (!item.path("complete").isBoolean() || !item.path("complete").booleanValue()) {
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
        return getQuote(token, sourceId, symbolCanonical, OandaEnvironment.PRACTICE);
    }

    public OandaQuote getQuote(String token, String sourceId, String symbolCanonical, OandaEnvironment environment) {
        String accountId = resolveAccountId(token, sourceId, environment);
        String instrument = mapSymbol(symbolCanonical);

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl(environment))
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

    private String resolveAccountId(String token, String sourceId) { return resolveAccountId(token, sourceId, OandaEnvironment.PRACTICE); }

    private String resolveAccountId(String token, String sourceId, OandaEnvironment environment) {
        String normalizedSourceId = trimToNull(sourceId);
        if (normalizedSourceId != null) {
            return normalizedSourceId;
        }
        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl(environment))
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

        String host = java.net.URI.create(url).getHost();
        CircuitState circuit = circuits.computeIfAbsent(host, ignored -> new CircuitState());
        if (circuit.isOpen()) throw new BacktestDomainException("UPSTREAM_CIRCUIT_OPEN", "OANDA is temporarily unavailable",
                "Retry after the provider cooldown.", org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.trim());
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
                circuit.success();
                return response.getBody();
            } catch (HttpStatusCodeException ex) {
                int status = ex.getStatusCode().value();
                if (status == 401 || status == 403) throw new BacktestDomainException(
                        BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED, "OANDA rejected the provided token",
                        "Reconnect the OANDA credential from Settings -> Data Providers.", org.springframework.http.HttpStatus.FORBIDDEN);
                if (status == 429) throw new BacktestDomainException("RATE_LIMITED", "OANDA rate limit reached",
                        "Wait before requesting another provider snapshot.", org.springframework.http.HttpStatus.TOO_MANY_REQUESTS);
                if (status >= 500 && attempt == 0) { pauseBeforeRetry(attempt); continue; }
                circuit.failure();
                throw new BacktestDomainException(BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                        "Could not query OANDA", "Check provider availability and retry.", org.springframework.http.HttpStatus.BAD_GATEWAY);
            } catch (RestClientException ex) {
                if (attempt == 0) { pauseBeforeRetry(attempt); continue; }
                circuit.failure();
                throw new BacktestDomainException(BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                        "Could not reach OANDA service", "Check network connectivity or retry shortly.", org.springframework.http.HttpStatus.GATEWAY_TIMEOUT);
            }
        }
        throw new IllegalStateException("Unreachable provider retry state");
    }

    private void pauseBeforeRetry(int attempt) {
        long delayMillis = 150L * (1L << attempt) + ThreadLocalRandom.current().nextLong(50L, 151L);
        try { Thread.sleep(delayMillis); }
        catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new IllegalStateException("Provider retry interrupted", ex); }
    }

    private static final class CircuitState {
        private int failures;
        private Instant openUntil;
        synchronized boolean isOpen() { return openUntil != null && Instant.now().isBefore(openUntil); }
        synchronized void success() { failures = 0; openUntil = null; }
        synchronized void failure() { if (++failures >= 5) { openUntil = Instant.now().plusSeconds(30); failures = 0; } }
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

    public record OandaQuote(String instrument, BigDecimal bid, BigDecimal ask, OffsetDateTime tsUtc, Boolean tradeable, String priceBasis) {
        public OandaQuote(String instrument, BigDecimal bid, BigDecimal ask, OffsetDateTime tsUtc) {
            this(instrument, bid, ask, tsUtc, null, "MID");
        }
        public OandaQuote(String instrument, BigDecimal bid, BigDecimal ask, OffsetDateTime tsUtc, Boolean tradeable) {
            this(instrument, bid, ask, tsUtc, tradeable, "MID");
        }
    }
}
