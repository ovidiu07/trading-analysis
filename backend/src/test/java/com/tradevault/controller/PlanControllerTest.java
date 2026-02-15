package com.tradevault.controller;

import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.PlanRepository;
import com.tradevault.repository.UserRepository;
import com.tradevault.security.JwtTokenProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class PlanControllerTest {

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
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PlanRepository planRepository;

    @AfterEach
    void cleanup() {
        planRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void updateMyPlanCannotEditAnotherUsersPlan() throws Exception {
        User owner = userRepository.save(User.builder()
                .email("owner@example.com")
                .passwordHash("hash")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .build());

        User intruder = userRepository.save(User.builder()
                .email("intruder@example.com")
                .passwordHash("hash")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .build());

        Plan ownersPlan = planRepository.save(Plan.builder()
                .scope(PlanScope.DAILY)
                .source(PlanSource.USER)
                .authorUserId(owner.getId())
                .authorDisplayName("owner")
                .title("Owner plan")
                .content("content")
                .activeFrom(OffsetDateTime.parse("2026-02-06T00:00:00+02:00"))
                .activeTo(OffsetDateTime.parse("2026-02-06T23:59:59+02:00"))
                .featured(false)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build());

        String token = jwtTokenProvider.createToken(intruder.getId(), intruder.getEmail());

        String body = """
                {
                  "title": "Hijacked",
                  "content": "new",
                  "activeFrom": "2026-02-06T00:00:00+02:00",
                  "activeTo": "2026-02-06T23:59:59+02:00"
                }
                """;

        mockMvc.perform(put("/api/plans/my/{planId}", ownersPlan.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isNotFound());
    }

    @Test
    void mentorPlanResolvesByBucharestDateWindow() throws Exception {
        User viewer = userRepository.save(User.builder()
                .email("viewer@example.com")
                .passwordHash("hash")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .build());

        Plan mentorPlan = planRepository.save(Plan.builder()
                .scope(PlanScope.DAILY)
                .source(PlanSource.MENTOR)
                .authorUserId(viewer.getId())
                .authorDisplayName("Mentor John")
                .title("Mentor focus")
                .content("Stay selective")
                .activeFrom(OffsetDateTime.parse("2026-02-06T00:00:00+02:00"))
                .activeTo(OffsetDateTime.parse("2026-02-06T23:59:59.999999999+02:00"))
                .featured(true)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build());

        String token = jwtTokenProvider.createToken(viewer.getId(), viewer.getEmail());

        mockMvc.perform(get("/api/today/mentor-plan")
                        .param("date", "2026-02-06")
                        .param("tz", "Europe/Bucharest")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(mentorPlan.getId().toString()))
                .andExpect(jsonPath("$.title").value("Mentor focus"));

        mockMvc.perform(get("/api/today/mentor-plan")
                        .param("date", "2026-02-07")
                        .param("tz", "Europe/Bucharest")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().string(""));
    }
}
