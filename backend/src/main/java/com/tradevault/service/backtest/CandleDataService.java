package com.tradevault.service.backtest;

import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.exception.BacktestErrorCodes;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CandleDataService {
    private final CandleChunkStoreService candleChunkStoreService;
    private final OandaCandleProvider oandaCandleProvider;
    private final BacktestProviderService backtestProviderService;
    private final BacktestRateLimiterService backtestRateLimiterService;

    @Value("${backtest.provider.cache-ttl-days:14}")
    private int providerCacheTtlDays;

    @Transactional
    public List<BacktestCandle> getCandles(UUID userId,
                                           String providerRaw,
                                           String sourceIdRaw,
                                           String symbolRaw,
                                           String timeframeRaw,
                                           OffsetDateTime from,
                                           OffsetDateTime to,
                                           boolean refresh) {
        if (userId == null) {
            throw new IllegalArgumentException("User id is required for candle retrieval");
        }
        validateDateRange(from, to);

        BacktestCandleSource provider = parseSource(providerRaw);
        BacktestTimeframe timeframe = parseTimeframe(timeframeRaw);
        String symbolCanonical = canonicalizeSymbol(symbolRaw);
        String symbolDisplay = normalizeSymbolDisplay(symbolRaw, provider, symbolCanonical);
        String sourceId = resolveSourceId(userId, provider, sourceIdRaw);

        if (provider == BacktestCandleSource.OANDA) {
            boolean hasCoverage = !refresh && candleChunkStoreService.hasFreshCoverage(
                    userId,
                    provider,
                    sourceId,
                    symbolCanonical,
                    timeframe,
                    from,
                    to,
                    Duration.ofDays(Math.max(1, providerCacheTtlDays))
            );
            if (!hasCoverage) {
                backtestRateLimiterService.assertCanFetch(userId);
                String token = backtestProviderService.requireOandaToken(userId);
                List<CanonicalCandle> fetched = oandaCandleProvider.getCandles(
                        token,
                        sourceId,
                        symbolCanonical,
                        symbolDisplay,
                        timeframe,
                        from,
                        to
                );
                candleChunkStoreService.saveCandles(
                        userId,
                        provider,
                        sourceId,
                        symbolCanonical,
                        symbolDisplay,
                        timeframe,
                        fetched
                );
            }
        }

        List<CanonicalCandle> candles = candleChunkStoreService.loadCandles(
                userId,
                provider,
                sourceId,
                symbolCanonical,
                timeframe,
                from,
                to
        );

        return candles.stream()
                .sorted(Comparator.comparing(CanonicalCandle::tsUtc))
                .map(CanonicalCandle::toBacktestCandle)
                .toList();
    }

    private BacktestCandleSource parseSource(String value) {
        if (value == null || value.isBlank()) {
            return BacktestCandleSource.OANDA;
        }
        try {
            return BacktestCandleSource.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.UNSUPPORTED_SYMBOL_TIMEFRAME,
                    "Unsupported backtest source: " + value,
                    "Supported sources are CSV, OANDA, and DEMO.",
                    HttpStatus.BAD_REQUEST
            );
        }
    }

    private BacktestTimeframe parseTimeframe(String value) {
        try {
            return BacktestTimeframe.from(value);
        } catch (Exception ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.UNSUPPORTED_SYMBOL_TIMEFRAME,
                    "Unsupported timeframe: " + value,
                    "Supported values are M1, M5, M15, H1, D1.",
                    HttpStatus.BAD_REQUEST
            );
        }
    }

    private String resolveSourceId(UUID userId, BacktestCandleSource source, String sourceIdRaw) {
        String normalized = normalizeOptional(sourceIdRaw);
        if (source == BacktestCandleSource.DEMO) {
            return "DEMO";
        }
        if (source == BacktestCandleSource.OANDA) {
            if (normalized != null) {
                return normalized;
            }
            String accountId = backtestProviderService.resolveOandaSourceId(userId);
            if (accountId != null && !accountId.isBlank()) {
                return accountId;
            }
            return userId.toString();
        }
        if (normalized == null) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.DATASET_NOT_FOUND,
                    "Dataset source id is required",
                    "Select an ingested CSV dataset before loading replay candles.",
                    HttpStatus.BAD_REQUEST
            );
        }
        return normalized;
    }

    private String canonicalizeSymbol(String value) {
        if (value == null || value.isBlank()) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.UNSUPPORTED_SYMBOL_TIMEFRAME,
                    "Symbol is required",
                    "Set a symbol before loading replay candles.",
                    HttpStatus.BAD_REQUEST
            );
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (normalized.contains(":")) {
            normalized = normalized.substring(normalized.indexOf(':') + 1);
        }
        normalized = normalized.replaceAll("[^A-Z0-9]", "");
        if (normalized.isBlank()) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.UNSUPPORTED_SYMBOL_TIMEFRAME,
                    "Invalid symbol",
                    "Use letters/numbers only, for example EURUSD or GER40.",
                    HttpStatus.BAD_REQUEST
            );
        }
        return normalized;
    }

    private String normalizeSymbolDisplay(String raw, BacktestCandleSource provider, String symbolCanonical) {
        String normalizedRaw = normalizeOptional(raw);
        if (normalizedRaw != null) {
            return normalizedRaw.toUpperCase(Locale.ROOT);
        }
        return provider.name() + ":" + symbolCanonical;
    }

    private void validateDateRange(OffsetDateTime from, OffsetDateTime to) {
        if (from == null || to == null) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.UNSUPPORTED_SYMBOL_TIMEFRAME,
                    "from and to are required",
                    "Select a valid date range for replay.",
                    HttpStatus.BAD_REQUEST
            );
        }
        OffsetDateTime normalizedFrom = from.withOffsetSameInstant(ZoneOffset.UTC);
        OffsetDateTime normalizedTo = to.withOffsetSameInstant(ZoneOffset.UTC);
        if (normalizedFrom.isAfter(normalizedTo)) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.UNSUPPORTED_SYMBOL_TIMEFRAME,
                    "from must be before to",
                    "Choose a date range where the start date is before the end date.",
                    HttpStatus.BAD_REQUEST
            );
        }
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isBlank() ? null : normalized;
    }
}
