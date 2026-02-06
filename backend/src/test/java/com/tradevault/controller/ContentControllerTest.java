package com.tradevault.controller;

import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.domain.enums.ContentPostType;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ContentControllerTest {

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
    UserRepository userRepository;

    @Autowired
    ContentPostRepository contentPostRepository;

    @AfterEach
    void cleanUp() {
        contentPostRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void nonAdminCannotAccessAdminEndpoints() throws Exception {
        createUser("user@example.com", Role.USER);

        mockMvc.perform(get("/api/admin/content"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void publishedEndpointHidesDraftsFromUsers() throws Exception {
        createUser("user@example.com", Role.USER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        ContentPost draft = createPost(admin, ContentPostStatus.DRAFT);

        mockMvc.perform(get("/api/content/" + draft.getId()))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void adminCanAccessDrafts() throws Exception {
        User admin = createUser("admin@example.com", Role.ADMIN);
        ContentPost draft = createPost(admin, ContentPostStatus.DRAFT);

        mockMvc.perform(get("/api/content/" + draft.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Draft strategy"))
                .andExpect(jsonPath("$.status").value("DRAFT"));
    }

    private User createUser(String email, Role role) {
        return userRepository.save(User.builder()
                .email(email)
                .passwordHash("hashed")
                .role(role)
                .build());
    }

    private ContentPost createPost(User createdBy, ContentPostStatus status) {
        return contentPostRepository.save(ContentPost.builder()
                .type(ContentPostType.STRATEGY)
                .title("Draft strategy")
                .body("Core playbook")
                .status(status)
                .createdBy(createdBy)
                .build());
    }
}
