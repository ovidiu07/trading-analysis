package com.tradevault.service;

import com.tradevault.dto.session.LiveQuoteResponse;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.service.backtest.BacktestProviderService;
import com.tradevault.service.backtest.OandaCandleProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
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
public class QuoteService {
    private static final Duration CACHE_TTL = Duration.ofMillis(900);
    private static final int QUOTE_SCALE = 8;

    private final CurrentUserService currentUserService;
    private final BacktestProviderService backtestProviderService;
    private final OandaCandleProvider oandaCandleProvider;

    private final Map<String, CachedQuote> cache = new ConcurrentHashMap<>();

    @Transactional(readOnly = true)
    public LiveQuoteResponse getLiveQuote(String symbolRaw) {
        UUID userId = currentUserService.getCurrentUser().getId();
        return getLiveQuoteForUser(userId, symbolRaw);
    }

    @Transactional(readOnly = true)
    public LiveQuoteResponse getLiveQuoteForUser(UUID userId, String symbolRaw) {
        String symbol = normalizeSymbol(symbolRaw);
        if (symbol == null) {
            throw new IllegalArgumentException("Symbol is required");
        }
        String cacheKey = userId + "|" + symbol;
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        CachedQuote cached = cache.get(cacheKey);
        if (cached != null && Duration.between(cached.createdAtUtc(), now).compareTo(CACHE_TTL) < 0) {
            return cached.response();
        }

        try {
            String token = backtestProviderService.requireOandaToken(userId);
            String sourceId = backtestProviderService.resolveOandaSourceId(userId);
            OandaCandleProvider.OandaQuote quote = oandaCandleProvider.getQuote(token, sourceId, symbol);
            if (quote == null || quote.bid() == null || quote.ask() == null) {
                return unavailable(symbol, "Spread unavailable for this symbol");
            }

            BigDecimal bid = quote.bid().setScale(QUOTE_SCALE, RoundingMode.HALF_UP);
            BigDecimal ask = quote.ask().setScale(QUOTE_SCALE, RoundingMode.HALF_UP);
            if (ask.compareTo(bid) < 0) {
                return unavailable(symbol, "Spread unavailable for this symbol");
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
                    .available(true)
                    .reason(null)
                    .build();
            cache.put(cacheKey, new CachedQuote(now, response));
            return response;
        } catch (BacktestDomainException ex) {
            return unavailable(symbol, ex.getMessage());
        }
    }

    private LiveQuoteResponse unavailable(String symbol, String reason) {
        return LiveQuoteResponse.builder()
                .symbol(symbol)
                .source("OANDA")
                .available(false)
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
