package com.tradevault.repository;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import java.math.BigDecimal;
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

  long countByAccount_Id(UUID accountId);

  Page<Trade> findByUserId(UUID userId, Pageable pageable);

  Optional<Trade> findByUserIdAndSourceAndSourceBrokerServerIgnoreCaseAndExternalAccountIdAndExternalPositionId(
      UUID userId, com.tradevault.domain.enums.TradeSource source, String sourceBrokerServer,
      String externalAccountId, String externalPositionId);

  List<Trade> findByUser_IdAndStrategyIdAndStatus(UUID userId, UUID strategyId, TradeStatus status);

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
      LEFT JOIN FETCH t.linkedPlanIds
      LEFT JOIN FETCH t.ruleBreaks
      LEFT JOIN FETCH t.entryScreenshotAssetIds
      WHERE t.id IN :ids
      """)
  List<Trade> findAllByIdInWithTagsAndAccount(@Param("ids") List<UUID> ids);

  @Query("""
      SELECT DISTINCT t
      FROM Trade t
      LEFT JOIN FETCH t.account
      LEFT JOIN FETCH t.tags
      LEFT JOIN FETCH t.linkedContentIds
      LEFT JOIN FETCH t.linkedPlanIds
      LEFT JOIN FETCH t.ruleBreaks
      LEFT JOIN FETCH t.entryScreenshotAssetIds
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
          AND (
            (:unassigned = TRUE AND t.account_id IS NULL AND NULLIF(TRIM(t.broker_account_id), '') IS NULL)
            OR (:unassigned = FALSE AND :brokerAccountId IS NULL AND :accountRefId IS NULL)
            OR (:brokerAccountId IS NOT NULL AND LOWER(TRIM(t.broker_account_id)) = LOWER(TRIM(:brokerAccountId)))
            OR (:accountRefId IS NOT NULL AND t.account_id = :accountRefId)
          )
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
      @Param("tz") String tz,
      @Param("brokerAccountId") String brokerAccountId,
      @Param("accountRefId") UUID accountRefId,
      @Param("unassigned") boolean unassigned);

  @Query(value = """
      WITH x AS (
        SELECT t.pnl_net AS pnl_net,
               CAST((t.opened_at AT TIME ZONE :tz) AS date) AS local_date
        FROM trades t
        WHERE t.user_id = :userId
          AND t.opened_at IS NOT NULL
          AND (
            (:unassigned = TRUE AND t.account_id IS NULL AND NULLIF(TRIM(t.broker_account_id), '') IS NULL)
            OR (:unassigned = FALSE AND :brokerAccountId IS NULL AND :accountRefId IS NULL)
            OR (:brokerAccountId IS NOT NULL AND LOWER(TRIM(t.broker_account_id)) = LOWER(TRIM(:brokerAccountId)))
            OR (:accountRefId IS NOT NULL AND t.account_id = :accountRefId)
          )
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
      @Param("tz") String tz,
      @Param("brokerAccountId") String brokerAccountId,
      @Param("accountRefId") UUID accountRefId,
      @Param("unassigned") boolean unassigned);

  @Query(value = """
      WITH x AS (
        SELECT t.pnl_net AS pnl_net,
               t.pnl_gross AS pnl_gross,
               CAST((t.closed_at AT TIME ZONE :tz) AS date) AS local_date
        FROM trades t
        WHERE t.user_id = :userId
          AND t.status = 'CLOSED'
          AND t.closed_at IS NOT NULL
          AND (
            (:unassigned = TRUE AND t.account_id IS NULL AND NULLIF(TRIM(t.broker_account_id), '') IS NULL)
            OR (:unassigned = FALSE AND :brokerAccountId IS NULL AND :accountRefId IS NULL)
            OR (:brokerAccountId IS NOT NULL AND LOWER(TRIM(t.broker_account_id)) = LOWER(TRIM(:brokerAccountId)))
            OR (:accountRefId IS NOT NULL AND t.account_id = :accountRefId)
          )
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
      @Param("tz") String tz,
      @Param("brokerAccountId") String brokerAccountId,
      @Param("accountRefId") UUID accountRefId,
      @Param("unassigned") boolean unassigned);

  @Query(value = """
      SELECT t.id FROM trades t
      WHERE t.user_id = :userId
        AND t.status = 'CLOSED'
        AND t.closed_at IS NOT NULL
        AND CAST((t.closed_at AT TIME ZONE :tz) AS date) = :date
        AND (
          (:unassigned = TRUE AND t.account_id IS NULL AND NULLIF(TRIM(t.broker_account_id), '') IS NULL)
          OR (:unassigned = FALSE AND :brokerAccountId IS NULL AND :accountRefId IS NULL)
          OR (:brokerAccountId IS NOT NULL AND LOWER(TRIM(t.broker_account_id)) = LOWER(TRIM(:brokerAccountId)))
          OR (:accountRefId IS NOT NULL AND t.account_id = :accountRefId)
        )
      ORDER BY t.closed_at
      """, nativeQuery = true)
  List<UUID> findClosedTradeIdsForLocalDate(@Param("userId") UUID userId,
      @Param("date") LocalDate date,
      @Param("tz") String tz,
      @Param("brokerAccountId") String brokerAccountId,
      @Param("accountRefId") UUID accountRefId,
      @Param("unassigned") boolean unassigned);

  @Query("""
      SELECT DISTINCT t.brokerAccountId
      FROM Trade t
      WHERE t.user.id = :userId
        AND t.brokerAccountId IS NOT NULL
        AND TRIM(t.brokerAccountId) <> ''
      ORDER BY t.brokerAccountId
      """)
  List<String> findDistinctBrokerAccountIdsByUserId(@Param("userId") UUID userId);

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

  Optional<Trade> findByUserIdAndSymbolAndDirectionAndOpenedAt(UUID userId,
                                                               String symbol,
                                                               Direction direction,
                                                               OffsetDateTime openedAt);

  Optional<Trade> findByUserIdAndSymbolAndDirectionAndOpenedAtAndBrokerAccountId(UUID userId,
                                                                                  String symbol,
                                                                                  Direction direction,
                                                                                  OffsetDateTime openedAt,
                                                                                  String brokerAccountId);

  long countByUser_IdAndSessionIdAndStatus(UUID userId, UUID sessionId, TradeStatus status);

  @Query("""
      SELECT COALESCE(SUM(COALESCE(t.pnlProfileCurrency, t.pnlNet)), 0)
      FROM Trade t
      WHERE t.user.id = :userId
        AND t.sessionId = :sessionId
        AND t.status = :status
        AND (t.pnlProfileCurrency IS NOT NULL OR t.pnlNet IS NOT NULL)
      """)
  BigDecimal sumNetPnlByUserAndSessionAndStatus(@Param("userId") UUID userId,
                                                @Param("sessionId") UUID sessionId,
                                                @Param("status") TradeStatus status);

  Optional<Trade> findFirstByUser_IdAndSessionIdAndStatusOrderByOpenedAtDescCreatedAtDesc(UUID userId,
                                                                                            UUID sessionId,
                                                                                            TradeStatus status);

  List<Trade> findByUserIdAndSessionIdOrderByOpenedAtDescCreatedAtDesc(UUID userId, UUID sessionId);

  List<Trade> findByUserIdAndSymbolAndDirectionAndOpenedAtBetweenOrderByOpenedAtAsc(UUID userId,
                                                                                     String symbol,
                                                                                     Direction direction,
                                                                                     OffsetDateTime from,
                                                                                     OffsetDateTime to);

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
