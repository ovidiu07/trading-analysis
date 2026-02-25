package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestOptimizerRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BacktestOptimizerRunRepository extends JpaRepository<BacktestOptimizerRun, UUID> {
    Optional<BacktestOptimizerRun> findByIdAndUser_Id(UUID id, UUID userId);
}
