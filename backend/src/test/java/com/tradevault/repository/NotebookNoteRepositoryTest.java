package com.tradevault.repository;

import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.NotebookNoteType;
import com.tradevault.domain.enums.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class NotebookNoteRepositoryTest {

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
    NotebookNoteRepository notebookNoteRepository;

    @Autowired
    UserRepository userRepository;

    @Test
    void searchNotesIncludesNullDateKeyWhenNoRange() {
        User user = userRepository.save(User.builder()
                .email("notes@example.com")
                .passwordHash("hash")
                .role(Role.USER)
                .build());

        NotebookNote note = NotebookNote.builder()
                .user(user)
                .type(NotebookNoteType.NOTE)
                .title("Untitled")
                .body("Body")
                .isDeleted(false)
                .build();

        notebookNoteRepository.save(note);

        List<NotebookNote> results = notebookNoteRepository.searchNotes(
                user.getId(),
                null,
                null,
                null,
                null,
                false,
                null,
                Sort.by(Sort.Direction.DESC, "updatedAt")
        );

        assertThat(results).extracting(NotebookNote::getId).contains(note.getId());
    }
}
