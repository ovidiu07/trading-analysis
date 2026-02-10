package com.tradevault.repository;

import com.tradevault.domain.entity.NotebookAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotebookAttachmentRepository extends JpaRepository<NotebookAttachment, UUID> {
    List<NotebookAttachment> findByNoteIdOrderBySortOrderAscCreatedAtAsc(UUID noteId);

    Optional<NotebookAttachment> findByIdAndUserId(UUID id, UUID userId);

    Optional<NotebookAttachment> findByAssetId(UUID assetId);

    List<NotebookAttachment> findByAssetIdIn(List<UUID> assetIds);

    long deleteByAssetId(UUID assetId);

    boolean existsByUserIdAndDemoSeedIdIsNotNull(UUID userId);

    long deleteByUserIdAndDemoSeedIdIsNotNull(UUID userId);
}
