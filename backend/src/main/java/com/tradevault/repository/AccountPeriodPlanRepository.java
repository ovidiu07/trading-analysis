package com.tradevault.repository;

import com.tradevault.domain.entity.AccountPeriodPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountPeriodPlanRepository extends JpaRepository<AccountPeriodPlan, UUID> {
    Optional<AccountPeriodPlan> findByAccountIdAndUserIdAndPeriodTypeAndPeriodKey(
            UUID accountId, UUID userId, String periodType, String periodKey);
    List<AccountPeriodPlan> findByAccountIdAndUserIdOrderByEffectiveFromDesc(UUID accountId, UUID userId);
}

