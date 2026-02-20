package com.tradevault.repository;

import com.tradevault.domain.entity.StrategyAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StrategyAssetRepository extends JpaRepository<StrategyAsset, UUID> {
    List<StrategyAsset> findByStrategy_IdOrderBySortOrderAscCreatedAtAsc(UUID strategyId);

    List<StrategyAsset> findByStrategy_IdInOrderBySortOrderAscCreatedAtAsc(List<UUID> strategyIds);

    List<StrategyAsset> findByAsset_Id(UUID assetId);

    boolean existsByStrategy_IdAndAsset_Id(UUID strategyId, UUID assetId);

    long deleteByAsset_Id(UUID assetId);

    long deleteByStrategy_IdAndAsset_Id(UUID strategyId, UUID assetId);
}
