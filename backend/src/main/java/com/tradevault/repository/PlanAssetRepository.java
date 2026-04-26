package com.tradevault.repository;

import com.tradevault.domain.entity.PlanAsset;
import com.tradevault.domain.enums.PlanScope;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlanAssetRepository extends JpaRepository<PlanAsset, UUID> {
    List<PlanAsset> findByPlan_IdOrderBySortOrderAscCreatedAtAsc(UUID planId);

    List<PlanAsset> findByPlan_IdInOrderBySortOrderAscCreatedAtAsc(Collection<UUID> planIds);

    List<PlanAsset> findByTodaySession_IdOrderBySortOrderAscCreatedAtAsc(UUID todaySessionId);

    List<PlanAsset> findByTodaySession_IdInOrderBySortOrderAscCreatedAtAsc(Collection<UUID> todaySessionIds);

    List<PlanAsset> findByAsset_Id(UUID assetId);

    Optional<PlanAsset> findByIdAndUser_Id(UUID id, UUID userId);

    Optional<PlanAsset> findByAsset_IdAndUser_Id(UUID assetId, UUID userId);

    long countByPlan_Id(UUID planId);

    long countByTodaySession_Id(UUID todaySessionId);

    long countByUser_IdAndPlanScope(UUID userId, PlanScope planScope);

    void deleteByAsset_Id(UUID assetId);
}
