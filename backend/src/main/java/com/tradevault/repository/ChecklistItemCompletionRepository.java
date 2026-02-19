package com.tradevault.repository;

import com.tradevault.domain.entity.ChecklistItemCompletion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ChecklistItemCompletionRepository extends JpaRepository<ChecklistItemCompletion, UUID> {
    List<ChecklistItemCompletion> findByUser_IdAndDate(UUID userId, LocalDate date);

    List<ChecklistItemCompletion> findByUser_IdAndChecklistItem_IdInAndDate(UUID userId,
                                                                             Collection<UUID> checklistItemIds,
                                                                             LocalDate date);
}
