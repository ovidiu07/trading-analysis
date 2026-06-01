package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestingScreenshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BacktestingScreenshotRepository extends JpaRepository<BacktestingScreenshot, UUID> {
    List<BacktestingScreenshot> findByWorkspace_IdAndUser_IdOrderBySortOrderAscCreatedAtAsc(UUID workspaceId, UUID userId);

    List<BacktestingScreenshot> findByWorkspace_IdIn(List<UUID> workspaceIds);

    Optional<BacktestingScreenshot> findByIdAndUser_Id(UUID id, UUID userId);

    List<BacktestingScreenshot> findByAsset_Id(UUID assetId);

    long countByWorkspace_Id(UUID workspaceId);

    long countByBacktestingTrade_Id(UUID backtestingTradeId);

    long deleteByAsset_Id(UUID assetId);
}
