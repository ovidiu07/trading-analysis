package com.tradevault.repository;

import com.tradevault.domain.entity.StrategyPlaybook;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StrategyPlaybookRepository extends JpaRepository<StrategyPlaybook, UUID> {
    Optional<StrategyPlaybook> findByIdAndUser_Id(UUID id, UUID userId);

    List<StrategyPlaybook> findByUser_IdOrderByUpdatedAtUtcDesc(UUID userId);

    Optional<StrategyPlaybook> findFirstByUser_IdOrderByUpdatedAtUtcDesc(UUID userId);

    Optional<StrategyPlaybook> findFirstByRun_IdAndUser_IdOrderByUpdatedAtUtcDesc(UUID runId, UUID userId);
}
