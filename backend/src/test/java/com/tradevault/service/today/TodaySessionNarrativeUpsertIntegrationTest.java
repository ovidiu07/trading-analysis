package com.tradevault.service.today;

import com.tradevault.domain.entity.SessionNarrative;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.NarrativeConfirmationModel;
import com.tradevault.domain.enums.NarrativeDeliveryModel;
import com.tradevault.domain.enums.NarrativeHtfDraw;
import com.tradevault.domain.enums.NarrativeManipulation;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.dto.session.SessionNarrativeRequest;
import com.tradevault.repository.SessionNarrativeRepository;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.repository.UserRepository;
import com.tradevault.service.CurrentUserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.when;

@SpringBootTest
@Testcontainers
class TodaySessionNarrativeUpsertIntegrationTest {

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
    private TodaySessionService todaySessionService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TodaySessionRepository todaySessionRepository;

    @Autowired
    private SessionNarrativeRepository sessionNarrativeRepository;

    @MockBean
    private CurrentUserService currentUserService;

    private User persistedUser;
    private TodaySession persistedSession;

    @BeforeEach
    void setUp() {
        persistedUser = userRepository.save(User.builder()
                .email("narrative-upsert@example.com")
                .passwordHash("hashed")
                .role(Role.USER)
                .timezone("UTC")
                .build());

        persistedSession = todaySessionRepository.save(TodaySession.builder()
                .user(persistedUser)
                .sessionDate(LocalDate.of(2026, 2, 23))
                .profitTarget(new BigDecimal("250"))
                .lossLimit(new BigDecimal("100"))
                .maxTrades(3)
                .status(TodaySessionStatus.ACTIVE)
                .build());

        User detachedPrincipal = User.builder()
                .id(persistedUser.getId())
                .email(persistedUser.getEmail())
                .passwordHash("hashed")
                .role(Role.USER)
                .timezone("UTC")
                .build();
        when(currentUserService.getCurrentUser()).thenReturn(detachedPrincipal);
    }

    @AfterEach
    void cleanUp() {
        sessionNarrativeRepository.deleteAll();
        todaySessionRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void upsertCreatesThenUpdatesSingleNarrativeWithSharedPrimaryKey() {
        SessionNarrativeRequest createRequest = new SessionNarrativeRequest();
        createRequest.setHtfDraw(NarrativeHtfDraw.WEEKLY_H);
        createRequest.setExpectedManipulation(NarrativeManipulation.RAID_DOWN);
        createRequest.setDeliveryModel(NarrativeDeliveryModel.LONDON_RAID_NY_REVERSAL);
        createRequest.setConfirmationModel(NarrativeConfirmationModel.DISPLACEMENT_M1_MSS_M1);
        createRequest.setNotes("Initial narrative");

        assertThatCode(() -> todaySessionService.upsertSessionNarrative(persistedSession.getId(), createRequest))
                .doesNotThrowAnyException();

        Optional<SessionNarrative> created = sessionNarrativeRepository.findBySessionIdAndUser_Id(
                persistedSession.getId(),
                persistedUser.getId()
        );

        assertThat(created).isPresent();
        assertThat(created.orElseThrow().getSessionId()).isEqualTo(persistedSession.getId());
        assertThat(sessionNarrativeRepository.count()).isEqualTo(1L);

        SessionNarrativeRequest updateRequest = new SessionNarrativeRequest();
        updateRequest.setHtfDraw(NarrativeHtfDraw.PDL);
        updateRequest.setExpectedManipulation(NarrativeManipulation.RAID_UP);
        updateRequest.setDeliveryModel(NarrativeDeliveryModel.TREND_DAY);
        updateRequest.setConfirmationModel(NarrativeConfirmationModel.DISPLACEMENT_M5_MSS_M5);
        updateRequest.setNotes("Updated narrative");

        var updatedDto = todaySessionService.upsertSessionNarrative(persistedSession.getId(), updateRequest);
        SessionNarrative updated = sessionNarrativeRepository.findBySessionIdAndUser_Id(
                persistedSession.getId(),
                persistedUser.getId()
        ).orElseThrow();
        SessionNarrative updatedBySessionJoin = sessionNarrativeRepository.findByTodaySession_IdAndUser_Id(
                persistedSession.getId(),
                persistedUser.getId()
        ).orElseThrow();

        assertThat(updatedDto.getSessionId()).isEqualTo(persistedSession.getId());
        assertThat(updated.getSessionId()).isEqualTo(persistedSession.getId());
        assertThat(updatedBySessionJoin.getSessionId()).isEqualTo(persistedSession.getId());
        assertThat(updated.getHtfDraw()).isEqualTo(NarrativeHtfDraw.PDL);
        assertThat(updated.getExpectedManipulation()).isEqualTo(NarrativeManipulation.RAID_UP);
        assertThat(updated.getDeliveryModel()).isEqualTo(NarrativeDeliveryModel.TREND_DAY);
        assertThat(updated.getConfirmationModel()).isEqualTo(NarrativeConfirmationModel.DISPLACEMENT_M5_MSS_M5);
        assertThat(updated.getNotes()).isEqualTo("Updated narrative");
        assertThat(sessionNarrativeRepository.count()).isEqualTo(1L);
    }
}
