package com.tradevault.repository;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TradeRepository extends JpaRepository<Trade, UUID> {
    Page<Trade> findByUserId(UUID userId, Pageable pageable);
    Page<Trade> findByUserIdOrderByOpenedAtDescCreatedAtDesc(UUID userId, Pageable pageable);

    @Query("""
            SELECT t FROM Trade t
            WHERE t.user.id = :userId
              AND (:openedAtFrom IS NULL OR t.openedAt >= :openedAtFrom)
              AND (:openedAtTo IS NULL OR t.openedAt <= :openedAtTo)
              AND (:closedAtFrom IS NULL OR t.closedAt >= :closedAtFrom)
              AND (:closedAtTo IS NULL OR t.closedAt <= :closedAtTo)
              AND (:symbol IS NULL OR LOWER(t.symbol) = LOWER(:symbol))
              AND (:strategy IS NULL OR LOWER(t.strategyTag) = LOWER(:strategy))
              AND (:direction IS NULL OR t.direction = :direction)
              AND (:status IS NULL OR t.status = :status)
            """)
    Page<Trade> search(@Param("userId") UUID userId,
                      @Param("openedAtFrom") OffsetDateTime openedAtFrom,
                      @Param("openedAtTo") OffsetDateTime openedAtTo,
                      @Param("closedAtFrom") OffsetDateTime closedAtFrom,
                      @Param("closedAtTo") OffsetDateTime closedAtTo,
                      @Param("symbol") String symbol,
                      @Param("strategy") String strategy,
                      @Param("direction") Direction direction,
                      @Param("status") TradeStatus status,
                      Pageable pageable);

    interface DailyPnlAggregate {
        LocalDate getDate();
        java.math.BigDecimal getNetPnl();
        long getTradeCount();
        long getWins();
        long getLosses();
    }

    @Query(value = """
            SELECT (t.closed_at AT TIME ZONE :tz)::date AS date,
                   COALESCE(SUM(t.pnl_net), 0) AS netPnl,
                   COUNT(*) AS tradeCount,
                   SUM(CASE WHEN t.pnl_net > 0 THEN 1 ELSE 0 END) AS wins,
                   SUM(CASE WHEN t.pnl_net < 0 THEN 1 ELSE 0 END) AS losses
            FROM trades t
            WHERE t.user_id = :userId
              AND t.status = 'CLOSED'
              AND t.closed_at IS NOT NULL
              AND (t.closed_at AT TIME ZONE :tz)::date >= :fromDate
              AND (t.closed_at AT TIME ZONE :tz)::date <= :toDate
            GROUP BY (t.closed_at AT TIME ZONE :tz)::date
            ORDER BY date
            """, nativeQuery = true)
    List<DailyPnlAggregate> aggregateDailyPnlByClosedDate(@Param("userId") UUID userId,
                                                         @Param("fromDate") LocalDate fromDate,
                                                         @Param("toDate") LocalDate toDate,
                                                         @Param("tz") String tz);

    @Query(value = """
            SELECT (t.opened_at AT TIME ZONE :tz)::date AS date,
                   COALESCE(SUM(t.pnl_net), 0) AS netPnl,
                   COUNT(*) AS tradeCount,
                   SUM(CASE WHEN t.pnl_net > 0 THEN 1 ELSE 0 END) AS wins,
                   SUM(CASE WHEN t.pnl_net < 0 THEN 1 ELSE 0 END) AS losses
            FROM trades t
            WHERE t.user_id = :userId
              AND t.opened_at IS NOT NULL
              AND (t.opened_at AT TIME ZONE :tz)::date >= :fromDate
              AND (t.opened_at AT TIME ZONE :tz)::date <= :toDate
            GROUP BY (t.opened_at AT TIME ZONE :tz)::date
            ORDER BY date
            """, nativeQuery = true)
    List<DailyPnlAggregate> aggregateDailyPnlByOpenedDate(@Param("userId") UUID userId,
                                                          @Param("fromDate") LocalDate fromDate,
                                                          @Param("toDate") LocalDate toDate,
                                                          @Param("tz") String tz);

    @Query(value = """
            SELECT * FROM trades t
            WHERE t.user_id = :userId
              AND t.status = 'CLOSED'
              AND t.closed_at IS NOT NULL
              AND (t.closed_at AT TIME ZONE :tz)::date = :date
            ORDER BY t.closed_at
            """, nativeQuery = true)
    List<Trade> findClosedTradesForLocalDate(@Param("userId") UUID userId,
                                             @Param("date") LocalDate date,
                                             @Param("tz") String tz);

    List<Trade> findByUserIdAndClosedAtBetweenOrderByClosedAt(UUID userId, OffsetDateTime from, OffsetDateTime to);
    List<Trade> findByUserId(UUID userId);
    Optional<Trade> findByIdAndUserId(UUID id, UUID userId);
}
