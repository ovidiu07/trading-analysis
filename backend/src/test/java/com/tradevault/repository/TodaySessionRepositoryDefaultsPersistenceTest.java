package com.tradevault.repository;

import com.tradevault.domain.TodaySessionDefaults;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.AutoJournalState;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.TodaySessionStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class TodaySessionRepositoryDefaultsPersistenceTest {

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
    private TodaySessionRepository todaySessionRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    void saveAndFlushAppliesAutoJournalDefaultsWhenRequestOmitsThem() {
        User user = userRepository.save(User.builder()
                .email("today-session-defaults@example.com")
                .passwordHash("hashed")
                .role(Role.USER)
                .timezone("UTC")
                .build());

        TodaySession saved = todaySessionRepository.saveAndFlush(TodaySession.builder()
                .user(user)
                .sessionDate(LocalDate.of(2026, 2, 25))
                .profitTarget(new BigDecimal("300.0000"))
                .lossLimit(new BigDecimal("120.0000"))
                .maxTrades(3)
                .status(TodaySessionStatus.ACTIVE)
                .build());

        assertThat(saved.getAutoJournalState()).isEqualTo(AutoJournalState.DISARMED);
        assertThat(saved.getAutoJournalTolerancePips())
                .isEqualByComparingTo(TodaySessionDefaults.AUTO_JOURNAL_TOLERANCE_PIPS);
        assertThat(saved.getAutoJournalTimeoutMin())
                .isEqualTo(TodaySessionDefaults.AUTO_JOURNAL_TIMEOUT_MINUTES);

        TodaySession reloaded = todaySessionRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getAutoJournalTolerancePips())
                .isEqualByComparingTo(TodaySessionDefaults.AUTO_JOURNAL_TOLERANCE_PIPS);
        assertThat(reloaded.getAutoJournalTimeoutMin())
                .isEqualTo(TodaySessionDefaults.AUTO_JOURNAL_TIMEOUT_MINUTES);
    }
}
