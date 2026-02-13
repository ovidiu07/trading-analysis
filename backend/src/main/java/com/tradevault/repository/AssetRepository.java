package com.tradevault.repository;

import com.tradevault.domain.entity.Asset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AssetRepository extends JpaRepository<Asset, UUID> {
    List<Asset> findByIdIn(List<UUID> ids);
}
