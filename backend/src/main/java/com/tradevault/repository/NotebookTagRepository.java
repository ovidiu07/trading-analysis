package com.tradevault.repository;

import com.tradevault.domain.entity.NotebookTag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotebookTagRepository extends JpaRepository<NotebookTag, UUID> {
    List<NotebookTag> findByUserIdOrderByNameAsc(UUID userId);

    Optional<NotebookTag> findByIdAndUserId(UUID id, UUID userId);
}
