package com.tradevault.repository;

import com.tradevault.domain.entity.AccountPeriodPlanRevision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AccountPeriodPlanRevisionRepository extends JpaRepository<AccountPeriodPlanRevision, UUID> {
    List<AccountPeriodPlanRevision> findByPlanIdOrderByVersionDesc(UUID planId);
}

