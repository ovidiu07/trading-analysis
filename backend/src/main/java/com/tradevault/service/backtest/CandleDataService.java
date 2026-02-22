package com.tradevault.service.backtest;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.CandleCache;
import com.tradevault.repository.CandleCacheRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CandleDataService {
    private static final TypeReference<List<BacktestCandle>> CANDLE_LIST = new TypeReference<>() {};

    private final CandleCacheRepository candleCacheRepository;
    private final List<CandleProvider> candleProviders;
    private final ObjectMapper objectMapper;

    @Transactional
    public List<BacktestCandle> getCandles(String provider,
                                           String symbol,
                                           String timeframe,
                                           OffsetDateTime from,
                                           OffsetDateTime to,
                                           boolean refresh) {
        String resolvedProvider = normalizeProvider(provider);
        String normalizedSymbol = normalizeSymbol(symbol);
        String normalizedTimeframe = normalizeTimeframe(timeframe);

        if (!refresh) {
            var cached = candleCacheRepository.findByProviderAndSymbolAndTimeframeAndRangeFromAndRangeTo(
                    resolvedProvider,
                    normalizedSymbol,
                    normalizedTimeframe,
                    from,
                    to
            );
            if (cached.isPresent()) {
                return readCandlesPayload(cached.get().getPayload());
            }
        }

        CandleProvider candleProvider = resolveProvider(resolvedProvider);
        List<BacktestCandle> candles = candleProvider.getCandles(normalizedSymbol, normalizedTimeframe, from, to)
                .stream()
                .sorted(Comparator.comparing(BacktestCandle::timestamp))
                .toList();

        CandleCache cache = candleCacheRepository.findByProviderAndSymbolAndTimeframeAndRangeFromAndRangeTo(
                        resolvedProvider,
                        normalizedSymbol,
                        normalizedTimeframe,
                        from,
                        to
                )
                .orElseGet(() -> CandleCache.builder()
                        .provider(resolvedProvider)
                        .symbol(normalizedSymbol)
                        .timeframe(normalizedTimeframe)
                        .rangeFrom(from)
                        .rangeTo(to)
                        .build());
        cache.setPayload(writeCandlesPayload(candles));
        candleCacheRepository.save(cache);
        return candles;
    }

    public List<BacktestCandle> readCandlesPayload(String payload) {
        if (payload == null || payload.isBlank()) {
            return List.of();
        }
        try {
            List<BacktestCandle> candles = objectMapper.readValue(payload, CANDLE_LIST);
            if (candles == null) {
                return List.of();
            }
            return candles.stream().sorted(Comparator.comparing(BacktestCandle::timestamp)).toList();
        } catch (Exception ex) {
            return List.of();
        }
    }

    public String writeCandlesPayload(List<BacktestCandle> candles) {
        try {
            return objectMapper.writeValueAsString(candles == null ? List.of() : candles);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not serialize candles payload", ex);
        }
    }

    private CandleProvider resolveProvider(String providerKey) {
        Map<String, CandleProvider> byKey = new HashMap<>();
        for (CandleProvider provider : candleProviders) {
            byKey.put(provider.providerKey().toUpperCase(Locale.ROOT), provider);
        }
        CandleProvider resolved = byKey.get(providerKey.toUpperCase(Locale.ROOT));
        if (resolved == null) {
            throw new IllegalArgumentException("Unsupported candle provider: " + providerKey);
        }
        return resolved;
    }

    private String normalizeProvider(String provider) {
        if (provider == null || provider.isBlank()) {
            return "OANDA";
        }
        return provider.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("Symbol is required");
        }
        return symbol.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeTimeframe(String timeframe) {
        if (timeframe == null || timeframe.isBlank()) {
            return "M1";
        }
        return timeframe.trim().toUpperCase(Locale.ROOT);
    }
}
