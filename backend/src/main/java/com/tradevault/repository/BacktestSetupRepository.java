package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestSetup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BacktestSetupRepository extends JpaRepository<BacktestSetup, UUID> {
    List<BacktestSetup> findByRun_IdOrderByCreatedAtAsc(UUID runId);

    List<BacktestSetup> findByRun_IdAndRun_User_IdOrderByCreatedAtAsc(UUID runId, UUID userId);

    Optional<BacktestSetup> findByIdAndRun_User_Id(UUID id, UUID userId);
}
