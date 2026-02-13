package com.tradevault.repository;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TradeRepository extends JpaRepository<Trade, UUID>, JpaSpecificationExecutor<Trade>,
    TradeRepositoryCustom {

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
      LEFT JOIN FETCH t.account
      LEFT JOIN FETCH t.tags
      LEFT JOIN FETCH t.linkedContentIds
      LEFT JOIN FETCH t.ruleBreaks
      WHERE t.id IN :ids
      """)
  List<Trade> findAllByIdInWithTagsAndAccount(@Param("ids") List<UUID> ids);

  @Query("""
      SELECT DISTINCT t
      FROM Trade t
      LEFT JOIN FETCH t.account
      LEFT JOIN FETCH t.tags
      LEFT JOIN FETCH t.linkedContentIds
      LEFT JOIN FETCH t.ruleBreaks
      WHERE t.id = :id
        AND t.user.id = :userId
      """)
  Optional<Trade> findByIdAndUserIdWithTagsAndAccount(@Param("id") UUID id, @Param("userId") UUID userId);

  Page<Trade> findByUserIdOrderByOpenedAtDescCreatedAtDesc(UUID userId, Pageable pageable);

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
      SELECT t.id FROM trades t
      WHERE t.user_id = :userId
        AND t.status = 'CLOSED'
        AND t.closed_at IS NOT NULL
        AND CAST((t.closed_at AT TIME ZONE :tz) AS date) = :date
      ORDER BY t.closed_at
      """, nativeQuery = true)
  List<UUID> findClosedTradeIdsForLocalDate(@Param("userId") UUID userId,
      @Param("date") LocalDate date, @Param("tz") String tz);

  @Query("""
      SELECT t.id
      FROM Trade t
      WHERE t.user.id = :userId
        AND t.status = :status
        AND t.closedAt BETWEEN :from AND :to
        AND t.pnlNet IS NOT NULL
        AND t.pnlNet <= :maxPnlNet
      ORDER BY t.closedAt
      """)
  List<UUID> findLossTradeIdsInRange(@Param("userId") UUID userId,
      @Param("from") OffsetDateTime from,
      @Param("to") OffsetDateTime to,
      @Param("status") TradeStatus status,
      @Param("maxPnlNet") java.math.BigDecimal maxPnlNet);

  List<Trade> findByUserIdAndClosedAtBetweenOrderByClosedAt(UUID userId, OffsetDateTime from,
      OffsetDateTime to);

  List<Trade> findByUserId(UUID userId);

  // Plan-adherence only needs a linked/unlinked flag, so fetch ids instead of initializing the full collection.
  @Query("""
      SELECT DISTINCT t.id
      FROM Trade t
      JOIN t.linkedContentIds linkedContentId
      WHERE t.user.id = :userId
        AND t.id IN :tradeIds
      """)
  Set<UUID> findTradeIdsWithLinkedContentForUser(@Param("userId") UUID userId,
      @Param("tradeIds") Collection<UUID> tradeIds);

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
