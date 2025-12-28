package com.tradevault.repository;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TradeRepository extends JpaRepository<Trade, UUID> {
    Page<Trade> findByUserId(UUID userId, Pageable pageable);

    @Query("""
            SELECT t FROM Trade t
            WHERE t.user.id = :userId
              AND t.openedAt >= COALESCE(:from, t.openedAt)
              AND t.openedAt <= COALESCE(:to, t.openedAt)
              AND t.symbol = COALESCE(:symbol, t.symbol)
              AND t.strategyTag = COALESCE(:strategy, t.strategyTag)
              AND t.direction = COALESCE(:direction, t.direction)
              AND t.status = COALESCE(:status, t.status)
            """)
    Page<Trade> search(@Param("userId") UUID userId,
                      @Param("from") OffsetDateTime from,
                      @Param("to") OffsetDateTime to,
                      @Param("symbol") String symbol,
                      @Param("strategy") String strategy,
                      @Param("direction") Direction direction,
                      @Param("status") TradeStatus status,
                      Pageable pageable);

    List<Trade> findByUserIdAndClosedAtBetweenOrderByClosedAt(UUID userId, OffsetDateTime from, OffsetDateTime to);
    List<Trade> findByUserId(UUID userId);
    Optional<Trade> findByIdAndUserId(UUID id, UUID userId);
}
