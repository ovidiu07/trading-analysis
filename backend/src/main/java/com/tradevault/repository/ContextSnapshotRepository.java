package com.tradevault.repository;

import com.tradevault.domain.entity.ContextSnapshot;
import com.tradevault.domain.enums.ContextSnapshotMode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ContextSnapshotRepository extends JpaRepository<ContextSnapshot, UUID> {
    List<ContextSnapshot> findByUser_IdAndModeOrderByCreatedAtDesc(UUID userId, ContextSnapshotMode mode);
}
