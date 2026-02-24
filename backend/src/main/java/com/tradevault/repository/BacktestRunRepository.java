package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BacktestRunRepository extends JpaRepository<BacktestRun, UUID> {
    Optional<BacktestRun> findByIdAndUser_Id(UUID id, UUID userId);

    List<BacktestRun> findByDatasetSet_IdOrderByCreatedAtDesc(UUID datasetSetId);

    List<BacktestRun> findByUser_IdOrderByCreatedAtDesc(UUID userId);
}
