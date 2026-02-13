package com.tradevault.repository;

import com.tradevault.domain.entity.ChecklistTemplateItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChecklistTemplateItemRepository extends JpaRepository<ChecklistTemplateItem, UUID> {
    boolean existsByUser_Id(UUID userId);

    List<ChecklistTemplateItem> findByUser_IdOrderBySortOrderAscCreatedAtAsc(UUID userId);

    List<ChecklistTemplateItem> findByUser_IdAndIsEnabledTrueOrderBySortOrderAscCreatedAtAsc(UUID userId);
}
