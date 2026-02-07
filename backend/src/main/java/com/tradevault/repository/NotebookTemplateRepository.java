package com.tradevault.repository;

import com.tradevault.domain.entity.NotebookTemplate;
import com.tradevault.domain.enums.NotebookNoteType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotebookTemplateRepository extends JpaRepository<NotebookTemplate, UUID> {
    List<NotebookTemplate> findByUserIdOrderByUpdatedAtDesc(UUID userId);

    List<NotebookTemplate> findByUserIdAndAppliesToTypeOrderByUpdatedAtDesc(UUID userId, NotebookNoteType type);

    Optional<NotebookTemplate> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserId(UUID userId);

    boolean existsByUserIdAndDemoSeedIdIsNotNull(UUID userId);

    long deleteByUserIdAndDemoSeedIdIsNotNull(UUID userId);
}
