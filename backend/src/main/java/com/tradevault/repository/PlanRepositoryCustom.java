package com.tradevault.repository;

import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface PlanRepositoryCustom {

    List<Plan> searchMyPlans(UUID authorUserId,
                             PlanSource source,
                             PlanScope scope,
                             OffsetDateTime from,
                             OffsetDateTime to);
}
