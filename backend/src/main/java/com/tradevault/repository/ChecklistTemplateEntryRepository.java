package com.tradevault.repository;

import com.tradevault.domain.entity.ChecklistTemplateEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChecklistTemplateEntryRepository extends JpaRepository<ChecklistTemplateEntry, UUID> {
    List<ChecklistTemplateEntry> findByTemplate_IdOrderBySortOrderAscCreatedAtAsc(UUID templateId);

    void deleteByTemplate_Id(UUID templateId);
}
