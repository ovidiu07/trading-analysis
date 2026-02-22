package com.tradevault.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.enums.TokenType;
import com.tradevault.repository.UserTokenRepository;
import com.tradevault.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import jakarta.servlet.http.Cookie;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AuthControllerTest {

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
        registry.add("storage.s3.enabled", () -> false);
    }

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    UserRepository userRepository;

    @Autowired
    UserTokenRepository userTokenRepository;

    @Autowired
    PasswordEncoder passwordEncoder;


    @AfterEach
    void cleanUp() {
        userTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void registerReturnsSuccessAndRequiresVerification() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "user@example.com",
                                "password", "Password1!",
                                "termsAccepted", true,
                                "termsVersion", "2024-09-01",
                                "privacyAccepted", true,
                                "privacyVersion", "2024-09-01",
                                "locale", "en-GB"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.requiresEmailVerification").value(true));
    }

    @Test
    void registerDuplicateEmailReturnsConflict() throws Exception {
        userRepository.save(com.tradevault.domain.entity.User.builder()
                .email("dup@example.com")
                .passwordHash(passwordEncoder.encode("Password1!"))
                .role(com.tradevault.domain.enums.Role.USER)
                .build());

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "dup@example.com",
                                "password", "Password1!",
                                "termsAccepted", true,
                                "termsVersion", "2024-09-01",
                                "privacyAccepted", true,
                                "privacyVersion", "2024-09-01"
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("EMAIL_IN_USE"));
    }

    @Test
    void loginWithValidCredentialsReturnsToken() throws Exception {
        var saved = userRepository.save(com.tradevault.domain.entity.User.builder()
                .email("login@example.com")
                .passwordHash(passwordEncoder.encode("Password1!"))
                .role(com.tradevault.domain.enums.Role.USER)
                .demoEnabled(false)
                .emailVerifiedAt(java.time.OffsetDateTime.now())
                .build());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", saved.getEmail(), "password", "Password1!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.id").isNotEmpty());
    }

    @Test
    void loginTwiceRevokesPreviousRefreshTokenAndKeepsSingleActiveToken() throws Exception {
        var saved = userRepository.save(com.tradevault.domain.entity.User.builder()
                .email("login-twice@example.com")
                .passwordHash(passwordEncoder.encode("Password1!"))
                .role(com.tradevault.domain.enums.Role.USER)
                .demoEnabled(false)
                .emailVerifiedAt(java.time.OffsetDateTime.now())
                .build());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", saved.getEmail(), "password", "Password1!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", saved.getEmail(), "password", "Password1!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());

        var tokens = userTokenRepository.findAllByUserIdAndTypeOrderByCreatedAtAsc(saved.getId(), TokenType.REFRESH_TOKEN);
        long activeCount = userTokenRepository.countByUserIdAndTypeAndUsedAtIsNull(saved.getId(), TokenType.REFRESH_TOKEN);
        long usedCount = tokens.stream().filter(token -> token.getUsedAt() != null).count();

        assertThat(tokens).hasSize(2);
        assertThat(activeCount).isEqualTo(1);
        assertThat(usedCount).isEqualTo(1);
    }

    @Test
    void refreshRotationConsumesOldTokenAndReplayRevokesActiveSession() throws Exception {
        var saved = userRepository.save(com.tradevault.domain.entity.User.builder()
                .email("refresh-rotation@example.com")
                .passwordHash(passwordEncoder.encode("Password1!"))
                .role(com.tradevault.domain.enums.Role.USER)
                .demoEnabled(false)
                .emailVerifiedAt(java.time.OffsetDateTime.now())
                .build());

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", saved.getEmail(), "password", "Password1!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn();

        String firstRefreshToken = extractRefreshToken(loginResult);

        MvcResult refreshResult = mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("tradejaudit_rt", firstRefreshToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn();

        String secondRefreshToken = extractRefreshToken(refreshResult);
        assertThat(secondRefreshToken).isNotEqualTo(firstRefreshToken);
        assertThat(userTokenRepository.countByUserIdAndTypeAndUsedAtIsNull(saved.getId(), TokenType.REFRESH_TOKEN))
                .isEqualTo(1);

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("tradejaudit_rt", firstRefreshToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));

        assertThat(userTokenRepository.countByUserIdAndTypeAndUsedAtIsNull(saved.getId(), TokenType.REFRESH_TOKEN))
                .isZero();
    }

    @Test
    void concurrentLoginsLeaveSingleActiveRefreshToken() throws Exception {
        var saved = userRepository.save(com.tradevault.domain.entity.User.builder()
                .email("concurrent-login@example.com")
                .passwordHash(passwordEncoder.encode("Password1!"))
                .role(com.tradevault.domain.enums.Role.USER)
                .demoEnabled(false)
                .emailVerifiedAt(java.time.OffsetDateTime.now())
                .build());

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);

            Future<Integer> first = executor.submit(() -> {
                ready.countDown();
                if (!start.await(5, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Timed out waiting to start first login");
                }
                return mockMvc.perform(post("/api/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("email", saved.getEmail(), "password", "Password1!"))))
                        .andReturn()
                        .getResponse()
                        .getStatus();
            });

            Future<Integer> second = executor.submit(() -> {
                ready.countDown();
                if (!start.await(5, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Timed out waiting to start second login");
                }
                return mockMvc.perform(post("/api/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("email", saved.getEmail(), "password", "Password1!"))))
                        .andReturn()
                        .getResponse()
                        .getStatus();
            });

            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(first.get(10, TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(second.get(10, TimeUnit.SECONDS)).isEqualTo(200);
        }

        assertThat(userTokenRepository.countByUserIdAndTypeAndUsedAtIsNull(saved.getId(), TokenType.REFRESH_TOKEN))
                .isEqualTo(1);
    }

    @Test
    void loginWithWrongPasswordReturnsUnauthorized() throws Exception {
        userRepository.save(com.tradevault.domain.entity.User.builder()
                .email("wrong@example.com")
                .passwordHash(passwordEncoder.encode("Password1!"))
                .role(com.tradevault.domain.enums.Role.USER)
                .build());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "wrong@example.com", "password", "invalid"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    void registerEndpointIsNotForbidden() throws Exception {
        var result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "open@example.com",
                                "password", "Password1!",
                                "termsAccepted", true,
                                "termsVersion", "2024-09-01",
                                "privacyAccepted", true,
                                "privacyVersion", "2024-09-01"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getStatus()).isNotEqualTo(403);
    }

    @Test
    void registerFailsWithoutTerms() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "no-terms@example.com",
                                "password", "Password1!",
                                "termsAccepted", false,
                                "termsVersion", "2024-09-01",
                                "privacyAccepted", true,
                                "privacyVersion", "2024-09-01"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    private String extractRefreshToken(MvcResult result) {
        Cookie refreshCookie = result.getResponse().getCookie("tradejaudit_rt");
        assertThat(refreshCookie).isNotNull();
        assertThat(refreshCookie.getValue()).isNotBlank();
        return refreshCookie.getValue();
    }

}
