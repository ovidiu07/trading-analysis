package com.tradevault.controller;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.ChecklistItemCompletionRepository;
import com.tradevault.repository.ChecklistTemplateItemRepository;
import com.tradevault.repository.ChecklistTemplateStateRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ChecklistControllerTest {

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
    private ChecklistTemplateStateRepository checklistTemplateStateRepository;

    @Autowired
    private ChecklistTemplateItemRepository checklistTemplateItemRepository;

    @Autowired
    private ChecklistItemCompletionRepository checklistItemCompletionRepository;

    @AfterEach
    void cleanUp() {
        checklistItemCompletionRepository.deleteAll();
        checklistTemplateItemRepository.deleteAll();
        checklistTemplateStateRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void getTodayReturnsOkForJwtUserAndDoesNotPersistDetachedUser() throws Exception {
        User user = userRepository.save(User.builder()
                .email("checklist-api@example.com")
                .passwordHash("hashed")
                .role(Role.USER)
                .timezone("UTC")
                .build());
        String token = jwtTokenProvider.createToken(user.getId(), user.getEmail());

        mockMvc.perform(get("/api/me/checklist/today")
                        .param("tz", "UTC")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(5));

        assertThat(checklistTemplateStateRepository.findById(user.getId())).isPresent();
        assertThat(userRepository.count()).isEqualTo(1L);
    }
}
