package com.tradevault.service.backtest;

import com.tradevault.domain.entity.CandleChunk;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.domain.enums.CandleChunkFormat;
import com.tradevault.repository.CandleChunkRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CandleChunkStoreService {
    private static final Logger log = LoggerFactory.getLogger(CandleChunkStoreService.class);

    private final CandleChunkRepository candleChunkRepository;
    private final CandleChunkCodec candleChunkCodec;

    @Transactional
    public void saveCandles(UUID userId,
                            BacktestCandleSource provider,
                            String sourceId,
                            String symbolCanonical,
                            String symbolDisplay,
                            BacktestTimeframe timeframe,
                            List<CanonicalCandle> candles) {
        if (candles == null || candles.isEmpty()) {
            return;
        }

        Map<OffsetDateTime, List<CanonicalCandle>> byChunk = new LinkedHashMap<>();
        for (CanonicalCandle candle : candles) {
            OffsetDateTime ts = candle.tsUtc();
            if (ts == null) {
                continue;
            }
            OffsetDateTime chunkStart = toChunkStart(ts.withOffsetSameInstant(ZoneOffset.UTC), timeframe);
            byChunk.computeIfAbsent(chunkStart, ignored -> new ArrayList<>()).add(candle);
        }

        for (Map.Entry<OffsetDateTime, List<CanonicalCandle>> entry : byChunk.entrySet()) {
            OffsetDateTime chunkStart = entry.getKey();
            List<CanonicalCandle> incoming = entry.getValue();

            CandleChunk chunk = candleChunkRepository
                    .findByUser_IdAndProviderAndSourceIdAndSymbolCanonicalAndTimeframeAndChunkStartUtc(
                            userId,
                            provider,
                            sourceId,
                            symbolCanonical,
                            timeframe,
                            chunkStart
                    )
                    .orElseGet(() -> CandleChunk.builder()
                            .user(User.builder().id(userId).build())
                            .provider(provider)
                            .sourceId(sourceId)
                            .symbolCanonical(symbolCanonical)
                            .symbolDisplay(symbolDisplay)
                            .timeframe(timeframe)
                            .chunkStartUtc(chunkStart)
                            .format(CandleChunkFormat.JSON_GZIP)
                            .build());

            List<CanonicalCandle> merged = mergeCandles(
                    candleChunkCodec.decode(chunk.getPayload(), provider, sourceId, symbolCanonical, symbolDisplay, timeframe),
                    incoming
            );
            if (merged.isEmpty()) {
                continue;
            }

            chunk.setSymbolDisplay(symbolDisplay);
            chunk.setChunkEndUtc(merged.get(merged.size() - 1).tsUtc());
            byte[] payload = candleChunkCodec.encode(merged);
            assertStorageReference(payload, chunk.getObjectKey(), provider, sourceId, symbolCanonical, timeframe, chunkStart);
            chunk.setPayload(payload);
            chunk.setObjectKey(null);
            chunk.setFormat(CandleChunkFormat.JSON_GZIP);

            if (log.isDebugEnabled()) {
                log.debug(
                        "Persisting candle chunk provider={} sourceId={} symbol={} timeframe={} chunkStart={} chunkEnd={} payloadLength={}",
                        provider,
                        sourceId,
                        symbolCanonical,
                        timeframe,
                        chunkStart,
                        chunk.getChunkEndUtc(),
                        payload.length
                );
            }

            candleChunkRepository.save(chunk);
        }
    }

    @Transactional(readOnly = true)
    public List<CanonicalCandle> loadCandles(UUID userId,
                                             BacktestCandleSource provider,
                                             String sourceId,
                                             String symbolCanonical,
                                             BacktestTimeframe timeframe,
                                             OffsetDateTime from,
                                             OffsetDateTime to) {
        List<CandleChunk> chunks = candleChunkRepository
                .findByUser_IdAndProviderAndSourceIdAndSymbolCanonicalAndTimeframeAndChunkEndUtcGreaterThanEqualAndChunkStartUtcLessThanEqualOrderByChunkStartUtcAsc(
                        userId,
                        provider,
                        sourceId,
                        symbolCanonical,
                        timeframe,
                        from,
                        to
                );
        if (log.isDebugEnabled()) {
            log.debug(
                    "Candle chunk lookup [table=candle_chunks, userId={}, provider={}, sourceId={}, symbolCanonical={}, timeframe={}, fromUtc={} ({}), toUtc={} ({}), chunkRows={}]",
                    userId,
                    provider,
                    sourceId,
                    symbolCanonical,
                    timeframe,
                    from,
                    from == null ? "null" : from.getClass().getSimpleName(),
                    to,
                    to == null ? "null" : to.getClass().getSimpleName(),
                    chunks.size()
            );
        }

        List<CanonicalCandle> candles = new ArrayList<>();
        int decodedCandles = 0;
        for (CandleChunk chunk : chunks) {
            List<CanonicalCandle> decoded = candleChunkCodec.decode(
                    chunk.getPayload(),
                    chunk.getProvider(),
                    chunk.getSourceId(),
                    chunk.getSymbolCanonical(),
                    chunk.getSymbolDisplay(),
                    chunk.getTimeframe()
            );
            decodedCandles += decoded.size();
            candles.addAll(decoded);
        }
        List<CanonicalCandle> filtered = candles.stream()
                .filter(item -> item.tsUtc() != null)
                .filter(item -> !item.tsUtc().isBefore(from) && !item.tsUtc().isAfter(to))
                .sorted(Comparator.comparing(CanonicalCandle::tsUtc))
                .toList();
        if (log.isDebugEnabled()) {
            log.debug(
                    "Candle chunk decode result [provider={}, sourceId={}, symbolCanonical={}, timeframe={}, decodedCandles={}, filteredCandles={}]",
                    provider,
                    sourceId,
                    symbolCanonical,
                    timeframe,
                    decodedCandles,
                    filtered.size()
            );
        }
        return filtered;
    }

    @Transactional(readOnly = true)
    public boolean hasFreshCoverage(UUID userId,
                                    BacktestCandleSource provider,
                                    String sourceId,
                                    String symbolCanonical,
                                    BacktestTimeframe timeframe,
                                    OffsetDateTime from,
                                    OffsetDateTime to,
                                    Duration ttl) {
        if (ttl == null || ttl.isNegative() || ttl.isZero()) {
            return false;
        }

        OffsetDateTime firstChunkStart = toChunkStart(from.withOffsetSameInstant(ZoneOffset.UTC), timeframe);
        OffsetDateTime lastChunkStart = toChunkStart(to.withOffsetSameInstant(ZoneOffset.UTC), timeframe);

        List<CandleChunk> stored = candleChunkRepository
                .findByUser_IdAndProviderAndSourceIdAndSymbolCanonicalAndTimeframeAndChunkStartUtcBetweenOrderByChunkStartUtcAsc(
                        userId,
                        provider,
                        sourceId,
                        symbolCanonical,
                        timeframe,
                        firstChunkStart,
                        lastChunkStart
                );

        Map<OffsetDateTime, CandleChunk> byChunkStart = new LinkedHashMap<>();
        for (CandleChunk chunk : stored) {
            byChunkStart.put(chunk.getChunkStartUtc(), chunk);
        }

        OffsetDateTime cursor = firstChunkStart;
        OffsetDateTime staleCutoff = OffsetDateTime.now(ZoneOffset.UTC).minus(ttl);
        while (!cursor.isAfter(lastChunkStart)) {
            CandleChunk chunk = byChunkStart.get(cursor);
            OffsetDateTime freshness = chunk == null ? null : (chunk.getUpdatedAt() != null ? chunk.getUpdatedAt() : chunk.getCreatedAt());
            if (chunk == null || freshness == null || freshness.isBefore(staleCutoff)) {
                return false;
            }
            cursor = advanceChunk(cursor, timeframe);
        }

        return true;
    }

    @Transactional
    public long deleteSource(UUID userId, BacktestCandleSource provider, String sourceId) {
        return candleChunkRepository.deleteByUser_IdAndProviderAndSourceId(userId, provider, sourceId);
    }

    @Transactional(readOnly = true)
    public SourceCoverage summarizeSource(UUID userId,
                                          BacktestCandleSource provider,
                                          String sourceId,
                                          String symbolCanonical,
                                          BacktestTimeframe timeframe) {
        List<CandleChunk> chunks = candleChunkRepository
                .findByUser_IdAndProviderAndSourceIdAndSymbolCanonicalAndTimeframeOrderByChunkStartUtcAsc(
                        userId,
                        provider,
                        sourceId,
                        symbolCanonical,
                        timeframe
                );
        if (chunks.isEmpty()) {
            return new SourceCoverage(null, null, 0);
        }

        long candleCount = 0L;
        OffsetDateTime firstTs = null;
        OffsetDateTime lastTs = null;
        for (CandleChunk chunk : chunks) {
            List<CanonicalCandle> decoded = candleChunkCodec.decode(
                    chunk.getPayload(),
                    chunk.getProvider(),
                    chunk.getSourceId(),
                    chunk.getSymbolCanonical(),
                    chunk.getSymbolDisplay(),
                    chunk.getTimeframe()
            );
            if (decoded.isEmpty()) {
                continue;
            }
            if (firstTs == null) {
                firstTs = decoded.get(0).tsUtc();
            }
            lastTs = decoded.get(decoded.size() - 1).tsUtc();
            candleCount += decoded.size();
        }

        if (firstTs == null) {
            firstTs = chunks.get(0).getChunkStartUtc();
        }
        if (lastTs == null) {
            lastTs = chunks.get(chunks.size() - 1).getChunkEndUtc();
        }

        return new SourceCoverage(firstTs, lastTs, candleCount);
    }

    private List<CanonicalCandle> mergeCandles(List<CanonicalCandle> existing, List<CanonicalCandle> incoming) {
        Map<OffsetDateTime, CanonicalCandle> byTs = new LinkedHashMap<>();
        for (CanonicalCandle candle : existing) {
            if (candle.tsUtc() != null) {
                byTs.put(candle.tsUtc(), candle);
            }
        }
        for (CanonicalCandle candle : incoming) {
            if (candle.tsUtc() != null) {
                byTs.put(candle.tsUtc(), candle);
            }
        }
        return byTs.values().stream()
                .sorted(Comparator.comparing(CanonicalCandle::tsUtc))
                .toList();
    }

    private OffsetDateTime toChunkStart(OffsetDateTime tsUtc, BacktestTimeframe timeframe) {
        OffsetDateTime normalized = tsUtc.withOffsetSameInstant(ZoneOffset.UTC)
                .withHour(0)
                .withMinute(0)
                .withSecond(0)
                .withNano(0);
        if (timeframe.isIntradayFineGrain()) {
            return normalized;
        }
        return normalized.withDayOfMonth(1);
    }

    private OffsetDateTime advanceChunk(OffsetDateTime start, BacktestTimeframe timeframe) {
        if (timeframe.isIntradayFineGrain()) {
            return start.plusDays(1);
        }
        return start.plusMonths(1);
    }

    private void assertStorageReference(byte[] payload,
                                        String objectKey,
                                        BacktestCandleSource provider,
                                        String sourceId,
                                        String symbolCanonical,
                                        BacktestTimeframe timeframe,
                                        OffsetDateTime chunkStartUtc) {
        boolean hasObjectKey = objectKey != null && !objectKey.isBlank();
        if (!hasObjectKey && (payload == null || payload.length == 0)) {
            throw new IllegalStateException(
                    "Chunk payload is required when object key is missing for %s/%s/%s/%s at %s"
                            .formatted(provider, sourceId, symbolCanonical, timeframe, chunkStartUtc)
            );
        }
        if (payload != null && payload.length == 0) {
            throw new IllegalStateException(
                    "Chunk payload must not be empty for %s/%s/%s/%s at %s"
                            .formatted(provider, sourceId, symbolCanonical, timeframe, chunkStartUtc)
            );
        }
    }

    public record SourceCoverage(OffsetDateTime dataFromUtc, OffsetDateTime dataToUtc, long candleCount) {
    }
}
