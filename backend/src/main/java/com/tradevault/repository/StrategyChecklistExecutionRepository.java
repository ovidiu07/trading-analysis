package com.tradevault.repository;

import com.tradevault.domain.entity.StrategyChecklistExecution;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.*;

public interface StrategyChecklistExecutionRepository
        extends JpaRepository<StrategyChecklistExecution, UUID> {
    List<StrategyChecklistExecution> findTop100ByStrategy_IdAndUser_IdOrderByCreatedAtDesc(
            UUID strategyId, UUID userId);
}
