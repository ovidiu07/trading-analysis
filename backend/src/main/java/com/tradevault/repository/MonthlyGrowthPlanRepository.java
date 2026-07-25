package com.tradevault.repository;

import com.tradevault.domain.entity.MonthlyGrowthPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MonthlyGrowthPlanRepository extends JpaRepository<MonthlyGrowthPlan, UUID> {
    Optional<MonthlyGrowthPlan> findByAccountIdAndUserIdAndMonthKey(UUID accountId, UUID userId, String monthKey);
}
