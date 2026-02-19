package com.tradevault.repository;

import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import com.tradevault.domain.enums.Role;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class PlanRepositoryEnumIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("tradevault")
            .withUsername("tradevault")
            .withPassword("tradevault");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private PlanRepository planRepository;

    @Autowired
    private UserRepository userRepository;

    @AfterEach
    void cleanup() {
        planRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void searchMyPlansExecutesWithNativeEnumParameterBinding() {
        OffsetDateTime now = OffsetDateTime.parse("2026-02-10T10:00:00Z");
        User user = saveUser("enum-plan-owner@example.com");

        Plan myPlan = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                now.minusHours(1),
                now.plusHours(1),
                now,
                "My plan"
        );

        savePlan(
                null,
                PlanSource.MENTOR,
                PlanScope.DAILY,
                now.minusHours(1),
                now.plusHours(1),
                now,
                "Mentor plan"
        );

        List<Plan> results = planRepository.searchMyPlans(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                null,
                null
        );

        assertThat(results)
                .extracting(Plan::getId)
                .containsExactly(myPlan.getId());
    }

    @Test
    void searchMyPlansWithNullOptionalFiltersReturnsAllScopesAndKeepsOrdering() {
        OffsetDateTime now = OffsetDateTime.parse("2026-02-10T10:00:00Z");
        User user = saveUser("enum-plan-owner-null-filters@example.com");
        User otherUser = saveUser("enum-plan-owner-other@example.com");

        Plan newestByActiveFrom = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                now.minusHours(2),
                now.plusHours(8),
                now.minusMinutes(20),
                "newest-by-active-from"
        );

        Plan tieBreakByUpdatedAtNewer = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.WEEKLY,
                now.minusHours(6),
                now.plusHours(8),
                now.minusMinutes(10),
                "tie-break-newer"
        );

        Plan tieBreakByUpdatedAtOlder = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                now.minusHours(6),
                now.plusHours(8),
                now.minusMinutes(30),
                "tie-break-older"
        );

        savePlan(
                otherUser.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                now.minusHours(1),
                now.plusHours(8),
                now.minusMinutes(1),
                "other-user"
        );

        savePlan(
                user.getId(),
                PlanSource.MENTOR,
                PlanScope.DAILY,
                now.minusHours(1),
                now.plusHours(8),
                now.minusMinutes(1),
                "other-source"
        );

        List<Plan> results = planRepository.searchMyPlans(
                user.getId(),
                PlanSource.USER,
                null,
                null,
                null
        );

        assertThat(results)
                .extracting(Plan::getId)
                .containsExactly(
                        newestByActiveFrom.getId(),
                        tieBreakByUpdatedAtNewer.getId(),
                        tieBreakByUpdatedAtOlder.getId()
                );

        assertThat(results)
                .extracting(Plan::getScope)
                .containsExactly(PlanScope.DAILY, PlanScope.WEEKLY, PlanScope.DAILY);
    }

    @Test
    void searchMyPlansWithScopeFilterReturnsOnlyMatchingScope() {
        OffsetDateTime now = OffsetDateTime.parse("2026-02-11T10:00:00Z");
        User user = saveUser("enum-plan-owner-scope-filter@example.com");

        Plan weeklyPlan = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.WEEKLY,
                now.minusHours(1),
                now.plusHours(5),
                now.minusMinutes(1),
                "weekly"
        );

        savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                now.minusHours(2),
                now.plusHours(5),
                now.minusMinutes(2),
                "daily"
        );

        List<Plan> results = planRepository.searchMyPlans(
                user.getId(),
                PlanSource.USER,
                PlanScope.WEEKLY,
                null,
                null
        );

        assertThat(results)
                .extracting(Plan::getId)
                .containsExactly(weeklyPlan.getId());
    }

    @Test
    void searchMyPlansWithFromFilterReturnsPlansActiveAfterOrAtFrom() {
        OffsetDateTime now = OffsetDateTime.parse("2026-02-12T10:00:00Z");
        User user = saveUser("enum-plan-owner-from-filter@example.com");
        OffsetDateTime from = now;

        Plan endsAfterFrom = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                now.minusHours(2),
                from.plusMinutes(1),
                now.minusMinutes(1),
                "ends-after-from"
        );

        Plan endsAtFrom = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.WEEKLY,
                now.minusHours(5),
                from,
                now.minusMinutes(5),
                "ends-at-from"
        );

        savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                now.minusHours(4),
                from.minusMinutes(1),
                now.minusMinutes(10),
                "ends-before-from"
        );

        List<Plan> results = planRepository.searchMyPlans(
                user.getId(),
                PlanSource.USER,
                null,
                from,
                null
        );

        assertThat(results)
                .extracting(Plan::getId)
                .containsExactly(endsAfterFrom.getId(), endsAtFrom.getId());
    }

    @Test
    void searchMyPlansWithToFilterReturnsPlansStartingBeforeOrAtTo() {
        OffsetDateTime now = OffsetDateTime.parse("2026-02-13T10:00:00Z");
        User user = saveUser("enum-plan-owner-to-filter@example.com");
        OffsetDateTime to = now;

        Plan startsAtTo = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                to,
                now.plusHours(2),
                now.minusMinutes(1),
                "starts-at-to"
        );

        Plan startsBeforeTo = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.WEEKLY,
                to.minusMinutes(1),
                now.plusHours(3),
                now.minusMinutes(2),
                "starts-before-to"
        );

        savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                to.plusMinutes(1),
                now.plusHours(4),
                now.minusMinutes(3),
                "starts-after-to"
        );

        List<Plan> results = planRepository.searchMyPlans(
                user.getId(),
                PlanSource.USER,
                null,
                null,
                to
        );

        assertThat(results)
                .extracting(Plan::getId)
                .containsExactly(startsAtTo.getId(), startsBeforeTo.getId());
    }

    @Test
    void searchMyPlansWithFromAndToFiltersAppliesBothBounds() {
        OffsetDateTime now = OffsetDateTime.parse("2026-02-14T10:00:00Z");
        User user = saveUser("enum-plan-owner-both-filters@example.com");
        OffsetDateTime from = now.minusHours(1);
        OffsetDateTime to = now.plusHours(1);

        Plan startsAtUpperBound = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.WEEKLY,
                to,
                to.plusHours(4),
                now.minusMinutes(1),
                "starts-at-upper-bound"
        );

        Plan insideWindow = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                now,
                now.plusHours(2),
                now.minusMinutes(2),
                "inside-window"
        );

        Plan endsAtLowerBound = savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                now.minusHours(3),
                from,
                now.minusMinutes(3),
                "ends-at-lower-bound"
        );

        savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.DAILY,
                now.minusHours(4),
                from.minusMinutes(1),
                now.minusMinutes(4),
                "ends-before-lower-bound"
        );

        savePlan(
                user.getId(),
                PlanSource.USER,
                PlanScope.WEEKLY,
                to.plusMinutes(1),
                to.plusHours(6),
                now.minusMinutes(5),
                "starts-after-upper-bound"
        );

        List<Plan> results = planRepository.searchMyPlans(
                user.getId(),
                PlanSource.USER,
                null,
                from,
                to
        );

        assertThat(results)
                .extracting(Plan::getId)
                .containsExactly(
                        startsAtUpperBound.getId(),
                        insideWindow.getId(),
                        endsAtLowerBound.getId()
                );
    }

    private User saveUser(String email) {
        return userRepository.save(User.builder()
                .email(email)
                .passwordHash("hash")
                .role(Role.USER)
                .build());
    }

    private Plan savePlan(UUID authorUserId,
                          PlanSource source,
                          PlanScope scope,
                          OffsetDateTime activeFrom,
                          OffsetDateTime activeTo,
                          OffsetDateTime updatedAt,
                          String title) {
        return planRepository.save(Plan.builder()
                .scope(scope)
                .source(source)
                .authorUserId(authorUserId)
                .authorDisplayName(authorUserId == null ? "system" : "owner")
                .title(title)
                .content("content")
                .activeFrom(activeFrom)
                .activeTo(activeTo)
                .featured(false)
                .createdAt(updatedAt.minusMinutes(1))
                .updatedAt(updatedAt)
                .build());
    }
}
