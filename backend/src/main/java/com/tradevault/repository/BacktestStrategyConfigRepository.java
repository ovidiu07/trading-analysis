package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestStrategyConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BacktestStrategyConfigRepository extends JpaRepository<BacktestStrategyConfig, UUID> {
    List<BacktestStrategyConfig> findByDatasetSet_IdOrderByUpdatedAtDesc(UUID datasetSetId);

    Optional<BacktestStrategyConfig> findByIdAndDatasetSet_User_Id(UUID id, UUID userId);
}
