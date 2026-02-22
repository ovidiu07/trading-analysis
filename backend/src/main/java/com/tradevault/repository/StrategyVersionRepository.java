package com.tradevault.repository;

import com.tradevault.domain.entity.StrategyVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface StrategyVersionRepository extends JpaRepository<StrategyVersion, UUID> {
    Optional<StrategyVersion> findFirstByStrategy_IdOrderByVersionNumberDesc(UUID strategyId);

    Optional<StrategyVersion> findByIdAndUser_Id(UUID id, UUID userId);
}
