package com.tradevault.service.marketdata;

import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.dto.market.MarketWorkspaceResponse;
import com.tradevault.dto.market.MarketWorkspaceResponse.AvailabilityReason;
import com.tradevault.dto.market.MarketWorkspaceResponse.Freshness;
import com.tradevault.dto.market.MarketWorkspaceResponse.InstrumentQuote;
import com.tradevault.exception.ProviderNotConnectedException;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.repository.AccountRepository;
import com.tradevault.service.backtest.BacktestProviderService;
import com.tradevault.service.backtest.OandaCandleProvider;
import com.tradevault.service.backtest.OandaEnvironment;
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
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

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
    private final Map<String, CachedResponse> quoteCache = new ConcurrentHashMap<>();

    @Value("${marketdata.user-connected-oanda-display-enabled:false}")
    private boolean displayAuthorized;
    @Value("${marketdata.quote-cache-ttl-ms:1200}")
    private long cacheTtlMs;
    @Value("${marketdata.oanda-candle-derivations-enabled:false}")
    private boolean candleDerivationsEnabled;

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public MarketWorkspaceResponse snapshot(UUID userId, UUID accountId, String selectedInstrument, LocalDate workspaceDate) {
        if (accountId == null || !accounts.findByIdAndUserId(accountId, userId).isPresent())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Trading account not found");
        String selected = normalizeSelected(selectedInstrument);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        LocalDate effectiveDate = workspaceDate == null ? now.toLocalDate() : workspaceDate;
        quoteCache.entrySet().removeIf(entry -> Duration.between(entry.getValue().createdAt(), now).compareTo(Duration.ofMinutes(2)) > 0);
        List<MarketWorkspaceResponse.MacroObservation> macro = treasury.latest();
        String token;
        try {
            token = providers.requireOandaToken(userId);
        } catch (ProviderNotConnectedException ex) {
            return unavailable(now, selected, null, AvailabilityReason.NO_CREDENTIALS, macro);
        }

        OandaEnvironment environment = providers.resolveOandaEnvironment(userId);
        String providerAccount = providers.resolveOandaSourceId(userId);
        if (providerAccount == null || providerAccount.isBlank())
            return unavailable(now, selected, environment.name(), AvailabilityReason.NO_CREDENTIALS, macro);
        if (!displayAuthorized)
            return unavailable(now, selected, environment.name(), AvailabilityReason.LICENSE_REQUIRED, macro);

        List<String> capabilities;
        try {
            capabilities = providers.resolveFreshOandaInstruments(userId);
        } catch (RuntimeException ex) {
            AvailabilityReason reason = availabilityReason(ex);
            List<InstrumentQuote> failed = WATCHLIST.stream().map(symbol -> unavailableQuote(symbol, CANDIDATES.get(symbol), now, reason)).toList();
            return new MarketWorkspaceResponse(now, selected, environment.name(), failed, macro);
        }
        List<String> canonical = WATCHLIST.stream().filter(CANDIDATES::containsKey)
                .filter(symbol -> capabilities.contains(CANDIDATES.get(symbol))).toList();
        List<String> providerSymbols = canonical.stream().map(CANDIDATES::get).sorted().toList();
        String cacheKey = userId + "|" + accountId + "|OANDA|" + environment + "|" + providerAccount + "|"
                + selected + "|" + effectiveDate + "|" + String.join(",", providerSymbols);
        CachedResponse cached = quoteCache.get(cacheKey);
        if (cached != null && Duration.between(cached.createdAt(), now).toMillis() < Math.max(0, cacheTtlMs))
            return new MarketWorkspaceResponse(now, selected, environment.name(), cached.response().quotes(), macro);

        Map<String, OandaCandleProvider.OandaQuote> fetched;
        try {
            rateLimiter.assertCanFetch(userId);
            fetched = oanda.getQuotes(token, providerAccount, environment, providerSymbols);
        } catch (RuntimeException ex) {
            AvailabilityReason reason = availabilityReason(ex);
            List<InstrumentQuote> failed = WATCHLIST.stream().map(symbol -> unavailableQuote(symbol, null,
                    now, reason)).toList();
            return new MarketWorkspaceResponse(now, selected, environment.name(), failed, macro);
        }
        List<InstrumentQuote> observations = new ArrayList<>();
        OandaCandleProvider.OandaQuote selectedQuote = null;
        for (String symbol : WATCHLIST) {
            String providerSymbol = CANDIDATES.get(symbol);
            if (providerSymbol == null || !capabilities.contains(providerSymbol)) {
                observations.add(unavailableQuote(symbol, providerSymbol, now, AvailabilityReason.SYMBOL_NOT_SUPPORTED));
                continue;
            }
            OandaCandleProvider.OandaQuote quote = fetched.get(providerSymbol);
            if (quote == null) {
                observations.add(unavailableQuote(symbol, providerSymbol, now, AvailabilityReason.MARKET_CLOSED));
                continue;
            }
            if (selected.equals(symbol)) selectedQuote = quote;
            BigDecimal bid = quote.bid();
            BigDecimal ask = quote.ask();
            BigDecimal mid = bid.add(ask).divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP);
            BigDecimal spread = ask.subtract(bid).setScale(8, RoundingMode.HALF_UP);
            Freshness freshness = Boolean.FALSE.equals(quote.tradeable()) ? Freshness.CLOSE
                    : Duration.between(quote.tsUtc(), now).abs().compareTo(STALE_AFTER) <= 0 ? Freshness.LIVE : Freshness.STALE;
            observations.add(new InstrumentQuote(symbol, BacktestCandleSource.OANDA.name(), providerSymbol,
                    instrumentType(symbol), quote.priceBasis(), bid, ask, mid, spread, unit(symbol), quote.tsUtc(), now,
                    freshness, quote.tradeable(), "USER_CONNECTED", SOURCE_URL, null, null));
        }
        MarketWorkspaceResponse.AnalysisMetrics metrics;
        String selectedProvider = CANDIDATES.get(selected);
        if (selectedProvider == null || !capabilities.contains(selectedProvider)) {
            metrics = analysis.unavailable(selected, selectedProvider, now, AvailabilityReason.SYMBOL_NOT_SUPPORTED);
        } else if (!candleDerivationsEnabled) {
            metrics = analysis.unavailable(selected, selectedProvider, now, AvailabilityReason.LICENSE_REQUIRED);
        } else {
            metrics = analysis.analyze(userId, accountId, token, providerAccount, environment, selected, selectedProvider,
                    effectiveDate, selectedQuote);
        }
        MarketWorkspaceResponse response = new MarketWorkspaceResponse(now, selected, environment.name(), List.copyOf(observations), macro, metrics);
        quoteCache.put(cacheKey, new CachedResponse(now, response));
        return response;
    }

    public MarketWorkspaceResponse snapshot(UUID userId, UUID accountId, String selectedInstrument) {
        return snapshot(userId, accountId, selectedInstrument, null);
    }

    private MarketWorkspaceResponse unavailable(OffsetDateTime now, String selected, String environment, AvailabilityReason reason,
                                                List<MarketWorkspaceResponse.MacroObservation> macro) {
        return new MarketWorkspaceResponse(now, selected, environment,
                WATCHLIST.stream().map(symbol -> unavailableQuote(symbol, CANDIDATES.get(symbol), now, reason)).toList(), macro,
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
        if (!WATCHLIST.contains(value)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported canonical instrument");
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
        if (error instanceof BacktestDomainException domain) {
            if (domain.getStatus().value() == 429 || "RATE_LIMITED".equals(domain.getCode())) return AvailabilityReason.RATE_LIMIT;
            if (domain.getStatus().is5xxServerError()) return AvailabilityReason.UPSTREAM_TIMEOUT;
        }
        return AvailabilityReason.UPSTREAM_ERROR;
    }

    private record CachedResponse(OffsetDateTime createdAt, MarketWorkspaceResponse response) {}
}
