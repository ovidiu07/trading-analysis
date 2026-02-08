package com.tradevault.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Map;

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
    }

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    UserRepository userRepository;

    @Autowired
    PasswordEncoder passwordEncoder;


    @AfterEach
    void cleanUp() {
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

}
