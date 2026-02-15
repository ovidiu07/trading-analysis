package com.tradevault.repository;

import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlanRepository extends JpaRepository<Plan, UUID> {

    @Query("""
        SELECT p
        FROM Plan p
        WHERE p.source = :source
          AND p.scope = :scope
          AND p.featured = true
          AND p.activeFrom <= :windowEnd
          AND p.activeTo >= :windowStart
        ORDER BY p.activeFrom DESC, p.createdAt DESC
        """)
    List<Plan> findFeaturedActiveByWindow(@Param("source") PlanSource source,
                                          @Param("scope") PlanScope scope,
                                          @Param("windowStart") OffsetDateTime windowStart,
                                          @Param("windowEnd") OffsetDateTime windowEnd);

    @Query("""
        SELECT p
        FROM Plan p
        WHERE p.source = :source
          AND p.scope = :scope
          AND p.authorUserId = :authorUserId
          AND p.activeFrom <= :windowEnd
          AND p.activeTo >= :windowStart
        ORDER BY p.activeFrom DESC, p.updatedAt DESC
        """)
    List<Plan> findUserActiveByWindow(@Param("source") PlanSource source,
                                      @Param("scope") PlanScope scope,
                                      @Param("authorUserId") UUID authorUserId,
                                      @Param("windowStart") OffsetDateTime windowStart,
                                      @Param("windowEnd") OffsetDateTime windowEnd);

    Optional<Plan> findByIdAndSourceAndAuthorUserId(UUID id, PlanSource source, UUID authorUserId);

    @Query("""
        SELECT p
        FROM Plan p
        WHERE p.source = com.tradevault.domain.enums.PlanSource.USER
          AND p.authorUserId = :authorUserId
          AND (:scope IS NULL OR p.scope = :scope)
          AND (:from IS NULL OR p.activeTo >= :from)
          AND (:to IS NULL OR p.activeFrom <= :to)
        ORDER BY p.activeFrom DESC, p.updatedAt DESC
        """)
    List<Plan> searchMyPlans(@Param("authorUserId") UUID authorUserId,
                             @Param("scope") PlanScope scope,
                             @Param("from") OffsetDateTime from,
                             @Param("to") OffsetDateTime to);

    @Query("""
        SELECT p
        FROM Plan p
        WHERE p.source = :source
          AND p.scope = :scope
          AND p.featured = true
          AND p.activeFrom <= :moment
          AND p.activeTo >= :moment
        ORDER BY p.activeFrom DESC, p.updatedAt DESC
        """)
    List<Plan> findFeaturedActiveAtMoment(@Param("source") PlanSource source,
                                          @Param("scope") PlanScope scope,
                                          @Param("moment") OffsetDateTime moment);

    @Query("""
        SELECT p
        FROM Plan p
        WHERE p.source = :source
          AND p.scope = :scope
          AND p.authorUserId = :authorUserId
          AND p.activeFrom <= :moment
          AND p.activeTo >= :moment
        ORDER BY p.activeFrom DESC, p.updatedAt DESC
        """)
    List<Plan> findUserActiveAtMoment(@Param("source") PlanSource source,
                                      @Param("scope") PlanScope scope,
                                      @Param("authorUserId") UUID authorUserId,
                                      @Param("moment") OffsetDateTime moment);
}
