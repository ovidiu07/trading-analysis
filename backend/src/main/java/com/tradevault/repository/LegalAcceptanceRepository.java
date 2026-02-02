package com.tradevault.repository;

import com.tradevault.domain.entity.LegalAcceptance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface LegalAcceptanceRepository extends JpaRepository<LegalAcceptance, UUID> {
}
