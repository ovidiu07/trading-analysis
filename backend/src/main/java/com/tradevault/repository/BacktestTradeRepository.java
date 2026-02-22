package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestTrade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface BacktestTradeRepository extends JpaRepository<BacktestTrade, UUID> {
    List<BacktestTrade> findByRun_IdAndUser_IdOrderByCreatedAtDesc(UUID runId, UUID userId);

    List<BacktestTrade> findByUser_IdAndCreatedAtBetweenOrderByCreatedAtAsc(UUID userId, OffsetDateTime from, OffsetDateTime to);

    List<BacktestTrade> findByUser_IdOrderByCreatedAtAsc(UUID userId);
}
