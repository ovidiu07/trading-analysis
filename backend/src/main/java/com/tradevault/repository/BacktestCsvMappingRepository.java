package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestCsvMapping;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BacktestCsvMappingRepository extends JpaRepository<BacktestCsvMapping, UUID> {
    Optional<BacktestCsvMapping> findByUser_IdAndHeaderSignature(UUID userId, String headerSignature);
}
