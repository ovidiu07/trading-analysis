package com.tradevault.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.TodaySessionDefaults;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.AutoJournalState;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.repository.TodaySessionRepository;
import com.tradevault.repository.UserRepository;
import com.tradevault.security.JwtTokenProvider;
import com.tradevault.service.TimezoneService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class TodaySessionControllerIntegrationTest {

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
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TodaySessionRepository todaySessionRepository;

    @AfterEach
    void cleanUp() {
        todaySessionRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void saveTodaySessionWithMinimalPayloadAppliesAutoJournalDefaults() throws Exception {
        User user = persistUser("today-session-minimal@example.com");
        String token = jwtTokenProvider.createToken(user.getId(), user.getEmail());

        MvcResult result = mockMvc.perform(post("/api/sessions/today")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "profitTarget", 400,
                                "lossLimit", 200,
                                "maxTrades", 3
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.path("status").asText()).isEqualTo("ACTIVE");
        assertThat(body.path("profitTarget").decimalValue()).isEqualByComparingTo(new BigDecimal("400.0000"));
        assertThat(body.path("lossLimit").decimalValue()).isEqualByComparingTo(new BigDecimal("200.0000"));
        assertThat(body.path("maxTrades").asInt()).isEqualTo(3);
        assertThat(body.path("autoJournalState").asText()).isEqualTo(AutoJournalState.DISARMED.name());
        assertThat(body.hasNonNull("autoJournalTolerancePips")).isTrue();
        assertThat(body.path("autoJournalTolerancePips").decimalValue())
                .isEqualByComparingTo(TodaySessionDefaults.AUTO_JOURNAL_TOLERANCE_PIPS);
        assertThat(body.path("autoJournalTimeoutMin").asInt())
                .isEqualTo(TodaySessionDefaults.AUTO_JOURNAL_TIMEOUT_MINUTES);

        LocalDate sessionDate = LocalDate.now(ZoneId.of(TimezoneService.DEFAULT_TIMEZONE));
        TodaySession persisted = todaySessionRepository.findByUser_IdAndSessionDate(user.getId(), sessionDate).orElseThrow();
        assertThat(persisted.getStatus()).isEqualTo(TodaySessionStatus.ACTIVE);
        assertThat(persisted.getAutoJournalState()).isEqualTo(AutoJournalState.DISARMED);
        assertThat(persisted.getAutoJournalTolerancePips())
                .isEqualByComparingTo(TodaySessionDefaults.AUTO_JOURNAL_TOLERANCE_PIPS);
        assertThat(persisted.getAutoJournalTimeoutMin())
                .isEqualTo(TodaySessionDefaults.AUTO_JOURNAL_TIMEOUT_MINUTES);
    }

    @Test
    void saveTodaySessionWithMinimalPayloadPreservesExistingAutoJournalConfig() throws Exception {
        User user = persistUser("today-session-update@example.com");
        LocalDate sessionDate = LocalDate.now(ZoneId.of(TimezoneService.DEFAULT_TIMEZONE));
        TodaySession existing = todaySessionRepository.saveAndFlush(TodaySession.builder()
                .user(user)
                .sessionDate(sessionDate)
                .profitTarget(new BigDecimal("150.0000"))
                .lossLimit(new BigDecimal("75.0000"))
                .maxTrades(2)
                .status(TodaySessionStatus.ACTIVE)
                .autoJournalState(AutoJournalState.DISARMED)
                .autoJournalTolerancePips(new BigDecimal("2.5000"))
                .autoJournalTimeoutMin(45)
                .build());

        String token = jwtTokenProvider.createToken(user.getId(), user.getEmail());
        MvcResult result = mockMvc.perform(post("/api/sessions/today")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "profitTarget", 500,
                                "lossLimit", 250,
                                "maxTrades", 4
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.path("autoJournalTolerancePips").decimalValue()).isEqualByComparingTo(new BigDecimal("2.5000"));
        assertThat(body.path("autoJournalTimeoutMin").asInt()).isEqualTo(45);

        TodaySession persisted = todaySessionRepository.findById(existing.getId()).orElseThrow();
        assertThat(persisted.getAutoJournalTolerancePips()).isEqualByComparingTo(new BigDecimal("2.5000"));
        assertThat(persisted.getAutoJournalTimeoutMin()).isEqualTo(45);
    }

    private User persistUser(String email) {
        return userRepository.save(User.builder()
                .email(email)
                .passwordHash("hashed")
                .role(Role.USER)
                .timezone("UTC")
                .build());
    }
}
