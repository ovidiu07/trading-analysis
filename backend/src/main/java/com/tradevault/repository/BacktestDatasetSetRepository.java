package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestDatasetSet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BacktestDatasetSetRepository extends JpaRepository<BacktestDatasetSet, UUID> {
    List<BacktestDatasetSet> findByUser_IdOrderByCreatedAtDesc(UUID userId);

    Optional<BacktestDatasetSet> findByIdAndUser_Id(UUID id, UUID userId);
}
