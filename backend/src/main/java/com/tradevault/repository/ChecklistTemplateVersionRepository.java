package com.tradevault.repository;

import com.tradevault.domain.entity.ChecklistTemplateVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ChecklistTemplateVersionRepository extends JpaRepository<ChecklistTemplateVersion, UUID> {
    Optional<ChecklistTemplateVersion> findFirstByTemplate_IdOrderByVersionNumberDesc(UUID templateId);
}
