package com.tradevault.repository;

import com.tradevault.domain.entity.ChecklistTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChecklistTemplateRepository extends JpaRepository<ChecklistTemplate, UUID> {
    List<ChecklistTemplate> findByUser_IdOrderByUpdatedAtDesc(UUID userId);

    Optional<ChecklistTemplate> findByIdAndUser_Id(UUID id, UUID userId);
}
