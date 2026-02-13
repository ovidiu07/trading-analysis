package com.tradevault.service.checklist;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Role;
import com.tradevault.repository.ChecklistItemCompletionRepository;
import com.tradevault.repository.ChecklistTemplateItemRepository;
import com.tradevault.repository.ChecklistTemplateStateRepository;
import com.tradevault.repository.UserRepository;
import com.tradevault.service.CurrentUserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@SpringBootTest
@Testcontainers
class ChecklistServiceIntegrationTest {

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
    private ChecklistService checklistService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChecklistTemplateStateRepository checklistTemplateStateRepository;

    @Autowired
    private ChecklistTemplateItemRepository checklistTemplateItemRepository;

    @Autowired
    private ChecklistItemCompletionRepository checklistItemCompletionRepository;

    @MockBean
    private CurrentUserService currentUserService;

    @AfterEach
    void cleanUp() {
        checklistItemCompletionRepository.deleteAll();
        checklistTemplateItemRepository.deleteAll();
        checklistTemplateStateRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void getTodayChecklistInitializesTemplateForDetachedPrincipalUser() {
        User persisted = userRepository.save(User.builder()
                .email("checklist-detached@example.com")
                .passwordHash("hashed")
                .role(Role.USER)
                .timezone("UTC")
                .build());

        User detachedPrincipal = User.builder()
                .id(persisted.getId())
                .email(persisted.getEmail())
                .passwordHash("hashed")
                .role(Role.USER)
                .timezone("UTC")
                .build();
        when(currentUserService.getCurrentUser()).thenReturn(detachedPrincipal);

        var response = checklistService.getTodayChecklist("UTC");

        assertThat(response.getItems()).hasSize(5);
        assertThat(checklistTemplateStateRepository.findById(persisted.getId())).isPresent();
        assertThat(checklistTemplateItemRepository.findByUser_IdOrderBySortOrderAscCreatedAtAsc(persisted.getId()))
                .hasSize(5);
        assertThat(userRepository.count()).isEqualTo(1L);
    }
}
