package com.tradevault.repository;

import com.tradevault.domain.entity.ContentAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ContentAssetRepository extends JpaRepository<ContentAsset, UUID> {
    List<ContentAsset> findByContentPostIdOrderBySortOrderAscCreatedAtAsc(UUID contentId);

    List<ContentAsset> findByContentPostIdInOrderBySortOrderAscCreatedAtAsc(List<UUID> contentIds);

    List<ContentAsset> findByAssetId(UUID assetId);

    boolean existsByAssetId(UUID assetId);

    long deleteByAssetId(UUID assetId);
}
