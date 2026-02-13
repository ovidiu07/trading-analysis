package com.tradevault.repository;

import com.tradevault.domain.entity.ChecklistTemplateState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ChecklistTemplateStateRepository extends JpaRepository<ChecklistTemplateState, UUID> {
}
