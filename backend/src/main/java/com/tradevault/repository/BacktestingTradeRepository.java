package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestingTrade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BacktestingTradeRepository extends JpaRepository<BacktestingTrade, UUID> {
    List<BacktestingTrade> findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(UUID workspaceId, UUID userId);

    List<BacktestingTrade> findByWorkspace_IdIn(List<UUID> workspaceIds);

    long countByWorkspace_Id(UUID workspaceId);
}
