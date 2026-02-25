package com.tradevault.service;

import com.tradevault.dto.session.QuoteAvailabilityReason;
import com.tradevault.dto.session.LiveQuoteResponse;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.exception.BacktestErrorCodes;
import com.tradevault.exception.ProviderNotConnectedException;
import com.tradevault.service.backtest.BacktestProviderService;
import com.tradevault.service.backtest.OandaCandleProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuoteService {
    private static final Duration CACHE_TTL = Duration.ofMillis(900);
    private static final int QUOTE_SCALE = 8;

    private final CurrentUserService currentUserService;
    private final BacktestProviderService backtestProviderService;
    private final OandaCandleProvider oandaCandleProvider;

    private final Map<String, CachedQuote> cache = new ConcurrentHashMap<>();

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public LiveQuoteResponse getLiveQuote(String symbolRaw) {
        UUID userId = currentUserService.getCurrentUser().getId();
        return getLiveQuoteForUser(userId, symbolRaw);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public LiveQuoteResponse getLiveQuoteForUser(UUID userId, String symbolRaw) {
        String symbol = normalizeSymbol(symbolRaw);
        if (symbol == null) {
            throw new IllegalArgumentException("Symbol is required");
        }
        log.debug("Quote fetch start [userId={}, symbol={}]", userId, symbol);
        String cacheKey = userId + "|" + symbol;
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        CachedQuote cached = cache.get(cacheKey);
        if (cached != null && Duration.between(cached.createdAtUtc(), now).compareTo(CACHE_TTL) < 0) {
            log.debug("Quote cache hit [userId={}, symbol={}]", userId, symbol);
            return cached.response();
        }

        try {
            String token = backtestProviderService.requireOandaToken(userId);
            String sourceId = backtestProviderService.resolveOandaSourceId(userId);
            OandaCandleProvider.OandaQuote quote = oandaCandleProvider.getQuote(token, sourceId, symbol);
            if (quote == null || quote.bid() == null || quote.ask() == null) {
                return unavailable(symbol, QuoteAvailabilityReason.SYMBOL_NOT_SUPPORTED, now, null);
            }

            BigDecimal bid = quote.bid().setScale(QUOTE_SCALE, RoundingMode.HALF_UP);
            BigDecimal ask = quote.ask().setScale(QUOTE_SCALE, RoundingMode.HALF_UP);
            if (ask.compareTo(bid) < 0) {
                return unavailable(symbol, QuoteAvailabilityReason.SYMBOL_NOT_SUPPORTED, now, null);
            }
            BigDecimal spread = ask.subtract(bid).setScale(QUOTE_SCALE, RoundingMode.HALF_UP);
            BigDecimal mid = ask.add(bid)
                    .divide(BigDecimal.valueOf(2), QUOTE_SCALE, RoundingMode.HALF_UP);

            LiveQuoteResponse response = LiveQuoteResponse.builder()
                    .symbol(symbol)
                    .bid(bid)
                    .ask(ask)
                    .mid(mid)
                    .spread(spread)
                    .tsUtc(quote.tsUtc() == null ? now : quote.tsUtc())
                    .source("OANDA")
                    .provider("OANDA")
                    .available(true)
                    .reason(QuoteAvailabilityReason.OK)
                    .build();
            cache.put(cacheKey, new CachedQuote(now, response));
            log.debug("Quote fetch success [userId={}, symbol={}]", userId, symbol);
            return response;
        } catch (ProviderNotConnectedException ex) {
            log.debug(
                    "Quote fetch unavailable [userId={}, symbol={}, code={}, provider={}, reason={}]",
                    userId,
                    symbol,
                    ex.getCode(),
                    ex.getProvider(),
                    ex.getReason()
            );
            return unavailable(symbol, QuoteAvailabilityReason.NO_CREDENTIALS, now, ex.getCode());
        } catch (BacktestDomainException ex) {
            QuoteAvailabilityReason reason = mapReason(ex);
            log.warn(
                    "Quote fetch unavailable [userId={}, symbol={}, code={}, status={}, mappedReason={}, message={}]",
                    userId,
                    symbol,
                    ex.getCode(),
                    ex.getStatus(),
                    reason,
                    ex.getMessage()
            );
            return unavailable(symbol, reason, now, ex.getCode());
        } catch (Exception ex) {
            log.error("Quote fetch failed [userId={}, symbol={}]", userId, symbol, ex);
            return unavailable(symbol, QuoteAvailabilityReason.UPSTREAM_ERROR, now, null);
        }
    }

    private QuoteAvailabilityReason mapReason(BacktestDomainException ex) {
        if (ex == null) {
            return QuoteAvailabilityReason.UPSTREAM_ERROR;
        }

        if ("RATE_LIMITED".equals(ex.getCode()) || (ex.getStatus() != null && ex.getStatus().value() == 429)) {
            return QuoteAvailabilityReason.RATE_LIMIT;
        }
        if (BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONFIGURED.equals(ex.getCode())) {
            return QuoteAvailabilityReason.NO_PROVIDER;
        }
        if (BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED.equals(ex.getCode())) {
            return QuoteAvailabilityReason.NO_CREDENTIALS;
        }
        if (BacktestErrorCodes.UNSUPPORTED_SYMBOL_TIMEFRAME.equals(ex.getCode())) {
            return QuoteAvailabilityReason.SYMBOL_NOT_SUPPORTED;
        }
        return QuoteAvailabilityReason.UPSTREAM_ERROR;
    }

    private LiveQuoteResponse unavailable(String symbol, QuoteAvailabilityReason reason, OffsetDateTime now, String code) {
        return LiveQuoteResponse.builder()
                .symbol(symbol)
                .source("OANDA")
                .provider("OANDA")
                .code(code)
                .available(false)
                .tsUtc(now)
                .reason(reason)
                .build();
    }

    private String normalizeSymbol(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return normalized.isBlank() ? null : normalized;
    }

    private record CachedQuote(OffsetDateTime createdAtUtc, LiveQuoteResponse response) {
    }
}
