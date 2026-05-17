package com.tradevault.repository;

import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.enums.NotebookNoteType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotebookNoteRepository extends JpaRepository<NotebookNote, UUID>,
    NotebookNoteRepositoryCustom {
    Optional<NotebookNote> findByIdAndUserId(UUID id, UUID userId);

    List<NotebookNote> findByUserIdAndIsDeletedFalse(UUID userId);

    List<NotebookNote> findByUserIdAndTypeAndRelatedTrade_IdInAndIsDeletedFalseOrderByUpdatedAtDescCreatedAtDesc(
            UUID userId,
            NotebookNoteType type,
            Collection<UUID> tradeIds
    );

    Optional<NotebookNote> findFirstByUserIdAndRelatedSession_IdAndRelatedSetup_IdAndTypeAndIsDeletedFalseOrderByUpdatedAtDescCreatedAtDesc(
            UUID userId,
            UUID relatedSessionId,
            UUID relatedSetupId,
            NotebookNoteType type
    );

    boolean existsByUserIdAndDemoSeedIdIsNotNull(UUID userId);

    boolean existsByUserIdAndDemoSeedIdIsNull(UUID userId);

    long deleteByUserIdAndDemoSeedIdIsNotNull(UUID userId);
}
