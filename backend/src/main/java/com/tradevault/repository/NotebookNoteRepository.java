package com.tradevault.repository;

import com.tradevault.domain.entity.NotebookNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotebookNoteRepository extends JpaRepository<NotebookNote, UUID>,
    NotebookNoteRepositoryCustom {
    Optional<NotebookNote> findByIdAndUserId(UUID id, UUID userId);

    List<NotebookNote> findByUserIdAndIsDeletedFalse(UUID userId);

    boolean existsByUserIdAndDemoSeedIdIsNotNull(UUID userId);

    boolean existsByUserIdAndDemoSeedIdIsNull(UUID userId);

    long deleteByUserIdAndDemoSeedIdIsNotNull(UUID userId);
}
