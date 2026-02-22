package com.tradevault.repository;

import com.tradevault.domain.entity.CandleCache;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface CandleCacheRepository extends JpaRepository<CandleCache, UUID> {
    Optional<CandleCache> findByProviderAndSymbolAndTimeframeAndRangeFromAndRangeTo(
            String provider,
            String symbol,
            String timeframe,
            OffsetDateTime rangeFrom,
            OffsetDateTime rangeTo
    );
}
