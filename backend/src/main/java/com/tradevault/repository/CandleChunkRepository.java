package com.tradevault.repository;

import com.tradevault.domain.entity.CandleChunk;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CandleChunkRepository extends JpaRepository<CandleChunk, UUID> {
    Optional<CandleChunk> findByUser_IdAndProviderAndSourceIdAndSymbolCanonicalAndTimeframeAndChunkStartUtc(
            UUID userId,
            BacktestCandleSource provider,
            String sourceId,
            String symbolCanonical,
            BacktestTimeframe timeframe,
            OffsetDateTime chunkStartUtc
    );

    List<CandleChunk> findByUser_IdAndProviderAndSourceIdAndSymbolCanonicalAndTimeframeAndChunkEndUtcGreaterThanEqualAndChunkStartUtcLessThanEqualOrderByChunkStartUtcAsc(
            UUID userId,
            BacktestCandleSource provider,
            String sourceId,
            String symbolCanonical,
            BacktestTimeframe timeframe,
            OffsetDateTime from,
            OffsetDateTime to
    );

    List<CandleChunk> findByUser_IdAndProviderAndSourceIdAndSymbolCanonicalAndTimeframeAndChunkStartUtcBetweenOrderByChunkStartUtcAsc(
            UUID userId,
            BacktestCandleSource provider,
            String sourceId,
            String symbolCanonical,
            BacktestTimeframe timeframe,
            OffsetDateTime from,
            OffsetDateTime to
    );

    long deleteByUser_IdAndProviderAndSourceId(UUID userId, BacktestCandleSource provider, String sourceId);
}
