package com.tradevault.repository;

import com.tradevault.domain.entity.NotebookTagLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotebookTagLinkRepository extends JpaRepository<NotebookTagLink, UUID> {
    List<NotebookTagLink> findByNoteId(UUID noteId);

    void deleteByNoteId(UUID noteId);

    List<NotebookTagLink> findByNoteIdIn(List<UUID> noteIds);
}
