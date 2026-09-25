package com.tradevault.service.marketdata;

import com.tradevault.dto.market.MarketWorkspaceResponse;
import com.tradevault.dto.market.MarketWorkspaceResponse.AvailabilityReason;
import com.tradevault.dto.market.MarketWorkspaceResponse.Freshness;
import com.tradevault.dto.market.MarketWorkspaceResponse.InstrumentQuote;
import com.tradevault.exception.ProviderNotConnectedException;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.repository.AccountRepository;
import com.tradevault.service.backtest.BacktestProviderService;
import com.tradevault.service.backtest.OandaCandleProvider;
import com.tradevault.service.backtest.BacktestRateLimiterService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MarketWorkspaceService {
    private static final String SOURCE_URL = "https://developer.oanda.com/rest-live-v20/pricing-ep/";
    private static final Map<String, String> CANDIDATES = Map.of(
            "GBPUSD", "GBP_USD", "EURUSD", "EUR_USD", "GER40", "DE30_EUR",
            "NAS100", "NAS100_USD", "XAUUSD", "XAU_USD", "USOIL", "WTICO_USD");
    private static final List<String> WATCHLIST = List.of("GBPUSD", "EURUSD", "GER40", "NAS100", "XAUUSD", "USOIL", "DXY", "ES");
    private static final Duration STALE_AFTER = Duration.ofSeconds(15);

    private final AccountRepository accounts;
    private final BacktestProviderService providers;
    private final OandaCandleProvider oanda;
    private final TreasuryYieldProvider treasury;
    private final MarketAnalysisService analysis;
    private final BacktestRateLimiterService rateLimiter;
    private final Map<String, CachedResponse> quoteCache = new java.util.LinkedHashMap<>();
    private java.time.Clock clock = java.time.Clock.systemUTC();

    @Value("${marketdata.user-connected-oanda-display-enabled:false}")
    private boolean displayAuthorized;
    @Value("${marketdata.quote-cache-ttl-ms:1200}")
    private long cacheTtlMs;
    @Value("${marketdata.oanda-candle-derivations-enabled:false}")
    private boolean candleDerivationsEnabled;

    // Fixed stripes serialize concurrent requests without an unbounded map of user locks.
    private final Object[] userLocks = java.util.stream.IntStream.range(0, 64).mapToObj(i -> new Object()).toArray();

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public MarketWorkspaceResponse snapshot(UUID userId, UUID accountId, String selectedInstrument, LocalDate workspaceDate) {
        if (accountId == null || accounts.findByIdAndUserId(accountId, userId).isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Trading account not found");
        synchronized (userLocks[Math.floorMod(userId.hashCode(), userLocks.length)]) {
            return ownedSnapshot(userId, accountId, normalizeSelected(selectedInstrument), workspaceDate);
        }
    }

    private MarketWorkspaceResponse ownedSnapshot(UUID userId, UUID accountId, String selected, LocalDate workspaceDate) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        LocalDate effectiveDate = workspaceDate == null ? now.toLocalDate() : workspaceDate;
        List<MarketWorkspaceResponse.MacroObservation> macro = treasury.latest();
        BacktestProviderService.OandaMarketConnection connection;
        try {
            connection = providers.marketConnection(userId, displayAuthorized);
        } catch (RuntimeException ex) {
            return unavailable(now, selected, null, availabilityReason(ex), macro);
        }
        String environment = connection.environment().name();
        if (!displayAuthorized) return unavailable(now, selected, environment, AvailabilityReason.LICENSE_REQUIRED, macro);
        List<String> capabilities = connection.instruments();
        List<String> symbols = CANDIDATES.values().stream().filter(capabilities::contains).sorted().toList();
        // Only quotes are cached: selected-instrument analysis is composed for every response.
        String key = userId + "|" + accountId + "|" + environment + "|" + connection.accountId() + "|"
                + connection.version() + "|" + String.join(",", symbols);
        CachedResponse cached;
        OffsetDateTime cacheCheckedAt = OffsetDateTime.now(clock);
        synchronized (quoteCache) {
            quoteCache.entrySet().removeIf(e -> !e.getValue().expiresAt().isAfter(cacheCheckedAt));
            cached = quoteCache.get(key);
        }
        List<InstrumentQuote> observations;
        if (cached != null) observations = cached.quotes();
        else {
            AvailabilityReason failure = null;
            Map<String, OandaCandleProvider.OandaQuote> fetched = Map.of();
            if (!symbols.isEmpty()) {
                try {
                    rateLimiter.assertCanFetch(userId);
                    fetched = oanda.getQuotes(connection.token(), connection.accountId(), connection.environment(), symbols);
                } catch (RuntimeException ex) { failure = availabilityReason(ex); }
            }
            OffsetDateTime received = OffsetDateTime.now(clock);
            List<InstrumentQuote> rows = new ArrayList<>();
            for (String symbol : WATCHLIST) {
                String providerSymbol = CANDIDATES.get(symbol);
                if (providerSymbol == null || !capabilities.contains(providerSymbol)) {
                    rows.add(unavailableQuote(symbol, providerSymbol, received, AvailabilityReason.SYMBOL_NOT_SUPPORTED));
                    continue;
                }
                if (failure != null) { rows.add(unavailableQuote(symbol, providerSymbol, received, failure)); continue; }
                var quote = fetched.get(providerSymbol);
                if (!validQuote(quote, providerSymbol, received)) {
                    rows.add(unavailableQuote(symbol, providerSymbol, received, AvailabilityReason.NO_QUOTE));
                    continue;
                }
                BigDecimal mid = quote.bid().add(quote.ask()).divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP);
                Freshness freshness = Duration.between(quote.tsUtc(), received).compareTo(STALE_AFTER) > 0 ? Freshness.STALE
                        : "CLOSE".equals(quote.priceBasis()) || Boolean.FALSE.equals(quote.tradeable()) ? Freshness.CLOSE
                        : Boolean.TRUE.equals(quote.tradeable()) && "MID".equals(quote.priceBasis()) ? Freshness.LIVE : Freshness.INDICATIVE;
                rows.add(new InstrumentQuote(symbol, "OANDA", providerSymbol, instrumentType(symbol), quote.priceBasis(),
                        quote.bid(), quote.ask(), mid, quote.ask().subtract(quote.bid()), unit(symbol), quote.tsUtc(), received,
                        freshness, quote.tradeable(), "USER_CONNECTED", SOURCE_URL, null,
                        Boolean.FALSE.equals(quote.tradeable()) ? AvailabilityReason.MARKET_CLOSED : null));
            }
            observations = List.copyOf(rows);
            long ttl = failure == AvailabilityReason.RATE_LIMIT ? 60_000 : failure != null ? 15_000 : Math.clamp(cacheTtlMs, 1200, 5000);
            synchronized (quoteCache) {
                if (quoteCache.size() >= 256) quoteCache.remove(quoteCache.keySet().iterator().next());
                quoteCache.put(key, new CachedResponse(received.plusNanos(ttl * 1_000_000), observations));
            }
        }
        observations = ageQuotes(observations, OffsetDateTime.now(clock));
        String selectedProvider = CANDIDATES.get(selected);
        var selectedQuote = observations.stream().filter(q -> selected.equals(q.canonicalInstrument())).findFirst().orElse(null);
        MarketWorkspaceResponse.AnalysisMetrics metrics;
        if (selectedProvider == null || !capabilities.contains(selectedProvider))
            metrics = analysis.unavailable(selected, selectedProvider, now, AvailabilityReason.SYMBOL_NOT_SUPPORTED);
        else if (!candleDerivationsEnabled)
            metrics = analysis.unavailable(selected, selectedProvider, now, AvailabilityReason.LICENSE_REQUIRED);
        else if (selectedQuote.mid() == null || selectedQuote.freshness() == Freshness.STALE)
            metrics = analysis.unavailable(selected, selectedProvider, now,
                    selectedQuote.availabilityReason() == null ? AvailabilityReason.NO_QUOTE : selectedQuote.availabilityReason());
        else metrics = analysis.analyze(userId, accountId, connection.token(), connection.accountId(), connection.environment(),
                    selected, selectedProvider, effectiveDate,
                    new OandaCandleProvider.OandaQuote(selectedProvider, selectedQuote.bid(), selectedQuote.ask(),
                            selectedQuote.observedAt(), selectedQuote.tradeable(), selectedQuote.priceBasis()));
        OffsetDateTime completedAt = OffsetDateTime.now(clock);
        return new MarketWorkspaceResponse(completedAt, selected, environment, ageQuotes(observations, completedAt), macro, metrics);
    }

    private List<InstrumentQuote> ageQuotes(List<InstrumentQuote> quotes, OffsetDateTime now) {
        return quotes.stream().map(q -> q.mid() == null || (q.observedAt() != null
                && Duration.between(q.observedAt(), now).compareTo(STALE_AFTER) <= 0) ? q
                : new InstrumentQuote(q.canonicalInstrument(), q.provider(), q.providerSymbol(), q.instrumentType(),
                    q.priceBasis(), q.bid(), q.ask(), q.mid(), q.spread(), q.unit(), q.observedAt(), q.retrievedAt(),
                    Freshness.STALE, q.tradeable(), q.provenance(), q.sourceUrl(), q.delayDescription(), q.availabilityReason())).toList();
    }

    private boolean validQuote(OandaCandleProvider.OandaQuote quote, String symbol, OffsetDateTime now) {
        return quote != null && symbol.equals(quote.instrument()) && quote.tsUtc() != null
                && !quote.tsUtc().isAfter(now.plusSeconds(5)) && quote.bid() != null && quote.ask() != null
                && quote.bid().signum() > 0 && quote.ask().compareTo(quote.bid()) >= 0;
    }

    public MarketWorkspaceResponse snapshot(UUID userId, UUID accountId, String selectedInstrument) {
        return snapshot(userId, accountId, selectedInstrument, null);
    }

    private MarketWorkspaceResponse unavailable(OffsetDateTime now, String selected, String environment, AvailabilityReason reason,
                                                List<MarketWorkspaceResponse.MacroObservation> macro) {
        return new MarketWorkspaceResponse(now, selected, environment,
                WATCHLIST.stream().map(symbol -> unavailableQuote(symbol, CANDIDATES.get(symbol), now,
                        CANDIDATES.containsKey(symbol) ? reason : AvailabilityReason.SYMBOL_NOT_SUPPORTED)).toList(), macro,
                analysis.unavailable(selected, CANDIDATES.get(selected), now, reason));
    }

    private InstrumentQuote unavailableQuote(String symbol, String providerSymbol, OffsetDateTime now, AvailabilityReason reason) {
        return new InstrumentQuote(symbol, "OANDA", providerSymbol, instrumentType(symbol), "MID",
                null, null, null, null, unit(symbol), null, now, Freshness.UNAVAILABLE,
                null, "USER_CONNECTED", SOURCE_URL, null, reason);
    }

    private String normalizeSelected(String raw) {
        if (raw == null || raw.isBlank()) return "GBPUSD";
        String value = raw.trim().toUpperCase();
        if (!WATCHLIST.contains(value) && !"UNSET".equals(value)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported canonical instrument");
        return value;
    }

    private String instrumentType(String symbol) {
        return switch (symbol) {
            case "GBPUSD", "EURUSD" -> "FX";
            case "GER40", "NAS100", "USOIL" -> "CFD";
            case "XAUUSD" -> "METAL";
            case "ES" -> "FUTURE";
            case "DXY" -> "INDEX";
            default -> "UNKNOWN";
        };
    }

    private String unit(String symbol) {
        return switch (symbol) {
            case "GBPUSD", "EURUSD", "XAUUSD", "USOIL", "NAS100" -> "USD";
            case "GER40" -> "EUR";
            default -> "index points";
        };
    }

    private AvailabilityReason availabilityReason(RuntimeException error) {
        if (error instanceof ProviderNotConnectedException) return AvailabilityReason.NO_CREDENTIALS;
        if (error instanceof BacktestDomainException domain) {
            if (domain.getStatus().value() == 401 || domain.getStatus().value() == 403) return AvailabilityReason.PROVIDER_DISCONNECTED;
            if (domain.getStatus().value() == 429 || "RATE_LIMITED".equals(domain.getCode())) return AvailabilityReason.RATE_LIMIT;
            if (domain.getStatus().value() == 504) return AvailabilityReason.UPSTREAM_TIMEOUT;
        }
        return AvailabilityReason.UPSTREAM_ERROR;
    }

    private record CachedResponse(OffsetDateTime expiresAt, List<InstrumentQuote> quotes) {}
}
