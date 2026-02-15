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
        User user = userRepository.save(User.builder()
                .email("enum-plan-owner@example.com")
                .passwordHash("hash")
                .role(Role.USER)
                .build());

        OffsetDateTime now = OffsetDateTime.parse("2026-02-10T10:00:00Z");

        Plan myPlan = planRepository.save(Plan.builder()
                .scope(PlanScope.DAILY)
                .source(PlanSource.USER)
                .authorUserId(user.getId())
                .authorDisplayName("owner")
                .title("My plan")
                .content("content")
                .activeFrom(now.minusHours(1))
                .activeTo(now.plusHours(1))
                .featured(false)
                .createdAt(now)
                .updatedAt(now)
                .build());

        planRepository.save(Plan.builder()
                .scope(PlanScope.DAILY)
                .source(PlanSource.MENTOR)
                .authorDisplayName("mentor")
                .title("Mentor plan")
                .content("content")
                .activeFrom(now.minusHours(1))
                .activeTo(now.plusHours(1))
                .featured(true)
                .createdAt(now)
                .updatedAt(now)
                .build());

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
}
