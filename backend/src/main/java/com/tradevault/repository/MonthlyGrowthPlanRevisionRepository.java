package com.tradevault.repository;

import com.tradevault.domain.entity.MonthlyGrowthPlanRevision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MonthlyGrowthPlanRevisionRepository extends JpaRepository<MonthlyGrowthPlanRevision, UUID> {
}
