package com.tradevault.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.ContentPostTranslation;
import com.tradevault.domain.entity.ContentType;
import com.tradevault.domain.entity.ContentTypeTranslation;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.ContentTypeRepository;
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
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
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
    ObjectMapper objectMapper;

    @Autowired
    UserRepository userRepository;

    @Autowired
    ContentPostRepository contentPostRepository;

    @Autowired
    ContentTypeRepository contentTypeRepository;

    @AfterEach
    void cleanUp() {
        contentPostRepository.deleteAll();
        contentTypeRepository.deleteAll();
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
        ContentType strategyType = createType("STRATEGY", "Strategy", "Strategie");
        ContentPost draft = createPost(strategyType, admin, ContentPostStatus.DRAFT, "Draft strategy", "Strategie draft");

        mockMvc.perform(get("/api/content/" + draft.getId()).param("lang", "en"))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void adminCanAccessDrafts() throws Exception {
        User admin = createUser("admin@example.com", Role.ADMIN);
        ContentType strategyType = createType("STRATEGY", "Strategy", "Strategie");
        ContentPost draft = createPost(strategyType, admin, ContentPostStatus.DRAFT, "Draft strategy", "Strategie draft");

        mockMvc.perform(get("/api/content/" + draft.getId()).param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Draft strategy"))
                .andExpect(jsonPath("$.status").value("DRAFT"));
    }

    @Test
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void getContentReturnsEnglishWhenLangIsEn() throws Exception {
        createUser("user@example.com", Role.USER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        ContentType strategyType = createType("STRATEGY", "Strategy", "Strategie");
        ContentPost post = createPost(strategyType, admin, ContentPostStatus.PUBLISHED, "English title", "Titlu roman");

        mockMvc.perform(get("/api/content/" + post.getId())
                        .param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("English title"))
                .andExpect(jsonPath("$.resolvedLocale").value("en"));
    }

    @Test
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void getContentReturnsRomanianWhenAvailable() throws Exception {
        createUser("user@example.com", Role.USER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        ContentType strategyType = createType("STRATEGY", "Strategy", "Strategie");
        ContentPost post = createPost(strategyType, admin, ContentPostStatus.PUBLISHED, "English title", "Titlu roman");

        mockMvc.perform(get("/api/content/" + post.getId())
                        .param("lang", "ro"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Titlu roman"))
                .andExpect(jsonPath("$.resolvedLocale").value("ro"));
    }

    @Test
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void getContentFallsBackToEnglishWhenRomanianMissing() throws Exception {
        createUser("user@example.com", Role.USER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        ContentType strategyType = createType("STRATEGY", "Strategy", "Strategie");

        ContentPost post = ContentPost.builder()
                .contentType(strategyType)
                .slug("fallback-post")
                .status(ContentPostStatus.PUBLISHED)
                .createdBy(admin)
                .build();

        ContentPostTranslation en = ContentPostTranslation.builder()
                .contentPost(post)
                .locale("en")
                .title("Only English")
                .summary("Summary")
                .bodyMarkdown("Body")
                .build();
        post.getTranslations().add(en);

        ContentPost saved = contentPostRepository.save(post);

        mockMvc.perform(get("/api/content/" + saved.getId())
                        .param("lang", "ro"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Only English"))
                .andExpect(jsonPath("$.resolvedLocale").value("en"));
    }

    @Test
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void contentTypesReturnRequestedLocaleAndFallbackToEnglish() throws Exception {
        createUser("user@example.com", Role.USER);
        createType("STRATEGY", "Strategy", "Strategie");

        ContentType enOnly = ContentType.builder()
                .key("EARNINGS_RECAP")
                .active(true)
                .sortOrder(100)
                .build();
        ContentTypeTranslation en = ContentTypeTranslation.builder()
                .contentType(enOnly)
                .locale("en")
                .displayName("Earnings recap")
                .description("Only english")
                .build();
        enOnly.getTranslations().add(en);
        contentTypeRepository.save(enOnly);

        MvcResult result = mockMvc.perform(get("/api/content-types").param("lang", "ro"))
                .andExpect(status().isOk())
                .andReturn();

        List<Map<String, Object>> payload = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                new TypeReference<>() {}
        );

        Map<String, Object> strategy = payload.stream()
                .filter(item -> "STRATEGY".equals(item.get("key")))
                .findFirst()
                .orElseThrow();
        Map<String, Object> earningsRecap = payload.stream()
                .filter(item -> "EARNINGS_RECAP".equals(item.get("key")))
                .findFirst()
                .orElseThrow();

        assertThat(strategy.get("displayName")).isEqualTo("Strategie");
        assertThat(strategy.get("resolvedLocale")).isEqualTo("ro");

        assertThat(earningsRecap.get("displayName")).isEqualTo("Earnings recap");
        assertThat(earningsRecap.get("resolvedLocale")).isEqualTo("en");
    }

    private User createUser(String email, Role role) {
        return userRepository.save(User.builder()
                .email(email)
                .passwordHash("hashed")
                .role(role)
                .build());
    }

    private ContentType createType(String key, String enName, String roName) {
        ContentType contentType = ContentType.builder()
                .key(key)
                .active(true)
                .sortOrder(10)
                .build();

        ContentTypeTranslation en = ContentTypeTranslation.builder()
                .contentType(contentType)
                .locale("en")
                .displayName(enName)
                .description(null)
                .build();

        ContentTypeTranslation ro = ContentTypeTranslation.builder()
                .contentType(contentType)
                .locale("ro")
                .displayName(roName)
                .description(null)
                .build();

        contentType.getTranslations().add(en);
        contentType.getTranslations().add(ro);
        return contentTypeRepository.save(contentType);
    }

    private ContentPost createPost(ContentType type,
                                   User createdBy,
                                   ContentPostStatus status,
                                   String englishTitle,
                                   String romanianTitle) {
        ContentPost post = ContentPost.builder()
                .contentType(type)
                .slug(englishTitle.toLowerCase().replace(' ', '-'))
                .status(status)
                .createdBy(createdBy)
                .build();

        ContentPostTranslation en = ContentPostTranslation.builder()
                .contentPost(post)
                .locale("en")
                .title(englishTitle)
                .summary("English summary")
                .bodyMarkdown("English body")
                .build();

        ContentPostTranslation ro = ContentPostTranslation.builder()
                .contentPost(post)
                .locale("ro")
                .title(romanianTitle)
                .summary("Rezumat")
                .bodyMarkdown("Continut")
                .build();

        post.getTranslations().add(en);
        post.getTranslations().add(ro);

        return contentPostRepository.save(post);
    }
}
