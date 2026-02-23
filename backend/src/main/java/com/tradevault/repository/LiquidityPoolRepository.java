package com.tradevault.repository;

import com.tradevault.domain.entity.LiquidityPool;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LiquidityPoolRepository extends JpaRepository<LiquidityPool, UUID> {
    List<LiquidityPool> findByTodaySession_IdAndUser_IdOrderByCreatedAtUtcAsc(UUID todaySessionId, UUID userId);

    List<LiquidityPool> findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseOrderByCreatedAtUtcAsc(UUID todaySessionId,
                                                                                                   UUID userId,
                                                                                                   String symbol);

    Optional<LiquidityPool> findByIdAndTodaySession_IdAndUser_Id(UUID id, UUID todaySessionId, UUID userId);

    Optional<LiquidityPool> findByTodaySession_IdAndUser_IdAndSymbolIgnoreCaseAndSweepRoleTrue(UUID todaySessionId,
                                                                                                 UUID userId,
                                                                                                 String symbol);

    void deleteByIdAndTodaySession_IdAndUser_Id(UUID id, UUID todaySessionId, UUID userId);
}
