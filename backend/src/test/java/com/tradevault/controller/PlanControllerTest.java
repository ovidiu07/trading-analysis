package com.tradevault.controller;

import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.ContentPostTranslation;
import com.tradevault.domain.entity.ContentType;
import com.tradevault.domain.entity.ContentTypeTranslation;
import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.ContentTypeRepository;
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
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

    @Autowired
    private ContentPostRepository contentPostRepository;

    @Autowired
    private ContentTypeRepository contentTypeRepository;

    @AfterEach
    void cleanup() {
        contentPostRepository.deleteAll();
        contentTypeRepository.deleteAll();
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

        ContentType dailyType = ContentType.builder()
                .key("DAILY_PLAN")
                .active(true)
                .sortOrder(1)
                .build();
        dailyType.getTranslations().add(ContentTypeTranslation.builder()
                .contentType(dailyType)
                .locale("en")
                .displayName("Daily plan")
                .description(null)
                .build());
        contentTypeRepository.save(dailyType);

        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Europe/Bucharest"));
        OffsetDateTime start = now.toLocalDate().atStartOfDay(ZoneId.of("Europe/Bucharest")).toOffsetDateTime();
        OffsetDateTime end = now.toLocalDate().atTime(23, 59).atZone(ZoneId.of("Europe/Bucharest")).toOffsetDateTime();

        ContentPost mentorPlan = ContentPost.builder()
                .contentType(dailyType)
                .slug("mentor-focus")
                .status(ContentPostStatus.PUBLISHED)
                .visibleFrom(start)
                .visibleUntil(end)
                .createdBy(viewer)
                .updatedAt(now)
                .build();
        mentorPlan.getTranslations().add(ContentPostTranslation.builder()
                .contentPost(mentorPlan)
                .locale("en")
                .title("Mentor focus")
                .summary("Stay selective")
                .bodyMarkdown("Body")
                .build());
        contentPostRepository.save(mentorPlan);

        String token = jwtTokenProvider.createToken(viewer.getId(), viewer.getEmail());

        mockMvc.perform(get("/api/today/mentor-plan")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(mentorPlan.getId().toString()))
                .andExpect(jsonPath("$.title").value("Mentor focus"));
    }

    @Test
    void deleteMyPlanSoftRemovesOwnedPlan() throws Exception {
        User owner = userRepository.save(User.builder()
                .email("owner2@example.com")
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

        String token = jwtTokenProvider.createToken(owner.getId(), owner.getEmail());

        mockMvc.perform(delete("/api/plans/my/{planId}", ownersPlan.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/plans/my")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));

        Plan persisted = planRepository.findById(ownersPlan.getId()).orElseThrow();
        assertThat(persisted.getRemovedAt()).isNotNull();
        assertThat(persisted.getRemovedByUserId()).isEqualTo(owner.getId());
    }

    @Test
    void deleteMyPlanCannotRemoveAnotherUsersPlan() throws Exception {
        User owner = userRepository.save(User.builder()
                .email("owner-remove@example.com")
                .passwordHash("hash")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .build());

        User intruder = userRepository.save(User.builder()
                .email("intruder-remove@example.com")
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

        mockMvc.perform(delete("/api/plans/my/{planId}", ownersPlan.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNotFound());

        Plan persisted = planRepository.findById(ownersPlan.getId()).orElseThrow();
        assertThat(persisted.getRemovedAt()).isNull();
    }

    @Test
    void myPlanResolvesByTimezoneWindowAcrossUtcBoundary() throws Exception {
        User owner = userRepository.save(User.builder()
                .email("owner3@example.com")
                .passwordHash("hash")
                .role(Role.USER)
                .timezone("Europe/Bucharest")
                .build());

        Plan myPlan = planRepository.save(Plan.builder()
                .scope(PlanScope.DAILY)
                .source(PlanSource.USER)
                .authorUserId(owner.getId())
                .authorDisplayName("owner3")
                .title("My Bucharest day plan")
                .content("Respect the opening range")
                .activeFrom(OffsetDateTime.parse("2026-02-14T22:00:00Z"))
                .activeTo(OffsetDateTime.parse("2026-02-15T21:59:59.999999999Z"))
                .featured(false)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build());

        String token = jwtTokenProvider.createToken(owner.getId(), owner.getEmail());

        mockMvc.perform(get("/api/today/my-plan")
                        .param("date", "2026-02-15")
                        .param("tz", "Europe/Bucharest")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(myPlan.getId().toString()))
                .andExpect(jsonPath("$.title").value("My Bucharest day plan"));

        mockMvc.perform(get("/api/today/my-plan")
                        .param("date", "2026-02-14")
                        .param("tz", "Europe/Bucharest")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().string(""));
    }
}
