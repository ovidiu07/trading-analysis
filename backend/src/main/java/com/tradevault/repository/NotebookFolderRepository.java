package com.tradevault.repository;

import com.tradevault.domain.entity.NotebookFolder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotebookFolderRepository extends JpaRepository<NotebookFolder, UUID> {
    List<NotebookFolder> findByUserIdOrderBySortOrderAscNameAsc(UUID userId);

    Optional<NotebookFolder> findByIdAndUserId(UUID id, UUID userId);

    Optional<NotebookFolder> findByUserIdAndSystemKey(UUID userId, String systemKey);
}
