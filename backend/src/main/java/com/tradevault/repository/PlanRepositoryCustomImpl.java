package com.tradevault.repository;

import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Repository
public class PlanRepositoryCustomImpl implements PlanRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public List<Plan> searchMyPlans(UUID authorUserId,
                                    PlanSource source,
                                    PlanScope scope,
                                    OffsetDateTime from,
                                    OffsetDateTime to) {
        CriteriaBuilder criteriaBuilder = entityManager.getCriteriaBuilder();
        CriteriaQuery<Plan> query = criteriaBuilder.createQuery(Plan.class);
        Root<Plan> plan = query.from(Plan.class);

        List<Predicate> predicates = new ArrayList<>();
        predicates.add(criteriaBuilder.equal(plan.get("source"), source));
        predicates.add(criteriaBuilder.equal(plan.get("authorUserId"), authorUserId));

        if (scope != null) {
            predicates.add(criteriaBuilder.equal(plan.get("scope"), scope));
        }

        if (from != null) {
            predicates.add(criteriaBuilder.greaterThanOrEqualTo(plan.get("activeTo"), from));
        }

        if (to != null) {
            predicates.add(criteriaBuilder.lessThanOrEqualTo(plan.get("activeFrom"), to));
        }

        query.select(plan)
                .where(predicates.toArray(new Predicate[0]))
                .orderBy(
                        criteriaBuilder.desc(plan.get("activeFrom")),
                        criteriaBuilder.desc(plan.get("updatedAt"))
                );

        return entityManager.createQuery(query).getResultList();
    }
}
