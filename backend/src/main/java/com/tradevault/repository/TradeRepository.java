package com.tradevault.repository;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TradeRepository extends JpaRepository<Trade, UUID>, JpaSpecificationExecutor<Trade> {

  Page<Trade> findByUserId(UUID userId, Pageable pageable);

  @Query(value = """
      SELECT t.id FROM Trade t
      WHERE t.user.id = :userId
      """,
      countQuery = """
      SELECT COUNT(t.id) FROM Trade t
      WHERE t.user.id = :userId
      """)
  Page<UUID> findTradeIdsForList(@Param("userId") UUID userId, Pageable pageable);

  @Query("""
      SELECT DISTINCT t FROM Trade t
      LEFT JOIN FETCH t.tags
      WHERE t.id IN :ids
      """)
  List<Trade> findAllByIdInWithTags(@Param("ids") List<UUID> ids);

  Page<Trade> findByUserIdOrderByOpenedAtDescCreatedAtDesc(UUID userId, Pageable pageable);

  @Deprecated(forRemoval = false)
  @Query("""
      SELECT t FROM Trade t
      WHERE t.user.id = :userId
        AND (:openedAtFrom IS NULL OR t.openedAt >= :openedAtFrom)
        AND (:openedAtTo IS NULL OR t.openedAt <= :openedAtTo)
        AND (:closedAtFrom IS NULL OR t.closedAt >= :closedAtFrom)
        AND (:closedAtTo IS NULL OR t.closedAt <= :closedAtTo)
        AND (:symbol IS NULL OR LOWER(t.symbol) = :symbol)
        AND (:strategy IS NULL OR LOWER(t.strategyTag) = :strategy)
        AND (:direction IS NULL OR t.direction = :direction)
        AND (:status IS NULL OR t.status = :status)
      """)
  Page<Trade> search(@Param("userId") UUID userId,
      @Param("openedAtFrom") OffsetDateTime openedAtFrom,
      @Param("openedAtTo") OffsetDateTime openedAtTo,
      @Param("closedAtFrom") OffsetDateTime closedAtFrom,
      @Param("closedAtTo") OffsetDateTime closedAtTo, @Param("symbol") String symbol,
      @Param("strategy") String strategy, @Param("direction") Direction direction,
      @Param("status") TradeStatus status, Pageable pageable);

  @Query(value = """
      WITH x AS (
        SELECT t.pnl_net AS pnl_net,
               CAST((t.closed_at AT TIME ZONE :tz) AS date) AS local_date
        FROM trades t
        WHERE t.user_id = :userId
          AND t.status = 'CLOSED'
          AND t.closed_at IS NOT NULL
      )
      SELECT x.local_date AS date,
             COALESCE(SUM(x.pnl_net), 0) AS netPnl,
             COUNT(*) AS tradeCount,
             SUM(CASE WHEN x.pnl_net > 0 THEN 1 ELSE 0 END) AS wins,
             SUM(CASE WHEN x.pnl_net < 0 THEN 1 ELSE 0 END) AS losses
      FROM x
      WHERE x.local_date >= :fromDate
        AND x.local_date <= :toDate
      GROUP BY x.local_date
      ORDER BY date
      """, nativeQuery = true)
  List<DailyPnlAggregate> aggregateDailyPnlByClosedDate(@Param("userId") UUID userId,
      @Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate,
      @Param("tz") String tz);

  @Query(value = """
      WITH x AS (
        SELECT t.pnl_net AS pnl_net,
               CAST((t.opened_at AT TIME ZONE :tz) AS date) AS local_date
        FROM trades t
        WHERE t.user_id = :userId
          AND t.opened_at IS NOT NULL
      )
      SELECT x.local_date AS date,
             COALESCE(SUM(x.pnl_net), 0) AS netPnl,
             COUNT(*) AS tradeCount,
             SUM(CASE WHEN x.pnl_net > 0 THEN 1 ELSE 0 END) AS wins,
             SUM(CASE WHEN x.pnl_net < 0 THEN 1 ELSE 0 END) AS losses
      FROM x
      WHERE x.local_date >= :fromDate
        AND x.local_date <= :toDate
      GROUP BY x.local_date
      ORDER BY date
      """, nativeQuery = true)
  List<DailyPnlAggregate> aggregateDailyPnlByOpenedDate(@Param("userId") UUID userId,
      @Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate,
      @Param("tz") String tz);

  @Query(value = """
      WITH x AS (
        SELECT t.pnl_net AS pnl_net,
               t.pnl_gross AS pnl_gross,
               CAST((t.closed_at AT TIME ZONE :tz) AS date) AS local_date
        FROM trades t
        WHERE t.user_id = :userId
          AND t.status = 'CLOSED'
          AND t.closed_at IS NOT NULL
      )
      SELECT COALESCE(SUM(x.pnl_net), 0) AS netPnl,
             COALESCE(SUM(x.pnl_gross), 0) AS grossPnl,
             COUNT(*) AS tradeCount,
             COUNT(DISTINCT x.local_date) AS tradingDays
      FROM x
      WHERE x.local_date >= :fromDate
        AND x.local_date <= :toDate
      """, nativeQuery = true)
  MonthlyPnlAggregate aggregateMonthlyPnlByClosedDate(@Param("userId") UUID userId,
      @Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate,
      @Param("tz") String tz);

  @Query(value = """
      SELECT * FROM trades t
      WHERE t.user_id = :userId
        AND t.status = 'CLOSED'
        AND t.closed_at IS NOT NULL
        AND CAST((t.closed_at AT TIME ZONE :tz) AS date) = :date
      ORDER BY t.closed_at
      """, nativeQuery = true)
  List<Trade> findClosedTradesForLocalDate(@Param("userId") UUID userId,
      @Param("date") LocalDate date, @Param("tz") String tz);

  List<Trade> findByUserIdAndClosedAtBetweenOrderByClosedAt(UUID userId, OffsetDateTime from,
      OffsetDateTime to);

  List<Trade> findByUserId(UUID userId);

  Optional<Trade> findByIdAndUserId(UUID id, UUID userId);

  Optional<Trade> findByUserIdAndSymbolAndOpenedAt(UUID userId, String symbol, OffsetDateTime openedAt);

  boolean existsByUserIdAndDemoSeedIdIsNotNull(UUID userId);

  boolean existsByUserIdAndDemoSeedIdIsNull(UUID userId);

  long deleteByUserIdAndDemoSeedIdIsNotNull(UUID userId);

  interface DailyPnlAggregate {

    LocalDate getDate();

    java.math.BigDecimal getNetPnl();

    long getTradeCount();

    long getWins();

    long getLosses();
  }

  interface MonthlyPnlAggregate {

    java.math.BigDecimal getNetPnl();

    java.math.BigDecimal getGrossPnl();

    long getTradeCount();

    long getTradingDays();
  }
}
